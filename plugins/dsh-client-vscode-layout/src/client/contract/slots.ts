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
 */
export interface SidebarOwnerProps {
  /** True when the sidebar is closed. */
  collapsed: boolean
  /** Rendered column width in px (0 when collapsed — this frame has no icon rail). */
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
   * Ask the assistant about a file. Queues a turn in the current session; a
   * no-op when no session is open, since there is nowhere to send it.
   */
  askAI: (path: string) => void
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
