/**
 * One file-type glyph, referencing a symbol from the mounted sprite.
 * Decorative: the row's text already names the file, so the icon is hidden
 * from assistive technology rather than announced twice.
 */
import css from './FileTree.module.css'

/** Icon props: the sprite symbol id to reference. */
export interface FileIconProps {
  symbolId: string
}

/** A sprite-backed file-type icon. */
export function FileIcon({ symbolId }: FileIconProps) {
  return (
    <svg className={css.icon} viewBox="0 0 24 24" aria-hidden focusable="false">
      <use href={`#${symbolId}`} />
    </svg>
  )
}
