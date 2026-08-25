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

/**
 * Resolves a relative path (e.g. `./sub/doc.md` or `../utils/path.ts`) against the
 * current document's absolute path to produce a fully qualified target path.
 */
export function resolveRelativePath(currentFilePath: string, relativePath: string): string {
  if (relativePath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(relativePath)) {
    return relativePath.replace(/\\/g, '/')
  }
  const normCurrent = currentFilePath.replace(/\\/g, '/')
  const currentDir = normCurrent.slice(0, Math.max(0, normCurrent.lastIndexOf('/')))
  const parts = currentDir ? currentDir.split('/').filter(Boolean) : []
  const relParts = relativePath.replace(/\\/g, '/').split('/')

  for (const part of relParts) {
    if (!part || part === '.') continue
    if (part === '..') {
      parts.pop()
    } else {
      parts.push(part)
    }
  }

  const prefix = normCurrent.startsWith('/') ? '/' : ''
  return prefix + parts.join('/')
}

/**
 * Computes both the display title and relative href for a target document link
 * relative to the current file and workspace root.
 *
 * Title format rules (clean, human-readable, NO ugly `../../../`):
 * 1. Same directory: Just the bare filename without extension (e.g. "Button").
 * 2. Subdirectory: Subfolder path (e.g. "components/Modal" or "tiptap/BubbleMenu").
 * 3. Outside current directory (sibling, parent, or external):
 *    - If inside workspaceRoot: clean path relative to root (e.g. "explorer/FileTree").
 *    - If outside workspaceRoot: path relative to common anchor (e.g. "Downloads/Code/notes").
 *    - In all cases, NEVER prepend `../` to the title!
 *
 * Href format rules:
 * - Proper relative path that can be resolved via resolveRelativePath (e.g. "./Button.tsx", "../../explorer/FileTree.tsx").
 */
export function getDocLinkInfo(
  currentFilePath?: string,
  targetFilePath?: string,
  workspaceRoot?: string,
): { title: string; href: string; folderBadge?: string } {
  if (!targetFilePath) return { title: '', href: '' }
  if (!currentFilePath) {
    const rawName = basename(targetFilePath)
    return { title: rawName.replace(/\.[^/.]+$/, ''), href: './' + rawName }
  }

  const normCurrent = currentFilePath.replace(/\\/g, '/')
  const normTarget = targetFilePath.replace(/\\/g, '/')
  const normRoot = workspaceRoot ? workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '') : undefined
  const currentDir = normCurrent.slice(0, Math.max(0, normCurrent.lastIndexOf('/')))

  // Calculate href (proper relative path for storage & link resolution)
  const fromParts = currentDir.split('/').filter(Boolean)
  const toParts = normTarget.split('/').filter(Boolean)
  let common = 0
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common++
  }
  const upCount = fromParts.length - common
  const relParts = [...Array(upCount).fill('..'), ...toParts.slice(common)]
  const href = (relParts.length > 0 && !relParts[0]?.startsWith('..') ? './' : '') + relParts.join('/')

  // Target directory name for badge
  const targetDir = normTarget.slice(0, Math.max(0, normTarget.lastIndexOf('/')))
  const targetFileName = basename(normTarget)
  const targetBaseName = targetFileName.replace(/\.[^/.]+$/, '')

  // 1. Same directory
  if (normTarget.startsWith(currentDir + '/') && !normTarget.slice(currentDir.length + 1).includes('/')) {
    return {
      title: targetBaseName,
      href,
      folderBadge: '.',
    }
  }

  // 2. Subdirectory of current directory
  if (normTarget.startsWith(currentDir + '/')) {
    const subPath = normTarget.slice(currentDir.length + 1)
    return {
      title: subPath.replace(/\.[^/.]+$/, ''),
      href,
      folderBadge: subPath.slice(0, Math.max(0, subPath.lastIndexOf('/'))),
    }
  }

  // 3. Outside current directory (no `../` in title!)
  let cleanTitle = ''
  let folderBadge = ''

  if (normRoot && normTarget.startsWith(normRoot + '/')) {
    const fromRoot = normTarget.slice(normRoot.length + 1)
    cleanTitle = fromRoot.replace(/\.[^/.]+$/, '')
    folderBadge = fromRoot.slice(0, Math.max(0, fromRoot.lastIndexOf('/')))
  } else {
    // If not within workspace root or no root given, strip common base or home path
    const match = normTarget.match(/(?:Documents|Downloads|Projects|Code|src)\/.*$/i)
    if (match) {
      cleanTitle = match[0].replace(/\.[^/.]+$/, '')
      folderBadge = match[0].slice(0, Math.max(0, match[0].lastIndexOf('/')))
    } else {
      const segments = toParts.slice(-3)
      cleanTitle = segments.join('/').replace(/\.[^/.]+$/, '')
      folderBadge = segments.slice(0, -1).join('/')
    }
  }

  return {
    title: cleanTitle || targetBaseName,
    href,
    folderBadge: folderBadge || basename(targetDir),
  }
}
