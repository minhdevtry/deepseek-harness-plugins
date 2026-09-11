/**
 * Host File Service for @anoslide/dsh-vscode-workspace.
 *
 * Implements secure sandbox operations for directory listing, file reads/writes,
 * recursive searches, deletion (trash/recycle bin), and link-healing renames.
 */
import { execFile } from 'node:child_process'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import crypto from 'node:crypto'
import type {
  DirEntry,
  FileEntry,
  FileReadResult,
  Listing,
  RenameResult,
  SandboxFolder,
  SearchContentHit,
  SearchNameHit,
} from './types.ts'
import { healWorkspaceLinksOnRename } from './managedRenameRewrite.ts'

export const MAX_READ_BYTES = 2 * 1024 * 1024 // 2 MB
export const MAX_WRITE_BYTES = 10 * 1024 * 1024 // 10 MB
export const SEARCH_DEPTH_LIMIT = 8
export const SEARCH_ENTRY_LIMIT = 20000
export const SEARCH_RESULT_LIMIT = 200

export const COLLAPSED_DIRS = new Set([
  '.git',
  'node_modules',
  '__pycache__',
  '.venv',
  'venv',
  'dist',
  '.next',
  '.dsh',
])

export const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  pdf: 'application/pdf',
}

/**
 * Validates whether `targetPath` is strictly inside or equal to `root`.
 * Rejects path traversal attempts (../) and null byte injections.
 */
export function isInsideSandbox(targetPath: string, root: string): boolean {
  if (!targetPath || !root) return false
  if (targetPath.includes('\0') || root.includes('\0')) return false

  const resolvedTarget = resolve(targetPath)
  const resolvedRoot = resolve(root)
  const rel = relative(resolvedRoot, resolvedTarget)

  if (rel === '..' || rel.startsWith(`..${sep}`) || rel.startsWith('../') || isAbsolute(rel)) {
    return false
  }
  return true
}

export function isHiddenName(name: string): boolean {
  return name.startsWith('.') || COLLAPSED_DIRS.has(name)
}

/** Check if content looks binary (high ratio of NUL bytes). */
export function looksBinary(text: string): boolean {
  const n = text.length
  if (n === 0) return false
  let nul = 0
  const checkLen = Math.min(n, 8192)
  for (let i = 0; i < checkLen; i++) {
    if (text.charCodeAt(i) === 0) nul++
  }
  return nul / checkLen > 0.01
}

function assertInsideSandbox(targetPath: string, root: string): void {
  if (!isInsideSandbox(targetPath, root)) {
    throw new Error(`Access Denied: Path is outside the sandboxed workspace directory (${root})`)
  }
}

/**
 * Lists the contents of a directory within the sandbox.
 */
export async function listDirectory(dirPath: string, root: string): Promise<Listing> {
  assertInsideSandbox(dirPath, root)
  const resolvedDir = resolve(dirPath)

  const entries = await readdir(resolvedDir, { withFileTypes: true })
  const dirs: DirEntry[] = []
  const files: FileEntry[] = []

  for (const entry of entries) {
    const full = join(resolvedDir, entry.name)
    const hidden = isHiddenName(entry.name)

    if (entry.isDirectory()) {
      dirs.push({ name: entry.name, path: full, hidden })
    } else if (entry.isFile()) {
      let size = 0
      let mtimeMs = 0
      try {
        const info = await stat(full)
        size = info.size
        mtimeMs = info.mtimeMs
      } catch {
        // Ignored if stat fails
      }
      files.push({ name: entry.name, path: full, size, mtimeMs, hidden })
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name))
  files.sort((a, b) => a.name.localeCompare(b.name))

  return {
    path: resolvedDir,
    sandboxRoot: resolve(root),
    dirs,
    files,
  }
}

/**
 * Reads the content of a file within the sandbox, enforcing size and binary safety checks.
 */
export async function readFileContent(
  filePath: string,
  root: string,
): Promise<FileReadResult> {
  assertInsideSandbox(filePath, root)
  const resolvedPath = resolve(filePath)

  const info = await stat(resolvedPath)
  if (info.isDirectory()) {
    throw new Error('path is a directory')
  }

  if (info.size > MAX_READ_BYTES) {
    const text = await readFile(resolvedPath, 'utf8')
    return {
      kind: 'too-large',
      content: text.slice(0, MAX_READ_BYTES),
      size: info.size,
      binary: false,
    }
  }

  const text = await readFile(resolvedPath, 'utf8')
  if (looksBinary(text)) {
    return {
      kind: 'binary',
      content: '',
      size: info.size,
      binary: true,
    }
  }

  return {
    kind: 'text',
    content: text,
    size: info.size,
    binary: false,
  }
}

/**
 * Writes content to a file within the sandbox, asserting size caps.
 * Returns the number of bytes written.
 */
export async function writeFileContent(
  filePath: string,
  content: string,
  root: string,
): Promise<number> {
  assertInsideSandbox(filePath, root)
  const resolvedPath = resolve(filePath)

  const byteLength = Buffer.byteLength(content, 'utf8')
  if (byteLength > MAX_WRITE_BYTES) {
    throw new Error('content too large')
  }

  const info = await stat(resolvedPath).catch(() => undefined)
  if (info !== undefined && info.isDirectory()) {
    throw new Error('path is a directory')
  }

  await writeFile(resolvedPath, content, 'utf8')
  return byteLength
}

/**
 * Creates an empty file within the sandbox. Fails if the file already exists.
 */
export async function createFile(filePath: string, root: string): Promise<void> {
  assertInsideSandbox(filePath, root)
  const resolvedPath = resolve(filePath)
  await writeFile(resolvedPath, '', { flag: 'wx' })
}

/**
 * Creates a directory within the sandbox.
 */
export async function createDirectory(dirPath: string, root: string): Promise<void> {
  assertInsideSandbox(dirPath, root)
  const resolvedPath = resolve(dirPath)
  await mkdir(resolvedPath)
}

/**
 * Moves file or directory to OS trash / recycle bin.
 */
export function recycleBinDelete(target: string, isDir: boolean): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    if (process.platform === 'win32') {
      const script = isDir
        ? 'Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($env:DSH_DELETE_PATH, "OnlyErrorDialogs", "SendToRecycleBin")'
        : 'Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($env:DSH_DELETE_PATH, "OnlyErrorDialogs", "SendToRecycleBin")'
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        {
          env: { ...process.env, DSH_DELETE_PATH: target },
          timeout: 60000,
          windowsHide: true,
        },
        (error) => {
          if (error) rejectPromise(new Error(`recycle-bin delete failed: ${error.message}`))
          else resolvePromise()
        },
      )
    } else if (process.platform === 'darwin') {
      const escaped = target.replace(/["\\]/g, '\\$&')
      execFile('osascript', ['-e', `tell application "Finder" to delete POSIX file "${escaped}"`], (error) => {
        if (!error) return resolvePromise()
        rm(target, { recursive: true, force: true }).then(resolvePromise, rejectPromise)
      })
    } else {
      execFile('gio', ['trash', target], (error) => {
        if (!error) return resolvePromise()
        rm(target, { recursive: true, force: true }).then(resolvePromise, rejectPromise)
      })
    }
  })
}

/**
 * Deletes a file or directory safely. Rejects deleting root filesystem.
 */
export async function deleteItem(itemPath: string, root: string): Promise<void> {
  assertInsideSandbox(itemPath, root)
  const resolvedPath = resolve(itemPath)

  if (resolvedPath === '/' || resolvedPath === 'C:\\') {
    throw new Error('Access Denied: Cannot delete root filesystem directory')
  }

  const info = await stat(resolvedPath)
  await recycleBinDelete(resolvedPath, info.isDirectory())
}

/**
 * Renames a file or directory and automatically heals markdown and wiki links across the workspace.
 */
export async function renameItem(
  oldPath: string,
  newPath: string,
  root: string,
): Promise<RenameResult> {
  assertInsideSandbox(oldPath, root)
  assertInsideSandbox(newPath, root)

  const resolvedOld = resolve(oldPath)
  const resolvedNew = resolve(newPath)

  await rename(resolvedOld, resolvedNew)
  const healedFiles = await healWorkspaceLinksOnRename(resolve(root), resolvedOld, resolvedNew)

  return {
    path: resolvedNew,
    healedFiles,
  }
}

/**
 * Recursively search file names under root.
 */
export async function searchDirectory(root: string, q: string): Promise<SearchNameHit[]> {
  assertInsideSandbox(root, root)
  const needle = q.toLowerCase()
  const out: SearchNameHit[] = []
  const budget = { used: 0 }

  async function walk(dir: string, depth: number): Promise<void> {
    if (
      depth > SEARCH_DEPTH_LIMIT ||
      budget.used >= SEARCH_ENTRY_LIMIT ||
      out.length >= SEARCH_RESULT_LIMIT
    ) {
      return
    }

    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (out.length >= SEARCH_RESULT_LIMIT || budget.used >= SEARCH_ENTRY_LIMIT) return
      if (isHiddenName(entry.name)) continue
      budget.used += 1

      const full = join(dir, entry.name)
      const rel = full.slice(root.length + 1).replace(/\\/g, '/')
      if (entry.isDirectory()) {
        await walk(full, depth + 1)
      } else if (
        entry.name.toLowerCase().includes(needle) ||
        rel.toLowerCase().includes(needle) ||
        full.replace(/\\/g, '/').toLowerCase().includes(needle)
      ) {
        out.push({ name: entry.name, path: full, rel })
      }
    }
  }

  await walk(resolve(root), 0)
  return out
}

/**
 * Recursively search file content with line numbers, previews, regex, and case sensitivity.
 */
export async function searchFileContent(
  root: string,
  q: string,
  caseSensitive = false,
  isRegex = false,
): Promise<SearchContentHit[]> {
  assertInsideSandbox(root, root)
  const out: SearchContentHit[] = []
  const budget = { used: 0 }

  let regex: RegExp | null = null
  if (isRegex) {
    try {
      regex = new RegExp(q, caseSensitive ? 'g' : 'gi')
    } catch {
      regex = null
    }
  }
  const needle = caseSensitive ? q : q.toLowerCase()

  async function walk(dir: string, depth: number): Promise<void> {
    if (
      depth > SEARCH_DEPTH_LIMIT ||
      budget.used >= SEARCH_ENTRY_LIMIT ||
      out.length >= SEARCH_RESULT_LIMIT
    ) {
      return
    }

    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (out.length >= SEARCH_RESULT_LIMIT || budget.used >= SEARCH_ENTRY_LIMIT) return
      if (isHiddenName(entry.name)) continue
      const full = join(dir, entry.name)

      if (entry.isDirectory()) {
        await walk(full, depth + 1)
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase()
        if (
          [
            '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz',
            '.woff', '.woff2', '.ttf', '.eot', '.exe', '.dll', '.so', '.dylib',
          ].includes(ext)
        ) {
          continue
        }

        budget.used += 1
        try {
          const info = await stat(full)
          if (info.size > 512 * 1024) continue
          const content = await readFile(full, 'utf8')
          if (looksBinary(content)) continue

          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (out.length >= SEARCH_RESULT_LIMIT) break
            const line = lines[i] ?? ''
            let match = false
            if (regex) {
              regex.lastIndex = 0
              match = regex.test(line)
            } else {
              match = caseSensitive ? line.includes(needle) : line.toLowerCase().includes(needle)
            }
            if (match) {
              out.push({
                name: entry.name,
                path: full,
                rel: full.slice(root.length + 1).replace(/\\/g, '/'),
                line: i + 1,
                preview: line.trim().slice(0, 200),
              })
            }
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  await walk(resolve(root), 0)
  return out
}

/**
 * Streams raw binary media file with its Content-Type.
 */
export async function getRawFile(
  filePath: string,
  root: string,
): Promise<{ buffer: Buffer; mimeType: string; size: number }> {
  assertInsideSandbox(filePath, root)
  const resolvedPath = resolve(filePath)

  const info = await stat(resolvedPath)
  if (info.isDirectory()) {
    throw new Error('path is a directory')
  }

  const ext = extname(resolvedPath).slice(1).toLowerCase()
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream'
  const buffer = await readFile(resolvedPath)

  return {
    buffer,
    mimeType,
    size: buffer.length,
  }
}

/**
 * Discovers subdirectories within the sandbox for folder selection.
 */
export async function getSandboxFolders(root: string): Promise<SandboxFolder[]> {
  const resolvedRoot = resolve(root)
  const folders: SandboxFolder[] = [
    { name: `${resolvedRoot.split(/[\\/]/).pop() || 'Workspace'} (Root)`, path: resolvedRoot, rel: '.' },
  ]

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 3 || folders.length >= 50) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || isHiddenName(entry.name)) continue
      const full = join(dir, entry.name)
      folders.push({
        name: entry.name,
        path: full,
        rel: full.slice(resolvedRoot.length + 1).replace(/\\/g, '/'),
      })
      await walk(full, depth + 1)
    }
  }

  await walk(resolvedRoot, 0)
  return folders
}

/**
 * Stores uploaded image locally with MD5 deduplication.
 */
export async function saveLocalImage(
  root: string,
  buffer: Buffer,
  mimeType: string,
): Promise<{ absPath: string; relPath: string }> {
  assertInsideSandbox(root, root)
  const imagesDir = join(resolve(root), 'images')
  await mkdir(imagesDir, { recursive: true })

  const extMap: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
  }
  const ext = extMap[mimeType] || '.png'
  const md5Hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 10)
  const filename = `${md5Hash}${ext}`
  const absPath = join(imagesDir, filename)

  await writeFile(absPath, buffer)
  const relPath = `./images/${filename}`
  return { absPath, relPath }
}
