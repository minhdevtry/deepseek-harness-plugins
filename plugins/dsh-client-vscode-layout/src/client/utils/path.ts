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
 * Strips Vietnamese and Latin diacritics / accents for seamless non-accented search.
 * e.g. "Tổng hợp lỗi hệ thống" -> "tong hop loi he thong"
 */
export function removeDiacritics(str: string): string {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

/**
 * Extracts camelCase and snake_case acronym / initials.
 * e.g. "speechsuper_word_eval.py" -> "swe", "FileIcon.tsx" -> "fi", "HDSD.md" -> "hdsd"
 */
export function getAcronym(str: string): string {
  if (!str) return ''
  const base = basename(str).replace(/\.[^/.]+$/, '')
  const parts = base.split(/[-_.\s]+/).filter(Boolean)
  if (parts.length > 1) {
    return parts.map(p => p[0] || '').join('').toLowerCase()
  }
  const camelInitials = base.replace(/[^A-Z]/g, '').toLowerCase()
  return camelInitials.length > 1 ? camelInitials : base.toLowerCase()
}

/**
 * Converts a heading title into a clean GitHub / TipTap slug.
 * e.g. "1. Điểm khởi động (Entrypoint)" -> "1-diem-khoi-dong-entrypoint"
 */
export function slugifyHeading(heading: string): string {
  return removeDiacritics(heading)
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/**
 * Resolves a relative path (e.g. `./sub/doc.md` or `../utils/path.ts`) against the
 * current document's absolute path to produce a fully qualified target path.
 */
export function resolveRelativePath(currentFilePath: string, relativePath: string): string {
  if (!relativePath) return ''
  // Strip hash fragment before resolving path
  const hashIdx = relativePath.indexOf('#')
  const rawPath = hashIdx !== -1 ? relativePath.slice(0, hashIdx) : relativePath
  const hash = hashIdx !== -1 ? relativePath.slice(hashIdx) : ''

  if (!rawPath && hash) {
    return `${currentFilePath}${hash}`
  }

  if (rawPath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(rawPath)) {
    return `${rawPath.replace(/\\/g, '/')}${hash}`
  }
  const normCurrent = currentFilePath.replace(/\\/g, '/')
  const currentDir = normCurrent.slice(0, Math.max(0, normCurrent.lastIndexOf('/')))
  const parts = currentDir ? currentDir.split('/').filter(Boolean) : []
  const relParts = rawPath.replace(/\\/g, '/').split('/')

  for (const part of relParts) {
    if (!part || part === '.') continue
    if (part === '..') {
      parts.pop()
    } else {
      parts.push(part)
    }
  }

  const prefix = normCurrent.startsWith('/') ? '/' : ''
  return `${prefix}${parts.join('/')}${hash}`
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
): { title: string; href: string; folderBadge?: string; isHeading?: boolean } {
  if (!targetFilePath) return { title: '', href: '' }

  // Handle local heading link (e.g. "#Điểm khởi động")
  if (targetFilePath.startsWith('#')) {
    const headingText = targetFilePath.slice(1)
    const slug = slugifyHeading(headingText)
    return {
      title: `# ${headingText}`,
      href: `#${slug}`,
      folderBadge: 'heading',
      isHeading: true,
    }
  }

  const hashIdx = targetFilePath.indexOf('#')
  const cleanTarget = hashIdx !== -1 ? targetFilePath.slice(0, hashIdx) : targetFilePath
  const hashPart = hashIdx !== -1 ? targetFilePath.slice(hashIdx + 1) : ''
  const hashSuffix = hashPart ? `#${slugifyHeading(hashPart)}` : ''
  const hashTitleSuffix = hashPart ? ` > ${hashPart}` : ''

  if (!currentFilePath) {
    const rawName = basename(cleanTarget)
    return {
      title: `${rawName.replace(/\.[^/.]+$/, '')}${hashTitleSuffix}`,
      href: `./${rawName}${hashSuffix}`,
    }
  }

  const normCurrent = currentFilePath.replace(/\\/g, '/')
  const normTarget = cleanTarget.replace(/\\/g, '/')
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
  const href = (relParts.length > 0 && !relParts[0]?.startsWith('..') ? './' : '') + relParts.join('/') + hashSuffix

  const targetFileName = basename(normTarget)
  const targetBaseName = targetFileName.replace(/\.[^/.]+$/, '')

  // 1. Same directory
  if (normTarget.startsWith(currentDir + '/') && !normTarget.slice(currentDir.length + 1).includes('/')) {
    return {
      title: `${targetBaseName}${hashTitleSuffix}`,
      href,
      folderBadge: '.',
    }
  }

  // 2. Subdirectory of current directory
  if (normTarget.startsWith(currentDir + '/')) {
    const subPath = normTarget.slice(currentDir.length + 1)
    return {
      title: `${subPath.replace(/\.[^/.]+$/, '')}${hashTitleSuffix}`,
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
    title: `${cleanTitle}${hashTitleSuffix}`,
    href,
    folderBadge,
  }
}
