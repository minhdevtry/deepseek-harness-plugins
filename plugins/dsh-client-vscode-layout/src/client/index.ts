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
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the theme plugin's Context merge (ctx.theme).
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
// Type-only: pulls ui-sidebar's SlotMap merge, so the footer-action seat this
// package registers into resolves. We do not own that hole — we join it.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: each of these packages' Context/SlotMap merge is NOT transitive
// through another package's import — every plugin that reads ctx.slots,
// ctx.sessions, ctx.workspaces, ctx.uiWorkspace or GlobalStandardProps's
// useSessions must import that package's own `/client` entry directly, even
// if it also imports a concrete type from it elsewhere (dsh-client-runtime,
// which used to pre-merge all of these into one ClientContext, is retired).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { InputTriggerServiceContract } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the 'conversation.chat.turnTail' SlotMap key and TurnTailOwnerProps
// now live in ui-chat, not ui-conversation (the owner-props themselves are
// imported directly in chat/TurnReviewCard.tsx).
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { PanelActions } from './service.ts'
import type { FrameInjected } from './contract/slots.ts'
import './styles/tokens.css'
import { AppFrame } from './AppFrame.tsx'
import { createLayoutStore } from './stores.ts'
import { LayoutController } from './service.ts'
import { ThemePresenter } from './theme-presenter.ts'
import { mountSprite } from './explorer/icons/index.ts'
import { createViewState, type ExplorerView } from './explorer/views.ts'
import { basename, resolveWorkspacePath } from './utils/path.ts'
import { RailViews, type RailViewsInjected } from './explorer/RailViews.tsx'
import { createFileSource } from './inputTriggers/fileSource.ts'
import { installComposerWriter, installReferenceWriter, toWorkspaceRelative, type ComposerReference } from './composer.ts'
import { TurnReviewCard, selectTurnId } from './chat/TurnReviewCard.tsx'

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
export const inject = ['slots', 'theme', 'sessions', 'workspaces', 'uiWorkspace']

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

  // NOTE (dsh 0.1.3-alpha.1 port): this used to decorate `ctx.workspaces.openPath`
  // so a clicked file (a tool-result row, a closing-turn file mention) opened
  // in this workbench instead of the OS's default application — see
  // fileOpener.ts's routeFor/openInWorkbench for the policy this fed. That
  // method no longer exists on IWorkspaces (or anywhere else client-side —
  // searched the whole new monorepo for a replacement and found none), so the
  // decoration is removed rather than left to throw on a bind() of undefined.
  // `openInWorkbench`/`routeFor` themselves are untouched and still work for
  // whatever DOES call them explicitly (TurnReviewCard's file rows); only the
  // host-wide click interception is gone until a new hook turns up upstream.

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
        const sessionId = await ctx.uiWorkspace.connectWorkspace(ws.workspaceId)
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
      if (!ctx.uiWorkspace) return null
      return await ctx.uiWorkspace.pickDirectory()
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
   * Register In-Chat Turn Review Card into conversation.chat.turnTail.
   * Gives a sleek per-turn review card with deep-link into editor.
   */
  ctx.effect(() => ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
    name: 'conversation.chat.turnTail',
    select: selectTurnId,
  }, TurnReviewCard)), 'vscode-layout: in-chat turn review card')

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

  /**
   * Watch agent tool calls and diffs from active session.
   * When an agent writes or edits a file, automatically trigger AI Review mode!
   */
  ctx.inject(['sessions'], (scope: ClientContext) => {
    scope.effect(() => {
      const processedCallIds = new Set<string>()
      // Paths held per in-flight callId, so a hold taken for a call that
      // later errors, is cancelled, or settles without a diff still gets
      // released — not only the settled-with-a-write path. A hold with no
      // matching release freezes autosave (and silently no-ops Ctrl+S) for
      // that path for the rest of the session.
      const heldByCall = new Map<string, Set<string>>()
      // The agent turn each callId belongs to, so a review can be grouped
      // with every other file the same turn touched (the in-chat review
      // card's whole reason for existing). A settled `ToolResultNode` has
      // no `turn` field of its own — only `RunningToolCall` does — so this
      // is captured while the call is still running and carried forward.
      const turnByCall = new Map<string, number>()
      // Sessions whose history this watcher has already caught up on once —
      // see `rebind`'s `suppressReview` for why this exists.
      const seenSessionIds = new Set<string>()
      let isVeryFirstRebind = true
      let unsubscribeSession: (() => void) | undefined

      const releaseHeld = (paths: Iterable<string>) => {
        for (const p of paths) (window as any).__dsh_release_autosave?.(p)
      }

      const drainSnapshot = (snap: any, opts?: { suppressReview?: boolean }) => {
        const suppressReview = opts?.suppressReview ?? false
        if (!snap) return
        const cwd = scope.sessions.list.getSnapshot().byId[snap.sessionId]?.cwd
        const resolvePath = (raw: string) => resolveWorkspacePath(cwd, raw)

        // 1. Hold autosave for running tool calls that touch files, and
        // remember which paths this callId is holding so they can be
        // released together once it settles — however it settles.
        //
        // `RunningToolCall` is a FLAT shape (`{callId, name, argsRaw, ...}`),
        // never a nested `{call: {argsRaw}}` — that shape belongs to a
        // *settled* `ToolResultNode` only (step 2, below). Reading
        // `running.call?.argsRaw` here always misses, which is why holds
        // never actually engaged.
        for (const running of snap.runningCalls ?? []) {
          if (typeof running.turn === 'number') turnByCall.set(running.callId, running.turn)
          try {
            const raw = running.argsRaw
            if (!raw) continue
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
            const target = parsed.path || parsed.file_path || parsed.target_file || parsed.filePath || parsed.TargetFile
            if (typeof target === 'string') {
              const absPath = resolvePath(target)
              ;(window as any).__dsh_hold_autosave?.(absPath)
              let held = heldByCall.get(running.callId)
              if (held === undefined) { held = new Set(); heldByCall.set(running.callId, held) }
              held.add(absPath)
            }
          } catch {}
        }

        // 2. Inspect settled tool results: release any hold this call took,
        // then — if it actually mutated files and did not error out — start
        // a review.
        for (const node of snap.nodes ?? []) {
          if (node.kind !== 'tool-result') continue
          if (processedCallIds.has(node.callId)) continue

          // An interrupted or failed call mutated nothing this plugin should
          // act on — the arguments it carries describe what was ASKED, not
          // what happened, and (for an interrupted `edit`) may be a fragment
          // the agent never actually wrote.
          //
          // The host's own "this call changed files" signal: a settled diff
          // card, never a name-substring guess. Each hunk names the FileDiff
          // the underlying tool computed at execute time — real contextual
          // fragments for an edit or an overwrite of an existing file, or a
          // single whole-file hunk (oldText: null) for a genuine create.
          const diffs = !node.isError && node.resultView?.card === 'diff' ? node.resultView.diffs : null
          const hasDiffs = Array.isArray(diffs) && diffs.length > 0

          // Only commit (mark processed, release the hold, consume the turn)
          // once there is somewhere real to hand a review off to. Marking
          // processed unconditionally used to mean: if this node settled
          // before Workbench had mounted and installed the window global,
          // its write was silently dropped forever — a later snapshot would
          // never see it again to retry. A node with nothing to dispatch
          // (no diffs, or errored) has no such dependency and commits right away.
          if (hasDiffs && !suppressReview && typeof (window as any).__dsh_start_ai_review !== 'function') continue

          processedCallIds.add(node.callId)
          const held = heldByCall.get(node.callId)
          if (held !== undefined) {
            releaseHeld(held)
            heldByCall.delete(node.callId)
          }
          const turn = turnByCall.get(node.callId)
          turnByCall.delete(node.callId)

          // `suppressReview` marks this node "seen" (above) without popping a
          // review for it — used only for a session's pre-existing history at
          // the moment this watcher first looks at it (see `rebind`).
          if (!hasDiffs || suppressReview) continue

          // A page reload (or window truncation) mid-turn can settle a call
          // whose running phase this watcher never observed — there is no
          // turn number to attribute it to. Falling back to the callId keeps
          // it out of every real turn's grouping rather than merging it into
          // whichever turn happens to be numbered the same as `undefined`.
          const turnId = turn !== undefined ? String(turn) : `unattributed-${node.callId}`

          // Group by path first: a multi-hunk edit reports one FileDiff per
          // hunk, and each must reach the review as one call carrying every
          // hunk for that path — not one call per hunk, which would each
          // reset the review Workbench had just installed for the last one.
          const byPath = new Map<string, { oldText: string | null; newText: string }[]>()
          for (const hunk of diffs) {
            if (typeof hunk?.path !== 'string' || typeof hunk?.newText !== 'string') continue
            const absPath = resolvePath(hunk.path)
            const list = byPath.get(absPath) ?? []
            list.push({ oldText: typeof hunk.oldText === 'string' ? hunk.oldText : null, newText: hunk.newText })
            byPath.set(absPath, list)
          }
          for (const [absPath, hunksForPath] of byPath) {
            ;(window as any).__dsh_start_ai_review(absPath, hunksForPath, turnId)
          }
        }

        // Backstop: the turn ended (or was interrupted) with a call whose
        // settlement never arrived in this window. Release everything rather
        // than freeze autosave on those paths for the rest of the session.
        if (snap.running === false && heldByCall.size > 0) {
          for (const held of heldByCall.values()) releaseHeld(held)
          heldByCall.clear()
        }
      }

      const rebind = () => {
        unsubscribeSession?.()
        const currentSessionId = scope.sessions.list.getSnapshot().current
        if (currentSessionId === undefined) {
          unsubscribeSession = undefined
          return
        }
        const actx = scope.sessions.scope(currentSessionId)
        if (actx === undefined) {
          unsubscribeSession = undefined
          return
        }
        const sessionFace = scope.sessions.sessionOf(actx)
        if (sessionFace === undefined) {
          unsubscribeSession = undefined
          return
        }

        // A session's full node history is whatever `getSnapshot()` returns
        // right after subscribing — there is no server-side "only what's
        // new" filter. Without suppressing this first catch-up, switching to
        // (or resuming) a session with a long history popped a review for
        // every past diff in it, all at once, as if the agent had just
        // written every one of those files this instant. The exception is
        // the very first rebind of this watcher's own lifetime (a page
        // load): the active session's most recent write may be a review the
        // operator was mid-way through before the reload, and that one
        // should still reappear.
        const isFirstLookAtThisSession = !seenSessionIds.has(currentSessionId)
        seenSessionIds.add(currentSessionId)
        const suppressReview = isFirstLookAtThisSession && !isVeryFirstRebind
        isVeryFirstRebind = false

        unsubscribeSession = sessionFace.subscribe(() => {
          drainSnapshot(sessionFace.getSnapshot())
        })
        drainSnapshot(sessionFace.getSnapshot(), { suppressReview })
      }

      const offList = scope.sessions.list.subscribe(rebind)
      rebind()

      return () => {
        offList()
        unsubscribeSession?.()
        // Backstop: a hold must never outlive the watcher that took it.
        for (const held of heldByCall.values()) releaseHeld(held)
        heldByCall.clear()
        turnByCall.clear()
      }
    }, 'vscode-layout: watch agent file writes')
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
