/**
 * Seat for Workbench's unsaved-changes-aware tab close, reached from
 * `AppFrame`'s global Ctrl+W handler.
 *
 * `AppFrame` owns the tab list (`panels.tabs`/`panels.activePath`) but not the
 * dirty tracking (`BufferRegistry`/`documents`, both private to the mounted
 * `Workbench`) that decides whether closing a tab needs a confirmation. Same
 * decoration pattern as `fileOpener.ts`'s `installWorkbenchOpener`: one seat,
 * installed once from the mounted frame, inert until then.
 */

/** Close a path with Workbench's own unsaved-changes check. */
export type CloseRequester = (path: string) => void

/** Inert until the frame installs the real requester. */
const NO_WORKBENCH: CloseRequester = () => {}

let requester: CloseRequester = NO_WORKBENCH

/**
 * Seat the frame's close requester. Called once from the mounted Workbench.
 * @param next - the real requester (Workbench's `requestClose`).
 * @returns disposer restoring the inert default (last-in wins).
 */
export function installCloseCommand(next: CloseRequester): () => void {
  requester = next
  return () => {
    if (requester === next) requester = NO_WORKBENCH
  }
}

/**
 * Ask Workbench to close a tab, prompting first if it would lose edits.
 * A no-op before Workbench mounts.
 */
export function requestCloseCommand(path: string): void {
  requester(path)
}
