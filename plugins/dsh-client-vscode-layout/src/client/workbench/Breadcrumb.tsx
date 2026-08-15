/**
 * Path breadcrumb above the editor.
 *
 * Segments are clickable only where clicking means something: a directory
 * segment reveals that directory in the explorer, while the file segment is
 * already what you are looking at and stays inert. Rendering it as a button
 * anyway would promise an action that does not exist.
 */
import { memo } from 'react'
import { relativeTo } from '../explorer/tree.ts'
import css from './Breadcrumb.module.css'

/** Breadcrumb props. */
export interface BreadcrumbProps {
  /** Absolute path of the open file. */
  path: string
  /** Workspace root, so the trail starts at the project rather than at `/`. */
  root: string | undefined
  /** Reveal a directory in the explorer. */
  onNavigate: (dir: string) => void
}

/** The path trail (see module doc). */
export const Breadcrumb = memo(function Breadcrumb({ path, root, onNavigate }: BreadcrumbProps) {
  // Outside the workspace (a manually entered path), fall back to the absolute
  // trail rather than showing nothing.
  const rel = root === undefined ? undefined : relativeTo(root, path)
  const base = rel ?? path
  const segments = base.split('/').filter(segment => segment.length > 0)
  const prefix = rel === undefined ? '' : root

  return (
    <nav className={css.bar} aria-label="File path">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1
        const absolute = `${prefix}/${segments.slice(0, index + 1).join('/')}`
        return (
          <span key={absolute} className={css.crumb}>
            {index > 0 && <span className={css.sep} aria-hidden>›</span>}
            {isLast
              ? <span className={css.leaf}>{segment}</span>
              : (
                <button type="button" className={css.link} onClick={() => { onNavigate(absolute) }}>
                  {segment}
                </button>
              )}
          </span>
        )
      })}
    </nav>
  )
})
