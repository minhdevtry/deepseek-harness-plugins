/**
 * View switcher, registered into ui-sidebar's `sidebar.footer.action` seat.
 *
 * That seat is a `list` slot — the host's one additive hole in the sidebar — so
 * these buttons are ADDED beside Settings rather than displacing anything. The
 * host owns the surrounding chrome: it decides rail vs wide through the `wide`
 * owner prop, and its own rail-in animation carries these icons along with the
 * shipped ones.
 *
 * Registering here (instead of drawing a rail of our own) is what keeps the
 * host's brand row, New Session, workspace icons and Settings on screen in
 * every view: the column below is ours, the column's frame stays theirs.
 */
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ExplorerView } from './views.ts'
import css from './RailViews.module.css'

/** The frame-built callbacks this registration needs (its inject face). */
export type RailViewsInjected = {
  /** Subscribe to the active view. */
  useExplorerView: () => ExplorerView
  /** Switch views. */
  setExplorerView: (view: ExplorerView) => void
}

/** Full composed props: the seat's owner share (`wide`) plus our injected face. */
export type RailViewsProps = PropsRuntime<'sidebar.footer.action'> & RailViewsInjected

/** One switcher entry: the view it selects, its label, and its glyph. */
const ENTRIES: readonly { view: ExplorerView; label: string; hint: string; path: React.ReactNode }[] = [
  {
    view: 'explorer',
    label: 'Explorer',
    hint: 'Explorer (Ctrl+Shift+E)',
    path: <><path d="M4 4h5l2 2h9v12H4z" /></>,
  },
  {
    view: 'search',
    label: 'Search',
    hint: 'Search (Ctrl+Shift+F)',
    path: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  },
  {
    view: 'scm',
    label: 'Source Control',
    hint: 'Source Control (Ctrl+Shift+G)',
    path: <><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9v1a4 4 0 0 1-4 4H9" /><path d="M6 15V6" /></>,
  },
  // No `sessions` entry: the host's own panel toggle at the top of the column
  // already selects that view (service.ts routes its expand request there), and
  // a second control for it would just be the same button twice.
]

/**
 * Render the Explorer / Search / Source Control switcher.
 * @param props - the seat's `wide` flag plus the injected view seam.
 * @returns the switcher element tree.
 */
export function RailViews({ wide, useExplorerView, setExplorerView }: RailViewsProps) {
  const active = useExplorerView()

  return (
    <div className={css.group} data-wide={wide || undefined} role="group" aria-label="Workbench views">
      {ENTRIES.map(entry => (
        <button
          key={entry.view}
          type="button"
          className={css.item}
          // A rail button has no visible label, so the title carries the name;
          // expanded, the row labels itself and the tooltip would be noise.
          title={wide ? undefined : entry.hint}
          aria-label={entry.label}
          aria-pressed={active === entry.view}
          data-active={active === entry.view || undefined}
          onClick={() => { setExplorerView(entry.view) }}
        >
          <svg
            className={css.icon}
            width={wide ? 16 : 18}
            height={wide ? 16 : 18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {entry.path}
          </svg>
          {wide && <span className={css.label}>{entry.label}</span>}
        </button>
      ))}
    </div>
  )
}
