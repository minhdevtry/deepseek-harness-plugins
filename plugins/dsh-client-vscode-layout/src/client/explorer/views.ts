/**
 * The left column's active view, shared between the frame and the rail switcher.
 *
 * The switcher is a SEPARATE slot registration (it lands in ui-sidebar's
 * `sidebar.footer.action` seat, inside the host's own rail), so it cannot reach
 * the frame's layout store — a store belongs to the entry that seats it. This
 * tiny observable is the seam: `apply()` builds one, hands `use`/`set` to both
 * registrations through their inject faces, and neither has to know about the
 * other.
 *
 * `use` is a hook rather than a raw getter so consumers stay ordinary React
 * components; the shape mirrors the host's own `hooks` compartments
 * (ui-workspace's `useDirectoryFlow`).
 */
import { useSyncExternalStore } from 'react'

/**
 * Which view fills the column beside the host rail. `sessions` is the odd one
 * out: it is not ours to draw — it hands the whole column back to the host's
 * SidebarRoot at full width.
 */
export type ExplorerView = 'explorer' | 'search' | 'scm' | 'sessions'

/** The views this plugin draws itself, in rail order. */
export const OWN_VIEWS: readonly ExplorerView[] = ['explorer', 'search', 'scm']

/** Shared active-view seam (see module doc). */
export interface ViewState {
  /** Subscribe to the active view in a component. */
  use: () => ExplorerView
  /** Switch views; a no-op when already there (no needless notify). */
  set: (view: ExplorerView) => void
  /** Toggle a view against `explorer`, for shortcut keys. */
  toggle: (view: ExplorerView) => void
  /** Non-reactive read, for keyboard handlers that must not re-subscribe. */
  get: () => ExplorerView
}

/**
 * Build the shared view seam.
 * @returns the observable's component-facing face.
 */
export function createViewState(): ViewState {
  let view: ExplorerView = 'explorer'
  const listeners = new Set<() => void>()

  const get = (): ExplorerView => view
  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  const set = (next: ExplorerView): void => {
    if (next === view) return
    view = next
    for (const listener of listeners) listener()
  }

  return {
    get,
    set,
    // getServerSnapshot is the same getter: this plugin is browser-only, and
    // omitting it makes useSyncExternalStore throw under any SSR probe.
    use: () => useSyncExternalStore(subscribe, get, get),
    toggle: (target) => { set(view === target ? 'explorer' : target) },
  }
}
