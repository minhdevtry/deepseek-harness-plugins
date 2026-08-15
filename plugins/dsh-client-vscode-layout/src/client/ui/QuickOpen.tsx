/**
 * Quick Open Palette Modal (Ctrl+P).
 *
 * Fast file switcher searching open tabs and workspace files with fuzzy ranking.
 * Supports line jumps via `:line` syntax (e.g. `AppFrame.tsx:42`).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { searchNames, type NameHit } from '../api/files.ts'
import { fileIconId } from '../explorer/icons/index.ts'
import { FileIcon } from '../explorer/FileIcon.tsx'
import css from './QuickOpen.module.css'

export interface QuickOpenProps {
  open: boolean
  root: string | undefined
  tabs: readonly string[]
  onOpenFile: (path: string, line?: number) => void
  onClose: () => void
}

export function QuickOpen({ open, root, tabs, onOpenFile, onClose }: QuickOpenProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NameHit[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => { inputRef.current?.focus() }, 30)
    }
  }, [open])

  // Parse query and line jump number (e.g. "App.tsx:42")
  const { cleanQuery, jumpLine } = useMemo(() => {
    const colon = query.indexOf(':')
    if (colon !== -1) {
      const q = query.slice(0, colon).trim()
      const lineStr = query.slice(colon + 1).trim()
      const line = parseInt(lineStr, 10)
      return { cleanQuery: q, jumpLine: Number.isNaN(line) ? undefined : line }
    }
    return { cleanQuery: query.trim(), jumpLine: undefined }
  }, [query])

  // Fetch search results from host
  useEffect(() => {
    if (!open) return
    if (root === undefined && tabs.length === 0) return

    if (cleanQuery.length === 0) {
      // Empty query shows currently open tabs
      const tabHits: NameHit[] = tabs.map(path => {
        const name = path.split('/').pop() ?? path
        const rel = root !== undefined && path.startsWith(root) ? path.slice(root.length + 1) : path
        return { name, path, rel }
      })
      setResults(tabHits)
      setSelectedIndex(0)
      return
    }

    const controller = new AbortController()
    if (root !== undefined) {
      void (async () => {
        const res = await searchNames(root, cleanQuery, controller.signal)
        if (res.ok) {
          setResults(res.value)
          setSelectedIndex(0)
        }
      })()
    }

    return () => {
      controller.abort()
    }
  }, [cleanQuery, open, root, tabs])

  const executeSelection = (hit: NameHit) => {
    onOpenFile(hit.path, jumpLine)
    onClose()
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (results.length > 0) {
        setSelectedIndex(prev => (prev + 1) % results.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (results.length > 0) {
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = results[selectedIndex]
      if (selected) executeSelection(selected)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!open) return null

  return (
    <div
      className={css.backdrop}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`${css.palette} vk_quick_open_palette`} data-vk-quickopen="true">
        <div className={css.inputWrap}>
          <input
            ref={inputRef}
            type="text"
            className={`${css.input} vk_quick_open_input`}
            placeholder="Type file name to search... (use :line to jump)"
            value={query}
            onChange={e => { setQuery(e.target.value) }}
            onKeyDown={handleKeyDown}
          />
          <span className={css.hint}>ESC to close</span>
        </div>

        <div className={css.list}>
          {results.length === 0 ? (
            <div className={css.empty}>No matching files found</div>
          ) : (
            results.map((hit, idx) => {
              const isSelected = idx === selectedIndex
              const iconId = fileIconId(hit.name)
              return (
                <button
                  key={`${hit.path}-${idx}`}
                  type="button"
                  className={css.item}
                  data-selected={isSelected || undefined}
                  onClick={() => { executeSelection(hit) }}
                  onMouseEnter={() => { setSelectedIndex(idx) }}
                >
                  <div className={css.fileIcon}>
                    <FileIcon symbolId={iconId} />
                  </div>
                  <span className={css.fileName}>{hit.name}</span>
                  <span className={css.filePath}>{hit.rel}</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
