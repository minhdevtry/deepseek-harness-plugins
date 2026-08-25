/**
 * Intelligent double-bracket wiki-link completion menu (`[[query`).
 *
 * Features:
 * - Default state: prioritizes files in current directory AND 1-level subdirectories (A/, B/...).
 * - Multi-tier fuzzy search: exact name > prefix > path match > subsequence fuzzy.
 * - Supports searching deep subfolders (e.g. `[[A/`, `[[backup/`, `[[backup/demo_sc`, `[[ab`).
 * - Double search layer: instant local subdirectory listing + workspace recursive search.
 * - Clean title insertion: no ugly `../../../` in the display badge.
 * - Clean relative href: accurate 1-click opening in Workbench tabs.
 */
import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { searchNames, listDir, type NameHit } from '../api/files.ts'
import { basename, getDocLinkInfo } from '../utils/path.ts'
import { clampPointPosition } from '../utils/positioning.ts'
import { FileIcon } from '../explorer/FileIcon.tsx'
import { fileIconId } from '../explorer/icons/index.ts'
import css from './DocLinkMenu.module.css'

export interface DocLinkState {
  query: string
  range: { from: number; to: number }
  position: { top: number; left: number }
}

export interface DocLinkMenuProps {
  editor: Editor
  state: DocLinkState
  currentPath?: string | undefined
  root?: string | undefined
  onClose: () => void
}

interface ScoredHit {
  hit: NameHit
  score: number
  info: { title: string; href: string; folderBadge?: string }
}

/**
 * Multi-tiered scoring algorithm:
 * - Locality boost: files in same directory / subtree get highest boost.
 * - Match quality: exact name > prefix > path match > subsequence fuzzy.
 * - Markdown bonus: documentation files (.md, .markdown) are prioritized.
 */
function scoreHit(
  hitPath: string,
  query: string,
  currentDir?: string,
): number {
  const normHit = hitPath.replace(/\\/g, '/')
  const name = basename(normHit)
  const q = query.trim().toLowerCase().replace(/\/+$/, '')
  const n = name.toLowerCase()
  const lowerPath = normHit.toLowerCase()

  if (!q) {
    let score = 100
    if (currentDir && normHit.startsWith(currentDir + '/')) {
      score += 1000
      if (!normHit.slice(currentDir.length + 1).includes('/')) score += 300
    }
    if (/\.(md|markdown|mdx)$/i.test(name)) score += 200
    return score
  }

  let score = 0

  // 1. Locality boost
  if (currentDir && normHit.startsWith(currentDir + '/')) {
    score += 500
    if (!normHit.slice(currentDir.length + 1).includes('/')) score += 200
  }

  // 2. Name matching
  if (n === q) {
    score += 800
  } else if (n.startsWith(q)) {
    score += 500
  } else if (n.includes(q)) {
    score += 300
  } else if (lowerPath.endsWith('/' + q) || lowerPath.includes('/' + q)) {
    score += 400
  } else if (lowerPath.includes(q)) {
    score += 350
  } else {
    // 3. Subsequence fuzzy match (e.g. "ficon" in "FileIcon.tsx")
    let qIdx = 0
    let lastMatch = -1
    let consecutive = 0
    for (let i = 0; i < n.length && qIdx < q.length; i++) {
      if (n[i] === q[qIdx]) {
        qIdx++
        if (lastMatch === i - 1) consecutive++
        else consecutive = 0
        score += 20 + consecutive * 10
        lastMatch = i
      }
    }
    if (qIdx === q.length) {
      score += 200
    } else {
      // Try subsequence fuzzy match on the full normalized path
      let pIdx = 0
      for (let i = 0; i < lowerPath.length && pIdx < q.length; i++) {
        if (lowerPath[i] === q[pIdx]) {
          pIdx++
          score += 10
        }
      }
      if (pIdx === q.length) {
        score += 150
      } else {
        return -1 // Not a match
      }
    }
  }

  // 4. Markdown documentation bonus
  if (/\.(md|markdown|mdx)$/i.test(name)) {
    score += 150
  }

  return score
}

export function DocLinkMenu({ editor, state, currentPath, root, onClose }: DocLinkMenuProps) {
  const [hits, setHits] = useState<ScoredHit[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    const currentDir = currentPath
      ? currentPath.replace(/\\/g, '/').slice(0, Math.max(0, currentPath.replace(/\\/g, '/').lastIndexOf('/')))
      : undefined

    const runSearch = async () => {
      // Step 1: Default state (empty query) -> quickly list files in current directory AND 1-level subdirectories
      if (!state.query && currentDir) {
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

          const scored: ScoredHit[] = allFiles.map(hit => ({
            hit,
            score: scoreHit(hit.path, '', currentDir),
            info: getDocLinkInfo(currentPath, hit.path, root),
          }))

          scored.sort((a, b) => b.score - a.score)
          setHits(scored.slice(0, 15))
          setSelectedIndex(0)
          return
        }
      }

      // Step 2: Query active -> search via direct subdirectory list + host search
      const allHits: NameHit[] = []
      const seenPaths = new Set<string>()

      // 2a. Direct subfolder probe if query contains folder name or slash
      const cleanQ = state.query.replace(/\\/g, '/').replace(/^\/+/, '')
      const slashIdx = cleanQ.lastIndexOf('/')
      const targetSubDir = slashIdx !== -1 ? cleanQ.slice(0, slashIdx) : cleanQ

      if (currentDir && targetSubDir) {
        const directSub = await listDir(`${currentDir}/${targetSubDir}`)
        if (directSub.ok) {
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

      // 2b. Search workspace via searchNames
      const searchRoot = root || ''
      const res = await searchNames(searchRoot, state.query, controller.signal)
      if (!active) return

      if (res.ok) {
        for (const hit of res.value) {
          if (!seenPaths.has(hit.path)) {
            seenPaths.add(hit.path)
            allHits.push(hit)
          }
        }
      }

      const scoredList: ScoredHit[] = []
      for (const hit of allHits) {
        const score = scoreHit(hit.path, state.query, currentDir)
        if (score > 0) {
          scoredList.push({
            hit,
            score,
            info: getDocLinkInfo(currentPath, hit.path, root),
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
  }, [state.query, root, currentPath])

  const handleSelect = (item: ScoredHit) => {
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (hits.length > 0 ? (i + 1) % hits.length : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (hits.length > 0 ? (i - 1 + hits.length) % hits.length : 0))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (hits[selectedIndex]) handleSelect(hits[selectedIndex]!)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => { window.removeEventListener('keydown', handleKeyDown, true) }
  }, [hits, selectedIndex, state.range, currentPath])

  const pos = clampPointPosition({
    x: state.position.left,
    y: state.position.top,
    width: 360,
    height: Math.min(280, hits.length * 40 + 40),
    margin: 12,
  })

  return (
    <div className={css.menu} style={{ top: pos.top, left: pos.left }}>
      <div className={css.header}>
        <span>📄 Link: {state.query ? `"${state.query}"` : 'Files in current folder & subfolders'}</span>
        <div className={css.hints}>
          <span className={css.hintKbd}>↑↓</span>
          <span className={css.hintKbd}>↵</span>
          <span className={css.hintKbd}>esc</span>
        </div>
      </div>
      <div className={css.list}>
        {hits.length === 0 ? (
          <div className={css.empty}>No matching documents found</div>
        ) : (
          hits.map((item, index) => {
            const name = basename(item.hit.path)
            const { title, href, folderBadge } = item.info
            return (
              <div
                key={item.hit.path}
                className={`${css.item} ${index === selectedIndex ? css.active : ''}`}
                onMouseDown={e => { e.preventDefault() }}
                onClick={() => { handleSelect(item) }}
              >
                <FileIcon symbolId={fileIconId(name)} />
                <div className={css.meta}>
                  <div className={css.nameRow}>
                    <span className={css.name}>{title}</span>
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
