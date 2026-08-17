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
import type { PanelActions } from './service.ts'
import type { FrameInjected } from './contract/slots.ts'
import { AppFrame } from './AppFrame.tsx'
import { createLayoutStore } from './stores.ts'
import { LayoutController } from './service.ts'
import { ThemePresenter } from './theme-presenter.ts'
import { mountSprite } from './explorer/icons/index.ts'
import { insertMentionIntoChat } from './utils/chatComposer.ts'

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
  const layout = new LayoutController()

  // The file-type symbol sprite must be in the document for the explorer's
  // <use href="#id"> references to resolve. One DOM write, retracted on unload.
  ctx.effect(() => mountSprite(), 'vscode-layout: file icon sprite')

  /**
   * Mention a file in the AI chat composer. Inserts `@filename` into the input
   * and focuses the composer so the operator can type their own question.
   */
  const askAI: FrameInjected['askAI'] = (path) => {
    const filename = path.split('/').pop() || path
    const mention = `@${filename}`
    insertMentionIntoChat(mention)
  }

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
        name: w.title || w.path.split('/').pop() || w.path,
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
        return { askAI, notify, openWorkspace, pickDirectory, listWorkspaces }
      },
    }, AppFrame)
    return () => {
      disposeRegistration()
      // provide()'s disposer settles asynchronously; teardown is synchronous fire-and-forget.
      void disposeService()
    }
  }, 'vscode-layout: service + root registration')

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
