/**
 * Managed Rename Rewrite Engine for dsh-host-files.
 *
 * Scans markdown text and automatically updates both standard markdown links
 * and wiki-links when referenced files are moved or renamed, preserving
 * anchors (#heading), query parameters (?v=1), aliases, and skipping code blocks.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

interface FenceState {
  char: '`' | '~'
  length: number
}

export interface RewriteResult {
  markdown: string
  rewrites: number
}

function matchFence(line: string): FenceState | null {
  const match = /^\s{0,3}([`~]{3,})/.exec(line)
  if (!match) return null
  const fence = match[1]
  if (!fence) return null
  const char = fence[0]
  if (char !== '`' && char !== '~') return null
  return { char, length: fence.length }
}

function isFenceClose(line: string, fence: FenceState): boolean {
  return new RegExp(`^\\s{0,3}\\${fence.char}{${fence.length},}\\s*$`).test(line)
}

function readInlineCode(line: string, start: number): number | null {
  let runLength = 0
  while (line[start + runLength] === '`') runLength++
  if (runLength === 0) return null
  const openEnd = start + runLength

  let i = openEnd
  while (i < line.length) {
    if (line[i] !== '`') {
      i++
      continue
    }
    let closeLen = 0
    while (line[i + closeLen] === '`') closeLen++
    if (closeLen === runLength) {
      return i + runLength
    }
    i += closeLen
  }
  return openEnd
}

function normalizePosix(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  const resolved: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') {
      resolved.pop()
    } else {
      resolved.push(part)
    }
  }
  return resolved.join('/')
}

function dirnamePosix(path: string): string {
  const normalized = normalizePosix(path)
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash < 0) return '.'
  return normalized.slice(0, lastSlash)
}

function relativePosix(fromDir: string, toFile: string): string {
  const normFrom = fromDir === '.' ? [] : normalizePosix(fromDir).split('/')
  const normTo = normalizePosix(toFile).split('/')

  let common = 0
  while (
    common < normFrom.length &&
    common < normTo.length &&
    normFrom[common] === normTo[common]
  ) {
    common++
  }

  const ups = normFrom.length - common
  const resultParts: string[] = []
  for (let i = 0; i < ups; i++) {
    resultParts.push('..')
  }
  for (let i = common; i < normTo.length; i++) {
    const part = normTo[i]
    if (part) resultParts.push(part)
  }

  const res = resultParts.join('/')
  return res || '.'
}

function stripDocExt(name: string): string {
  return name.replace(/\.md$/i, '')
}

/**
 * Rewrites wiki-links (`[[target#anchor|alias]]`) matching `oldDocName` to `newDocName`.
 * Preserves code fences and inline backtick code spans.
 */
export function rewriteWikiLinks(
  markdown: string,
  oldDocName: string,
  newDocName: string,
): RewriteResult {
  const cleanOld = stripDocExt(oldDocName)
  const cleanNew = stripDocExt(newDocName)
  const oldBase = cleanOld.split('/').pop() || cleanOld
  const newBase = cleanNew.split('/').pop() || cleanNew

  const lines = markdown.split(/\r?\n/)
  const lineEndings = markdown.match(/\r?\n/g) || []

  let totalRewrites = 0
  let activeFence: FenceState | null = null

  const rewrittenLines = lines.map((line) => {
    if (activeFence) {
      if (isFenceClose(line, activeFence)) {
        activeFence = null
      }
      return line
    }

    const fence = matchFence(line)
    if (fence) {
      activeFence = fence
      return line
    }

    let out = ''
    let idx = 0

    while (idx < line.length) {
      if (line[idx] === '\\' && idx + 1 < line.length) {
        out += line.slice(idx, idx + 2)
        idx += 2
        continue
      }

      if (line[idx] === '`') {
        const nextIdx = readInlineCode(line, idx)
        if (nextIdx !== null) {
          out += line.slice(idx, nextIdx)
          idx = nextIdx
          continue
        }
      }

      if (line[idx] === '[' && line[idx + 1] === '[') {
        const closeIdx = line.indexOf(']]', idx + 2)
        if (closeIdx > idx) {
          const inner = line.slice(idx + 2, closeIdx)
          let target = inner
          let alias: string | null = null
          let anchor: string | null = null

          const pipeIdx = target.indexOf('|')
          if (pipeIdx >= 0) {
            alias = target.slice(pipeIdx + 1)
            target = target.slice(0, pipeIdx)
          }

          const hashIdx = target.indexOf('#')
          if (hashIdx >= 0) {
            anchor = target.slice(hashIdx + 1)
            target = target.slice(0, hashIdx)
          }

          const normTarget = stripDocExt(target.trim())

          if (
            normTarget === cleanOld ||
            normTarget === oldBase ||
            normTarget.endsWith(`/${cleanOld}`) ||
            normTarget.endsWith(`/${oldBase}`)
          ) {
            const replacementTarget = normTarget.includes('/') ? cleanNew : newBase
            const anchorPart = anchor ? `#${anchor}` : ''
            const aliasPart = alias ? `|${alias}` : ''
            out += `[[${replacementTarget}${anchorPart}${aliasPart}]]`
            totalRewrites++
            idx = closeIdx + 2
            continue
          }
        }
      }

      out += line[idx]
      idx++
    }

    return out
  })

  let output = ''
  for (let i = 0; i < rewrittenLines.length; i++) {
    output += rewrittenLines[i]
    if (i < lineEndings.length) {
      output += lineEndings[i]
    }
  }

  return { markdown: output, rewrites: totalRewrites }
}

/**
 * Rewrites standard markdown relative links (`[label](path)`).
 * Overloaded to support both:
 *   - 3 arguments: `(markdown, oldPath, newPath)` assuming relative from root `.`
 *   - 4 arguments: `(markdown, sourcePath, oldPath, newPath)`
 */
export function rewriteMarkdownLinks(
  markdown: string,
  sourcePathOrOldPath: string,
  oldPathOrNewPath: string,
  maybeNewPath?: string,
): RewriteResult {
  const hasSource = maybeNewPath !== undefined
  const sourcePath = hasSource ? sourcePathOrOldPath : '.'
  const oldPath = hasSource ? oldPathOrNewPath : sourcePathOrOldPath
  const newPath = hasSource ? maybeNewPath : oldPathOrNewPath

  const fromDir = dirnamePosix(sourcePath)
  const normOld = normalizePosix(oldPath)
  const normNew = normalizePosix(newPath)

  const lines = markdown.split(/\r?\n/)
  const lineEndings = markdown.match(/\r?\n/g) || []

  let totalRewrites = 0
  let activeFence: FenceState | null = null

  const rewrittenLines = lines.map((line) => {
    if (activeFence) {
      if (isFenceClose(line, activeFence)) {
        activeFence = null
      }
      return line
    }

    const fence = matchFence(line)
    if (fence) {
      activeFence = fence
      return line
    }

    let out = ''
    let idx = 0

    while (idx < line.length) {
      if (line[idx] === '\\' && idx + 1 < line.length) {
        out += line.slice(idx, idx + 2)
        idx += 2
        continue
      }

      if (line[idx] === '`') {
        const nextIdx = readInlineCode(line, idx)
        if (nextIdx !== null) {
          out += line.slice(idx, nextIdx)
          idx = nextIdx
          continue
        }
      }

      if (line[idx] === '[' && (idx === 0 || line[idx - 1] !== '!')) {
        const labelClose = line.indexOf('](', idx)
        if (labelClose > idx) {
          const hrefClose = line.indexOf(')', labelClose + 2)
          if (hrefClose > labelClose) {
            const label = line.slice(idx + 1, labelClose)
            const rawHref = line.slice(labelClose + 2, hrefClose).trim()

            if (!/^[a-z]+:/i.test(rawHref) && !rawHref.startsWith('//')) {
              let hrefPath = rawHref
              let suffix = ''

              const hashIdx = hrefPath.indexOf('#')
              if (hashIdx >= 0) {
                suffix = hrefPath.slice(hashIdx)
                hrefPath = hrefPath.slice(0, hashIdx)
              }

              const queryIdx = hrefPath.indexOf('?')
              if (queryIdx >= 0) {
                suffix = hrefPath.slice(queryIdx) + suffix
                hrefPath = hrefPath.slice(0, queryIdx)
              }

              const resolvedTarget = normalizePosix(
                fromDir === '.' ? hrefPath : `${fromDir}/${hrefPath}`,
              )

              if (resolvedTarget === normOld) {
                let computedRel = relativePosix(fromDir, normNew)
                if (
                  rawHref.startsWith('./') &&
                  !computedRel.startsWith('./') &&
                  !computedRel.startsWith('../')
                ) {
                  computedRel = `./${computedRel}`
                }

                out += `[${label}](${computedRel}${suffix})`
                totalRewrites++
                idx = hrefClose + 1
                continue
              }
            }
          }
        }
      }

      out += line[idx]
      idx++
    }

    return out
  })

  let output = ''
  for (let i = 0; i < rewrittenLines.length; i++) {
    output += rewrittenLines[i]
    if (i < lineEndings.length) {
      output += lineEndings[i]
    }
  }

  return { markdown: output, rewrites: totalRewrites }
}

/**
 * Convenience helper to rewrite both markdown links and wiki links in one pass.
 */
export function rewriteAllLinks(
  markdown: string,
  sourcePath: string,
  oldPath: string,
  newPath: string,
): RewriteResult {
  const step1 = rewriteMarkdownLinks(markdown, sourcePath, oldPath, newPath)
  const oldDocName = stripDocExt(oldPath)
  const newDocName = stripDocExt(newPath)
  const step2 = rewriteWikiLinks(step1.markdown, oldDocName, newDocName)
  return {
    markdown: step2.markdown,
    rewrites: step1.rewrites + step2.rewrites,
  }
}

async function scanMarkdownFiles(dir: string): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        const sub = await scanMarkdownFiles(full)
        results.push(...sub)
      } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
        results.push(full)
      }
    }
  } catch {
    // Ignore unreadable dirs
  }
  return results
}

/**
 * Scans all markdown files in rootDir and updates any references to oldAbsPath with newAbsPath.
 * Returns the list of absolute file paths that were updated.
 */
export async function healWorkspaceLinksOnRename(
  rootDir: string,
  oldAbsPath: string,
  newAbsPath: string,
): Promise<string[]> {
  const healedFiles: string[] = []
  try {
    const relOld = normalizePosix(oldAbsPath.replace(rootDir, '').replace(/^\/+/, ''))
    const relNew = normalizePosix(newAbsPath.replace(rootDir, '').replace(/^\/+/, ''))

    const mdFiles = await scanMarkdownFiles(rootDir)

    for (const file of mdFiles) {
      if (file === oldAbsPath) continue
      const relSource = normalizePosix(file.replace(rootDir, '').replace(/^\/+/, ''))
      const text = await readFile(file, 'utf8')
      const { markdown, rewrites } = rewriteAllLinks(text, relSource, relOld, relNew)
      if (rewrites > 0) {
        await writeFile(file, markdown, 'utf8')
        healedFiles.push(file)
      }
    }
    return healedFiles
  } catch (err) {
    console.error('[healWorkspaceLinksOnRename] failed:', err)
    return healedFiles
  }
}
