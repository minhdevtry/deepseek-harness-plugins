/**
 * Intelligent double-bracket wiki-link completion engine (`[[query`).
 *
 * Advanced Scenarios Supported:
 * 1. Diacritics & Accents: Vietnamese/Latin non-accented matching ("tong hop loi" -> "[Vuihoc] Tổng hợp lỗi").
 * 2. Acronyms & Initials: "swe" -> "speechsuper_word_eval.py", "hdsd" -> "HDSD.md".
 * 3. Section Anchors / Headings: "[[#Heading Title" or "[[doc.md#Section" links directly to headings.
 * 4. Custom Pipe Aliases: "[[README.md|Documentation" -> inserts "[Documentation](./README.md)".
 * 5. Deep Multi-Word Search: "huly server" -> matches "huly-mcp-system/.../server.ts".
 * 6. User Home & Absolute Paths: "[[~", "[[~/Downloads", "[[~/Documents", "[[/var/...".
 * 7. Open Tabs Boost: Files currently open in tabs receive priority.
 * 8. Smart Tab Navigation: Multi-step directory drill-down with Tab key.
 * 9. Subdirectory Probing: Instant listing of folders with no delay.
 * 10. Clean Notion-Grade Link Badges: No ugly `../../../` in display titles.
 */
import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { searchNames, listDir, type NameHit } from '../api/files.ts'
import { basename, extensionOf, getAcronym, getDocLinkInfo, removeDiacritics } from '../utils/path.ts'
import { clampCaretPosition } from '../utils/positioning.ts'
import { FileIcon } from '../explorer/FileIcon.tsx'
import { fileIconId } from '../explorer/icons/index.ts'
import css from './DocLinkMenu.module.css'

export interface DocLinkState {
  query: string
  range: { from: number; to: number }
  position: { top: number; left: number; bottom?: number }
}

export interface DocLinkMenuProps {
  editor: Editor
  state: DocLinkState
  currentPath?: string | undefined
  root?: string | undefined
  openTabs?: readonly string[] | undefined
  onClose: () => void
}

interface ScoredHit {
  hit: NameHit
  score: number
  info: { title: string; href: string; folderBadge?: string | undefined; isHeading?: boolean | undefined }
  isOpenTab?: boolean | undefined
  fileExt?: string | undefined
}

/**
 * Multi-tiered scoring algorithm:
 * - Locality boost: files in same directory / subtree get highest boost.
 * - Match quality: exact name > prefix > path match > acronym > multiword > subsequence fuzzy.
 * - Open tabs boost: files currently opened in tabs get top priority.
 * - Markdown bonus: documentation files (.md, .markdown) are prioritized.
 */
function scoreHit(
  hitPath: string,
  query: string,
  currentDir?: string,
  openTabs?: readonly string[],
): number {
  const normHit = hitPath.replace(/\\/g, '/')
  const name = basename(normHit)
  const rawQ = query.trim()
  const cleanQ = rawQ.toLowerCase().replace(/^~\/?/, '').replace(/\/+$/, '')
  const cleanQNoDiacritics = removeDiacritics(cleanQ)

  const n = name.toLowerCase()
  const nNoDiacritics = removeDiacritics(n)
  const lowerPath = normHit.toLowerCase()
  const pathNoDiacritics = removeDiacritics(lowerPath)

  if (!cleanQ) {
    let score = 100
    if (currentDir && normHit.startsWith(currentDir + '/')) {
      score += 1000
      if (!normHit.slice(currentDir.length + 1).includes('/')) score += 300
    }
    if (openTabs?.includes(hitPath)) score += 400
    if (/\.(md|markdown|mdx)$/i.test(name)) score += 200
    return score
  }

  let score = 0

  // 1. Open tabs boost
  if (openTabs?.includes(hitPath)) {
    score += 300
  }

  // 2. Locality boost (same folder / subfolder)
  if (currentDir && normHit.startsWith(currentDir + '/')) {
    score += 500
    if (!normHit.slice(currentDir.length + 1).includes('/')) score += 200
  }

  // 3. Exact & Prefix matching (with and without diacritics)
  if (n === cleanQ || nNoDiacritics === cleanQNoDiacritics) {
    score += 900
  } else if (n.startsWith(cleanQ) || nNoDiacritics.startsWith(cleanQNoDiacritics)) {
    score += 600
  } else if (n.includes(cleanQ) || nNoDiacritics.includes(cleanQNoDiacritics)) {
    score += 400
  } else if (
    lowerPath.includes('/' + cleanQ + '/') ||
    lowerPath.endsWith('/' + cleanQ) ||
    lowerPath.includes('/' + cleanQ) ||
    pathNoDiacritics.includes(cleanQNoDiacritics)
  ) {
    score += 350
  } else {
    // 4. Acronym match (e.g. "swe" in "speechsuper_word_eval.py", "hdsd" in "HDSD.md")
    const acronym = getAcronym(name)
    if (acronym && (acronym === cleanQ || acronym.startsWith(cleanQ))) {
      score += 300
    } else {
      // 5. Multi-word search (e.g. "huly server" -> matches "huly-mcp-system/.../server.ts")
      const words = cleanQNoDiacritics.split(/\s+/).filter(Boolean)
      if (words.length > 1 && words.every(w => pathNoDiacritics.includes(w))) {
        score += 450
      } else {
        // 6. Subsequence fuzzy match (e.g. "ficon" in "FileIcon.tsx")
        let qIdx = 0
        let lastMatch = -1
        let consecutive = 0
        for (let i = 0; i < nNoDiacritics.length && qIdx < cleanQNoDiacritics.length; i++) {
          if (nNoDiacritics[i] === cleanQNoDiacritics[qIdx]) {
            qIdx++
            if (lastMatch === i - 1) consecutive++
            else consecutive = 0
            score += 20 + consecutive * 10
            lastMatch = i
          }
        }
        if (qIdx === cleanQNoDiacritics.length) {
          score += 200
        } else {
          // Subsequence match on entire path
          let pIdx = 0
          for (let i = 0; i < pathNoDiacritics.length && pIdx < cleanQNoDiacritics.length; i++) {
            if (pathNoDiacritics[i] === cleanQNoDiacritics[pIdx]) {
              pIdx++
              score += 10
            }
          }
          if (pIdx === cleanQNoDiacritics.length) {
            score += 150
          } else {
            return -1 // No match
          }
        }
      }
    }
  }

  // 7. Markdown documentation bonus
  if (/\.(md|markdown|mdx)$/i.test(name)) {
    score += 150
  }

  return score
}

export function DocLinkMenu({ editor, state, currentPath, root, openTabs, onClose }: DocLinkMenuProps) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [hits, setHits] = useState<ScoredHit[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    const currentDir = currentPath
      ? currentPath.replace(/\\/g, '/').slice(0, Math.max(0, currentPath.replace(/\\/g, '/').lastIndexOf('/')))
      : undefined

    const runSearch = async () => {
      let rawQ = state.query.trim()

      // Handle pipe alias: `[[filename|custom alias`
      let customAlias = ''
      if (rawQ.includes('|')) {
        const pipeParts = rawQ.split('|')
        rawQ = pipeParts[0]?.trim() || ''
        customAlias = pipeParts[1]?.trim() || ''
      }

      // ─────────────────────────────────────────────────────────────
      // Scenario 1: Headings Link inside Current Doc (`[[#Heading`)
      // ─────────────────────────────────────────────────────────────
      if (rawQ.startsWith('#')) {
        const headingQuery = removeDiacritics(rawQ.slice(1).trim().toLowerCase())
        const headingHits: ScoredHit[] = []

        editor.state.doc.descendants((node) => {
          if (node.type.name === 'heading') {
            const headingText = node.textContent.trim()
            if (headingText) {
              const hNoDiacritics = removeDiacritics(headingText.toLowerCase())
              let score = 100
              if (!headingQuery) {
                score += 500
              } else if (hNoDiacritics.startsWith(headingQuery)) {
                score += 800
              } else if (hNoDiacritics.includes(headingQuery)) {
                score += 400
              } else {
                return
              }

              headingHits.push({
                hit: { name: headingText, path: `#${headingText}`, rel: `#${headingText}` },
                score,
                info: {
                  title: customAlias || `# ${headingText}`,
                  href: `#${removeDiacritics(headingText).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}`,
                  folderBadge: `H${node.attrs.level || 1}`,
                  isHeading: true,
                },
              })
            }
          }
        })

        if (!active) return
        headingHits.sort((a, b) => b.score - a.score)
        setHits(headingHits.slice(0, 15))
        setSelectedIndex(0)
        return
      }

      // ─────────────────────────────────────────────────────────────
      // Scenario 2: Default state (empty query)
      // ─────────────────────────────────────────────────────────────
      if (!rawQ && currentDir) {
        const local = await listDir(currentDir)
        if (!active) return
        if (local.ok) {
          const allFiles: NameHit[] = local.value.files.map(f => ({
            name: f.name,
            path: f.path,
            rel: f.name,
          }))

          // Also fetch 1-level subdirectories (e.g. A/, B/, backup/)
          if (local.value.dirs && local.value.dirs.length > 0) {
            for (const d of local.value.dirs.slice(0, 10)) {
              allFiles.push({
                name: `${d.name}/`,
                path: d.path,
                rel: d.name,
                isDir: true,
              })
            }

            const subDirPromises = local.value.dirs.slice(0, 8).map(d => listDir(d.path))
            const subDirResults = await Promise.all(subDirPromises)
            if (!active) return
            for (const subRes of subDirResults) {
              if (subRes.ok) {
                for (const sf of subRes.value.files) {
                  allFiles.push({
                    name: sf.name,
                    path: sf.path,
                    rel: sf.path.slice(currentDir.length + 1),
                  })
                }
              }
            }
          }

          const scored: ScoredHit[] = allFiles.map(hit => {
            const score = scoreHit(hit.path, '', currentDir, openTabs) + (hit.isDir ? 50 : 0)
            const info = hit.isDir
              ? { title: `${hit.name}`, href: hit.path, folderBadge: 'folder' }
              : getDocLinkInfo(currentPath, hit.path, root)
            if (customAlias) info.title = customAlias
            return {
              hit,
              score,
              info,
              isOpenTab: openTabs?.includes(hit.path),
              fileExt: hit.isDir ? 'DIR' : extensionOf(hit.path).toUpperCase() || 'FILE',
            }
          })

          scored.sort((a, b) => b.score - a.score)
          setHits(scored.slice(0, 15))
          setSelectedIndex(0)
          return
        }
      }

      // ─────────────────────────────────────────────────────────────
      // Scenario 3: Active Path & Workspace Search
      // ─────────────────────────────────────────────────────────────
      const allHits: NameHit[] = []
      const seenPaths = new Set<string>()

      const isTilde = rawQ === '~' || rawQ.startsWith('~/') || rawQ.startsWith('~')
      const isAbsolute = rawQ.startsWith('/')

      if (isTilde || isAbsolute) {
        let probeDir = rawQ
        let searchKeyword = ''

        if (rawQ === '~' || rawQ === '~/') {
          probeDir = '~'
        } else if (rawQ.endsWith('/')) {
          probeDir = rawQ.slice(0, -1)
        } else {
          const slashIdx = rawQ.lastIndexOf('/')
          if (slashIdx !== -1) {
            probeDir = rawQ.slice(0, slashIdx)
            searchKeyword = rawQ.slice(slashIdx + 1)
          } else {
            probeDir = rawQ
          }
        }

        // 1. Direct directory probe
        const dirRes = await listDir(probeDir)
        if (dirRes.ok) {
          for (const d of dirRes.value.dirs) {
            if (!seenPaths.has(d.path)) {
              seenPaths.add(d.path)
              allHits.push({ name: `${d.name}/`, path: d.path, rel: d.name, isDir: true })
            }
          }
          for (const f of dirRes.value.files) {
            if (!seenPaths.has(f.path)) {
              seenPaths.add(f.path)
              allHits.push({ name: f.name, path: f.path, rel: f.name })
            }
          }
        }

        // 2. Search inside probeDir if there's a keyword
        const searchRes = await searchNames(probeDir, searchKeyword, controller.signal)
        if (searchRes.ok) {
          for (const hit of searchRes.value) {
            if (!seenPaths.has(hit.path)) {
              seenPaths.add(hit.path)
              allHits.push(hit)
            }
          }
        }
      } else {
        const cleanQ = rawQ.replace(/\\/g, '/').replace(/^\/+/, '')
        const slashIdx = cleanQ.lastIndexOf('/')
        const targetSubDir = slashIdx !== -1 ? cleanQ.slice(0, slashIdx) : cleanQ

        // 1. Direct subfolder probe in current workspace
        if (currentDir && targetSubDir) {
          const directSub = await listDir(`${currentDir}/${targetSubDir}`)
          if (directSub.ok) {
            for (const d of directSub.value.dirs) {
              if (!seenPaths.has(d.path)) {
                seenPaths.add(d.path)
                allHits.push({ name: `${d.name}/`, path: d.path, rel: d.name, isDir: true })
              }
            }
            for (const f of directSub.value.files) {
              if (!seenPaths.has(f.path)) {
                seenPaths.add(f.path)
                allHits.push({ name: f.name, path: f.path, rel: f.path.slice(currentDir.length + 1) })
              }
            }
            if (directSub.value.dirs && directSub.value.dirs.length > 0) {
              const deeperPromises = directSub.value.dirs.slice(0, 6).map(d => listDir(d.path))
              const deeperResults = await Promise.all(deeperPromises)
              for (const dRes of deeperResults) {
                if (dRes.ok) {
                  for (const df of dRes.value.files) {
                    if (!seenPaths.has(df.path)) {
                      seenPaths.add(df.path)
                      allHits.push({ name: df.name, path: df.path, rel: df.path.slice(currentDir.length + 1) })
                    }
                  }
                }
              }
            }
          }
        }

        // 2. Search workspace
        const searchRoot = root || ''
        const res = await searchNames(searchRoot, rawQ, controller.signal)
        if (res.ok) {
          for (const hit of res.value) {
            if (!seenPaths.has(hit.path)) {
              seenPaths.add(hit.path)
              allHits.push(hit)
            }
          }
        }

        // 3. Fallback: If no workspace matches, probe user home directory folders
        if (allHits.length === 0 && (cleanQ.toLowerCase() === 'downloads' || cleanQ.toLowerCase() === 'documents' || cleanQ.toLowerCase() === 'desktop')) {
          const homeProbe = await listDir(`~/${cleanQ}`)
          if (homeProbe.ok) {
            for (const d of homeProbe.value.dirs) {
              if (!seenPaths.has(d.path)) {
                seenPaths.add(d.path)
                allHits.push({ name: `${d.name}/`, path: d.path, rel: d.name, isDir: true })
              }
            }
            for (const f of homeProbe.value.files) {
              if (!seenPaths.has(f.path)) {
                seenPaths.add(f.path)
                allHits.push({ name: f.name, path: f.path, rel: f.name })
              }
            }
          }
        }
      }

      if (!active) return

      const scoredList: ScoredHit[] = []
      for (const hit of allHits) {
        const score = scoreHit(hit.path, rawQ, currentDir, openTabs) + (hit.isDir ? 30 : 0)
        if (score > 0) {
          const info = hit.isDir
            ? { title: `${hit.name}`, href: hit.path, folderBadge: 'folder' }
            : getDocLinkInfo(currentPath, hit.path, root)
          if (customAlias) info.title = customAlias
          scoredList.push({
            hit,
            score,
            info,
            isOpenTab: openTabs?.includes(hit.path),
            fileExt: hit.isDir ? 'DIR' : extensionOf(hit.path).toUpperCase() || 'FILE',
          })
        }
      }
      scoredList.sort((a, b) => b.score - a.score)
      setHits(scoredList.slice(0, 15))
      setSelectedIndex(0)
    }

    void runSearch()

    return () => {
      active = false
      controller.abort()
    }
  }, [state.query, root, currentPath, openTabs])

  // Keep active item scrolled into view
  useEffect(() => {
    if (listRef.current && listRef.current.children[selectedIndex]) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleSelect = (item: ScoredHit) => {
    if (item.hit.isDir) {
      let folderPath = item.hit.name
      if (state.query.startsWith('~')) {
        const rawQ = state.query
        const slashIdx = rawQ.lastIndexOf('/')
        const prefix = slashIdx !== -1 ? rawQ.slice(0, slashIdx + 1) : '~/'
        folderPath = `${prefix}${item.hit.name}`
      } else if (state.query.startsWith('/')) {
        folderPath = `${item.hit.path}/`
      }

      const fromAfterBracket = state.range.from + 2
      editor
        .chain()
        .focus()
        .deleteRange({ from: fromAfterBracket, to: state.range.to })
        .insertContent(folderPath)
        .setTextSelection(fromAfterBracket + folderPath.length)
        .run()
      return
    }

    const { title, href } = item.info

    // Insert clean rich link mark node into TipTap
    editor
      .chain()
      .focus()
      .deleteRange(state.range)
      .insertContent([
        {
          type: 'text',
          text: title,
          marks: [
            {
              type: 'link',
              attrs: { href },
            },
          ],
        },
        {
          type: 'text',
          text: ' ',
        },
      ])
      .run()
    onClose()
  }

  /**
   * Smart Tab key behavior:
   * 1. If item is a Directory: completes `folder/` into query.
   * 2. If item has a folder badge that is not yet fully typed in the query:
   *    Autocomplete that folder path into the editor (e.g. `[[b` + Tab -> `[[backup/` -> Tab -> `[[backup/demo_scripts/`).
   * 3. If folder is already typed or item is at current root:
   *    Select and insert the document link.
   */
  const handleTabKey = (item: ScoredHit) => {
    if (item.hit.isDir) {
      handleSelect(item)
      return
    }

    const currentQ = state.query.trim().toLowerCase()
    const folder = item.info.folderBadge && item.info.folderBadge !== '.' && item.info.folderBadge !== 'folder' && item.info.folderBadge !== 'heading'
      ? item.info.folderBadge
      : ''

    if (folder) {
      const folderSegments = folder.split('/')
      let completedPath = ''

      for (let i = 0; i < folderSegments.length; i++) {
        const segPath = folderSegments.slice(0, i + 1).join('/') + '/'
        if (!currentQ.startsWith(segPath.toLowerCase())) {
          completedPath = segPath
          break
        }
      }

      if (completedPath && completedPath.toLowerCase() !== currentQ) {
        const fromAfterBracket = state.range.from + 2
        editor
          .chain()
          .focus()
          .deleteRange({ from: fromAfterBracket, to: state.range.to })
          .insertContent(completedPath)
          .setTextSelection(fromAfterBracket + completedPath.length)
          .run()
        return
      }
    }

    handleSelect(item)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (hits.length > 0 ? (i + 1) % hits.length : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (hits.length > 0 ? (i - 1 + hits.length) % hits.length : 0))
      } else if (e.key === 'Tab') {
        e.preventDefault()
        if (e.shiftKey) {
          setSelectedIndex(i => (hits.length > 0 ? (i - 1 + hits.length) % hits.length : 0))
        } else if (hits[selectedIndex]) {
          handleTabKey(hits[selectedIndex]!)
        }
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (hits[selectedIndex]) handleSelect(hits[selectedIndex]!)
      } else if (e.key === 'PageDown') {
        e.preventDefault()
        setSelectedIndex(i => (hits.length > 0 ? Math.min(hits.length - 1, i + 5) : 0))
      } else if (e.key === 'PageUp') {
        e.preventDefault()
        setSelectedIndex(i => (hits.length > 0 ? Math.max(0, i - 5) : 0))
      } else if (e.key === 'Home') {
        e.preventDefault()
        setSelectedIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setSelectedIndex(hits.length > 0 ? hits.length - 1 : 0)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => { window.removeEventListener('keydown', handleKeyDown, true) }
  }, [hits, selectedIndex, state.range, currentPath, state.query])

  const pos = clampCaretPosition({
    top: state.position.top,
    left: state.position.left,
    bottom: state.position.bottom ?? state.position.top + 20,
    width: 360,
    height: Math.min(280, hits.length * 40 + 40),
    margin: 12,
    gap: 6,
  })

  return (
    <div className={css.menu} style={{ top: pos.top, left: pos.left }}>
      <div className={css.header}>
        <span>📄 Link: {state.query ? `"${state.query}"` : 'Files in current folder & subfolders'}</span>
        <div className={css.hints}>
          <span className={css.hintKbd}>↑↓</span>
          <span className={css.hintKbd}>⇥ tab</span>
          <span className={css.hintKbd}>↵</span>
          <span className={css.hintKbd}>esc</span>
        </div>
      </div>
      <div ref={listRef} className={css.list}>
        {hits.length === 0 ? (
          <div className={css.empty}>No matching documents found</div>
        ) : (
          hits.map((item, index) => {
            const name = basename(item.hit.path)
            const { title, href, folderBadge, isHeading } = item.info
            return (
              <div
                key={item.hit.path}
                className={`${css.item} ${index === selectedIndex ? css.active : ''}`}
                onMouseDown={e => { e.preventDefault() }}
                onClick={() => { handleSelect(item) }}
              >
                <FileIcon symbolId={item.hit.isDir ? fileIconId('.folder') : isHeading ? fileIconId('.heading') : fileIconId(name)} />
                <div className={css.meta}>
                  <div className={css.nameRow}>
                    <span className={css.name}>{title}</span>
                    {item.isOpenTab && <span className={css.openBadge}>open</span>}
                    {folderBadge && <span className={css.folderBadge}>{folderBadge}</span>}
                  </div>
                  <span className={css.path}>{href}</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
