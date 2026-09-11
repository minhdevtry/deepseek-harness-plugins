/**
 * Frame contracts. This package occupies the a-priori `'root'` slot and, in
 * the same register() call, declares the four child slots the frame renders.
 *
 * Declaring them is what authorizes rendering them (children = declaration =
 * render authorization). It is also why occupying `'root'` is the *only* way
 * to build this product: the stock shell puts the session list left, the chat
 * center and tool details right, while the workbench needs the explorer left,
 * the editor center and the chat right. Re-placing another plugin's holes is a
 * power the root occupant alone has.
 *
 * The three re-hosted holes keep the stock owner-prop shapes verbatim, so the
 * shipped occupants (ui-sidebar's SidebarRoot, ui-conversation's
 * ConversationRoot and DetailsPanel) drop into their new positions unmodified.
 * Deviating here would silently break them — they are compiled against those
 * shapes, not against ours.
 */

/**
 * Sidebar owner share: live column state from the frame's concession solve.
 * Shape fixed by the stock contract (`.ref/deepseek-harness/packages/client/
 * ui-layout/src/client/index.ts`).
 *
 * Both fields carry their stock MEANING, not merely their stock shape: the
 * occupant renders itself at `width`, and `collapsed` asks it for its own 56px
 * rail. Honouring that is what keeps SidebarRoot's brand row, New Session,
 * workspace icons and Settings alive — an earlier revision passed this frame's
 * whole-column width to an occupant nested inside a tab, and SidebarRoot duly
 * sized itself to 0, taking every one of those controls off screen with it.
 *
 * This frame drives them from the active view (explorer/views.ts): the
 * `sessions` view hands the column over whole (`collapsed: false`), and every
 * other view leaves the host its rail (`collapsed: true`, `width: RAIL`).
 */
export interface SidebarOwnerProps {
  /** True when the occupant should render its compact icon rail. */
  collapsed: boolean
  /** Rendered width in px: the rail width when collapsed, else the full column. */
  width: number
}

/** Conversation owner share: empty, exactly as the stock frame declares it. */
export interface ConvOwnerProps {}

/** Details owner share: empty — sessionId arrives as a framework-standard prop. */
export interface DetailsOwnerProps {}

/**
 * The frame's injected face: callbacks built in the apply closure from ctx,
 * delivered to AppFrame as props.
 *
 * Components never see ctx, so anything needing a service — here, sending a
 * prompt into the current session — arrives this way. A type alias supplies
 * the implicit index signature the registry requires.
 */
export interface WorkspaceItemInfo {
  workspaceId: string
  path: string
  name: string
}

export type FrameInjected = {
  /**
   * Surface a transient message. Routed through the injected face rather than
   * a component-level toast so the overlay milestone can replace the
   * implementation without touching a single caller.
   */
  notify: (message: string) => void
  /**
   * Open or register a workspace folder and switch the active AI Chat session to it.
   */
  openWorkspace?: ((path: string) => Promise<void>) | undefined
  /**
   * Open native directory picker to select a workspace folder.
   */
  pickDirectory?: (() => Promise<string | null>) | undefined
  /**
   * Retrieve list of currently registered workspaces.
   */
  listWorkspaces?: (() => WorkspaceItemInfo[]) | undefined
  /**
   * Active left-column view. Lives outside the layout store because the rail
   * switcher that writes it is a separate registration in the host's footer
   * seat, and a store belongs to the entry that seats it (explorer/views.ts).
   */
  useExplorerView: () => import('../explorer/views.ts').ExplorerView
  /** Switch the left-column view. */
  setExplorerView: (view: import('../explorer/views.ts').ExplorerView) => void
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * The session-list column. In this frame it is NOT the left column: the
     * explorer owns that, and the occupant renders as one tab inside it.
     */
    'sidebar': { kind: 'single'; scope: 'root'; owner: SidebarOwnerProps }
    /**
     * The AI chat surface. Re-hosted into the RIGHT column here, where the
     * stock frame puts it in the center.
     */
    'conversation': { kind: 'single'; scope: 'session-maybe'; owner: ConvOwnerProps }
    /** Tool trajectory / details, rendered as a tab beside the chat in the right column. */
    'details': { kind: 'single'; scope: 'session'; owner: DetailsOwnerProps }
    /**
     * Frame-wide floating layer, above every column and outside their scroll
     * containers: toasts, the command palette, quick-open, modal dialogs. The
     * layer is click-through — entries opt back into pointer events — so an
     * occupant never blocks the workbench underneath. Being a `list`, this is
     * the additive seat: a new overlay is added beside the existing ones
     * rather than replacing them.
     */
    'shell.overlay': { kind: 'list'; scope: 'root' }
  }
}
