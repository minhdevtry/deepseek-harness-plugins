/**
 * LayoutController: the cross-plugin panel-action face behind `ctx.layout`.
 *
 * The `ILayout` shape is NOT ours to redesign — it is the stock contract, and
 * the shipped plugins we keep alongside this frame call straight into it:
 * ui-sidebar's collapse button (`toggleSidebar`), ui-conversation's tool-card
 * expansion (`openDetails`) and its details close button (`closeDetails`), and
 * ui-tool's sub-call surfaces. Renaming a method here breaks them at runtime
 * with no compile-time warning, since they resolve `ctx.layout` through cordis.
 *
 * What differs is the *meaning*: this frame has no separate details column, so
 * details is a tab inside the right column. `openDetails()` therefore opens
 * that column and selects the details tab — one gesture, two writes, both
 * inside the store's declared action set.
 *
 * Panel geometry itself lives in the root entry's layout store (stores.ts);
 * the current-session selection lives with the runtime sessions service.
 */
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { createLayoutStore } from './stores.ts'
import type { ViewState } from './explorer/views.ts'

/** The layout store's bound action set (framework-baked, draft params peeled). */
export type PanelActions = BoundActions<ReturnType<typeof createLayoutStore>>

/**
 * The outward layout face (`ctx.layout`): the panel transitions other plugins
 * may trigger — and exactly what a test fake must supply. The `attachPanels`
 * wiring hook stays on the concrete class (root-entry assembly only).
 */
export interface ILayout {
  /** Toggle the sidebar panel (closed ⟷ contract default width). */
  toggleSidebar(): void
  /** Reveal the tool details surface (opens the right column and selects its details tab). */
  openDetails(): void
  /** Leave the tool details surface (returns the right column to the chat tab). */
  closeDetails(): void
}

/** Cross-plugin panel-action face (`ctx.layout`). */
export class LayoutController implements ILayout {
  #panels: PanelActions | undefined
  readonly #views: ViewState

  /**
   * @param views - the shared left-column view seam, needed because "expand the
   *   sidebar" means "give the sessions view the column" in this frame.
   */
  constructor(views: ViewState) {
    this.#views = views
  }

  /**
   * Adopt the root entry's bound store actions. Called from the root
   * registration's inject hook (a sanctioned assembly side effect), so the
   * face is live from the entry's first render; on entry re-register the fresh
   * actions overwrite the stale set.
   * @param actions - bound actions of the entry's layout store instance.
   */
  attachPanels(actions: PanelActions): void {
    this.#panels = actions
  }

  /**
   * Toggle the sidebar panel.
   *
   * Callers are the host's own controls — ui-sidebar's collapse button and the
   * rail icons ui-workspace routes through `expandSidebar`. In the stock shell
   * the sidebar IS the column, so "expand" is unambiguous; here the column is
   * shared with the workbench views, and the host is expanded exactly when the
   * `sessions` view owns it. A request made from any other view therefore hands
   * the column over rather than collapsing it — otherwise clicking a rail
   * workspace icon would close the column the operator was asking to open.
   */
  toggleSidebar(): void {
    const panels = this.#require()
    if (this.#views.get() === 'sessions') {
      panels.toggleSidebar()
      return
    }
    this.#views.set('sessions')
    panels.openSidebar()
  }

  /**
   * Reveal tool details. The right column may be closed when a tool card asks
   * for it, so this opens the column first — `openRight` is a no-op when it is
   * already open, which keeps a user-chosen width intact.
   */
  openDetails(): void {
    const panels = this.#require()
    panels.openRight()
    panels.setRightTab('details')
  }

  /**
   * Leave tool details. The column itself stays open on the chat tab: the
   * caller asked to close *details*, not to take the chat away.
   */
  closeDetails(): void {
    this.#require().setRightTab('chat')
  }

  #require(): PanelActions {
    // Callers are UI gestures, which cannot fire before the root entry
    // rendered (the inject hook runs in its first render) — reaching this
    // unwired is a boot-order bug, not a race to tolerate.
    if (this.#panels === undefined) throw new Error('layout: panel actions not wired (root entry not mounted)')
    return this.#panels
  }
}
