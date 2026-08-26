/**
 * VS Code workbench frame, browser half.
 *
 * One register() call contributes AppFrame into the runtime's built-in 'root'
 * slot and, in the same breath, declares the four child slots (declaration =
 * exclusive render authority), seats the layout store (panel geometry), and
 * wires the panel-action service face. A second effect seats the theme
 * presenter, which projects ctx.theme snapshots onto document.body.
 *
 * Replacing the stock frame is deliberate and is the only way to reach this
 * product: see contract/slots.ts. The stock `ui-layout` entry must be disabled
 * in the profile's cordis.patch.yml — two occupants of a `single` slot is a
 * load-time failure, by design.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the theme plugin's Context merge (ctx.theme).
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
// Type-only: pulls ui-sidebar's SlotMap merge, so the footer-action seat this
// package registers into resolves. We do not own that hole — we join it.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { InputTriggerServiceContract } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PanelActions } from './service.ts'
import type { FrameInjected } from './contract/slots.ts'
import './styles/tokens.css'
import { AppFrame } from './AppFrame.tsx'
import { createLayoutStore } from './stores.ts'
import { LayoutController } from './service.ts'
import { ThemePresenter } from './theme-presenter.ts'
import { mountSprite } from './explorer/icons/index.ts'
import { createViewState, type ExplorerView } from './explorer/views.ts'
import { basename } from './utils/path.ts'
import { RailViews, type RailViewsInjected } from './explorer/RailViews.tsx'
import { createFileSource } from './inputTriggers/fileSource.ts'
import { installComposerWriter, installReferenceWriter, toWorkspaceRelative, type ComposerReference } from './composer.ts'
import { openInWorkbench, routeFor } from './fileOpener.ts'
import { readFile } from './api/files.ts'

export { toWorkspaceRelative }

// Contract exports only (export discipline): the ctx.layout face consumers and
// test fakes type against, plus the owner shares registrants compose with. The
// frame components and the store factory stay package-internal.
export { LayoutController } from './service.ts'
export type { ILayout } from './service.ts'
export type { ConvOwnerProps, DetailsOwnerProps, SidebarOwnerProps } from './contract/slots.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The outward face only; the concrete service stays inside this plugin. */
    layout: import('./service.ts').ILayout
  }
}

/** Required services (cordis fiber inject — the loader passes all module exports as an object plugin). */
export const inject = ['slots', 'theme', 'sessions', 'workspaces']

/**
 * Client plugin body: provide ctx.layout, then one register() call — AppFrame
 * into 'root' with the four child-slot declarations, the layout store seat, and
 * the inject hook that hands the store's bound actions to the service.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  // Shared by two registrations that cannot see each other's stores: the frame
  // (root) and the rail switcher (ui-sidebar's footer seat). See explorer/views.ts.
  const views = createViewState()
  const layout = new LayoutController(views)

  /**
   * Select a left-column view, revealing the column if it is collapsed.
   *
   * Both callers reach the rail while it is the only thing on screen — a rail
   * icon click and a Ctrl+Shift chord — and a bare view write there would set a
   * view nobody can see. `openSidebar` is a no-op once the column is open, so
   * this stays safe to call unconditionally.
   */
  let panels: PanelActions | undefined
  const selectView = (view: ExplorerView): void => {
    views.set(view)
    panels?.openSidebar()
  }

  // The file-type symbol sprite must be in the document for the explorer's
  // <use href="#id"> references to resolve. One DOM write, retracted on unload.
  ctx.effect(() => mountSprite(), 'vscode-layout: file icon sprite')

  /**
   * Seat the composer writer (see composer.ts) on the host's own input face.
   *
   * `conversation` is read through ctx.get rather than declared in `inject`
   * for the same reason as inputTriggers below: ui-conversation is an ordinary
   * profile entry, and a hard dependency would take the whole frame down with
   * it. Without it the write simply reports false and the caller notifies.
   *
   * The current session is resolved per call, not captured: the operator can
   * switch sessions between two Ctrl+L presses and each mention belongs to
   * whichever composer is on screen at the time.
   */
  ctx.effect(() => installComposerWriter((text) => {
    const conversation = ctx.get('conversation') as IConversation | undefined
    if (conversation === undefined) return false
    const sessionId = ctx.sessions.list.getSnapshot().current
    if (sessionId === undefined) return false
    const actx = ctx.sessions.scope(sessionId)
    if (actx === undefined) return false
    const input = conversation.input.for(actx)
    const draft = input.state.getSnapshot().draft
    // Never weld onto the operator's last word; never double-space either.
    const gap = draft.length === 0 || /\s$/.test(draft) ? '' : ' '
    input.setDraft(`${draft}${gap}${text} `)
    return true
  }), 'vscode-layout: composer writer')

  /**
   * The frame's reference chip write path into the chat composer.
   * Inserts an authentic U+FFFC occurrence chip into the current session draft.
   */
  ctx.effect(() => installReferenceWriter((reference) => {
    const conversation = ctx.get('conversation') as IConversation | undefined
    if (conversation === undefined) return false
    const sessionId = ctx.sessions.list.getSnapshot().current
    if (sessionId === undefined) return false
    const actx = ctx.sessions.scope(sessionId)
    if (actx === undefined) return false
    const input = conversation.input.for(actx)

    // If inputTriggers is missing from profile, reference chips cannot be resolved by codec
    if (ctx.get('inputTriggers') === undefined) return false

    // Chip adds a trailing space after itself, but not before. Ensure a space
    // if draft already ends in non-whitespace.
    const before = input.state.getSnapshot()
    if (before.draft.length > 0 && !/\s$/.test(before.draft)) {
      input.setDraft(`${before.draft} `)
    }

    const snap = input.state.getSnapshot()
    const at = snap.draft.length

    const cwd = ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd
    const relRef = toWorkspaceRelative(reference.ref, cwd)
    const resolvedRef: ComposerReference = {
      ...reference,
      ref: relRef,
      clipboardText: `@${relRef}`,
    }

    return input.insertReference(resolvedRef, { start: at, end: at, draftRev: snap.draftRev })
  }), 'vscode-layout: composer reference writer')

  /**
   * Route a clicked file into the workbench instead of the OS (see fileOpener.ts).
   *
   * A decoration, not a replacement: anything the workbench cannot genuinely
   * show — a PDF, an archive, a directory, or any path at all while the frame
   * is unmounted — falls through to the host's own method, and unloading the
   * plugin puts the original back.
   *
   * The probe asks for positive evidence, not absence of it: a path whose name
   * settles nothing (`Makefile`, `LICENSE`, `~/notes`) is claimed only if the
   * host can actually read it as a file. Testing for a directory instead would
   * claim everything a directory test merely *failed* on — a path outside the
   * sandbox, a broken symlink — and hand the operator a tab that cannot open
   * where the OS would have done something sensible. Paths with a known file
   * extension skip the probe, so the common click costs no extra round trip.
   */
  ctx.effect(() => {
    const workspaces = ctx.workspaces
    // No workspaces service: nothing to decorate, and nothing to undo either.
    if (workspaces === undefined) return () => {}
    const original = workspaces.openPath.bind(workspaces)
    workspaces.openPath = async (path: string): Promise<void> => {
      const route = routeFor(path)
      if (route === 'os') return original(path)
      if (route === 'probe') {
        const probe = await readFile(path)
        if (!probe.ok) return original(path)
      }
      if (openInWorkbench(path)) return
      return original(path)
    }
    return () => { workspaces.openPath = original }
  }, 'vscode-layout: file clicks open in the workbench')

  /**
   * Transient operator feedback.
   */
  const notify: FrameInjected['notify'] = (message) => {
    ctx.logger.info(message)
  }

  /**
   * Connect and switch to a workspace directory.
   */
  const openWorkspace: FrameInjected['openWorkspace'] = async (targetPath: string) => {
    try {
      if (!ctx.workspaces) return
      const snapshot = ctx.workspaces.list.getSnapshot()
      let ws = snapshot.items.find(item => item.path === targetPath)
      if (!ws) {
        ws = await ctx.workspaces.create({ path: targetPath })
      }
      if (ws?.workspaceId) {
        const sessionId = await ctx.workspaces.connectWorkspace(ws.workspaceId)
        ctx.sessions.open(sessionId)
      }
    } catch (err) {
      ctx.logger.error('Failed to open workspace:', err)
    }
  }

  /**
   * Open native directory picker to select a folder on disk.
   */
  const pickDirectory: FrameInjected['pickDirectory'] = async () => {
    try {
      if (!ctx.workspaces) return null
      return await ctx.workspaces.pickDirectory()
    } catch (err) {
      ctx.logger.error('Directory picker error:', err)
      return null
    }
  }

  /**
   * List all registered workspaces.
   */
  const listWorkspaces: FrameInjected['listWorkspaces'] = () => {
    try {
      if (!ctx.workspaces) return []
      const items = ctx.workspaces.list.getSnapshot().items
      return items.map(w => ({
        workspaceId: String(w.workspaceId),
        path: w.path,
        name: w.title || basename(w.path) || w.path,
      }))
    } catch {
      return []
    }
  }

  ctx.effect(() => {
    const disposeService = ctx.reflect.provide('layout', layout)
    const disposeRegistration = ctx.slots.register({
      name: 'root',
      children: {
        'sidebar': { kind: 'single', scope: 'root' },
        'conversation': { kind: 'single', scope: 'session-maybe' },
        'details': { kind: 'single', scope: 'session' },
        'shell.overlay': { kind: 'list', scope: 'root' },
      },
      // Exclusive store: the factory itself — the framework instantiates per
      // entry and delivers useStore/actions to AppFrame as standard props.
      store: createLayoutStore,
      // The hook connects the root store to ctx.layout and hands the frame the
      // ctx-backed callbacks its components cannot build themselves.
      inject: (actions: PanelActions): FrameInjected => {
        layout.attachPanels(actions)
        panels = actions
        return {
          notify, openWorkspace, pickDirectory, listWorkspaces,
          useExplorerView: views.use, setExplorerView: selectView,
        }
      },
    }, AppFrame)
    return () => {
      disposeRegistration()
      // provide()'s disposer settles asynchronously; teardown is synchronous fire-and-forget.
      void disposeService()
    }
  }, 'vscode-layout: service + root registration')

  /**
   * The view switcher, into ui-sidebar's `sidebar.footer.action` seat.
   *
   * `slots.inject` rather than a bare register: that hole is declared by
   * ui-sidebar's own entry, which may activate after this one (or re-declare on
   * reload), and inject re-runs the registration against each live declaration
   * instead of throwing on a hole that is not there yet.
   *
   * The seat is a `list`, so this is purely additive — Settings and every
   * shipped footer action stay exactly where they were.
   */
  ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'vscode-layout-views',
    // Above Settings, below anything the host considers more urgent.
    order: 20,
    inject: (): RailViewsInjected => ({
      useExplorerView: views.use,
      setExplorerView: selectView,
    }),
  }, RailViews)), 'vscode-layout: rail view switcher')

  /**
   * Workspace files as an `@` group, beside ui-subagent's agents.
   *
   * `ctx.inject` defers until the service exists: ui-input-trigger is an
   * ordinary profile entry an operator may disable, and a hard dependency would
   * take this whole frame down with it. Without the service the composer simply
   * offers no file candidates.
   */
  ctx.inject(['inputTriggers', 'sessions'], (scope: ClientContext) => {
    const inputTriggers = scope.inputTriggers as InputTriggerServiceContract
    scope.effect(
      () => inputTriggers.registerSource(createFileSource(
        session => scope.sessions.list.getSnapshot().byId[session.sessionId]?.cwd,
      )),
      'vscode-layout: @ workspace files',
    )
  })

  // Theme presentation: pure DOM writes from resolved snapshots — initial state
  // through the getter once, then event-driven only; no React path.
  ctx.effect(() => {
    const presenter = new ThemePresenter()
    presenter.apply(ctx.theme.getTheme())
    const off = ctx.on('theme/change', (snapshot) => { presenter.apply(snapshot) })
    return () => {
      off()
      presenter.dispose()
    }
  }, 'vscode-layout: theme presenter')
}
