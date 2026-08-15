/**
 * File-type icon lookup and the one-time sprite mount.
 *
 * Resolution order matches VS Code's icon themes: an exact filename match wins
 * (`Dockerfile`, `.gitignore`, `package.json`), then the longest compound
 * extension (`.test.ts` before `.ts`, `.d.ts` before `.ts`), then the last
 * extension, then a generic document. Directories have their own open/closed
 * pair.
 *
 * Pure except for `mountSprite`, which is the single DOM write this module
 * owns; the sprite must live in the document for `<use href="#id">` to resolve.
 */
import {
  FILE_ICON_BY_EXT, FILE_ICON_BY_NAME, FILE_ICON_DIR, FILE_ICON_DIR_OPEN,
  FILE_ICON_FALLBACK, FILE_ICON_SPRITE,
} from './sprite.ts'

/** Element id of the mounted sprite container. */
const SPRITE_ID = 'vscode-layout-file-icons'

/**
 * The symbol id for a directory row.
 * @param expanded - whether the directory is showing its children.
 */
export function dirIconId(expanded: boolean): string {
  return expanded ? FILE_ICON_DIR_OPEN : FILE_ICON_DIR
}

/**
 * The symbol id for a file row.
 *
 * Compound extensions are tried longest-first so `app.test.ts` picks the test
 * icon rather than the TypeScript one; a bare dotfile like `.gitignore` is
 * matched by name, not treated as an extension.
 * @param name - the file's base name.
 * @returns a sprite symbol id; never undefined (falls back to a document icon).
 */
export function fileIconId(name: string): string {
  const lower = name.toLowerCase()

  const byName = FILE_ICON_BY_NAME[lower]
  if (byName !== undefined) return byName

  // A leading dot is part of the name, not an extension boundary.
  const segments = lower.replace(/^\./, '').split('.')
  for (let start = 1; start < segments.length; start += 1) {
    const compound = segments.slice(start).join('.')
    const hit = FILE_ICON_BY_EXT[compound]
    if (hit !== undefined) return hit
  }

  return FILE_ICON_FALLBACK
}

/**
 * Insert the symbol sprite into the document once.
 *
 * Idempotent by element id: plugin reload re-runs apply, and a second sprite
 * would duplicate 97 symbol ids and make `<use>` resolution ambiguous.
 * @returns a disposer that removes the sprite again.
 */
export function mountSprite(): () => void {
  const existing = document.getElementById(SPRITE_ID)
  if (existing !== null) return () => { /* not ours to remove */ }
  const container = document.createElement('div')
  container.id = SPRITE_ID
  container.innerHTML = FILE_ICON_SPRITE
  document.body.append(container)
  return () => { container.remove() }
}
