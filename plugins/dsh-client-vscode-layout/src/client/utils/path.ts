/**
 * File path utilities for the VS Code workbench layout.
 *
 * Normalises both Windows (`\\`) and POSIX (`/`) separators so path arithmetic
 * behaves consistently across operating systems and remote tunnel hosts.
 */

/**
 * Returns the final name component of a path, handling both `/` and `\\`
 * separators as well as trailing slashes.
 */
export function basename(path: string): string {
  if (!path) return ''
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const idx = normalized.lastIndexOf('/')
  return idx === -1 ? normalized : normalized.slice(idx + 1)
}

/**
 * Last file extension of a path, lowercased; empty string when there is none.
 * A leading dot is treated as part of the filename (e.g. `.gitignore`), not an extension marker.
 */
export function extensionOf(path: string): string {
  const name = basename(path)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}
