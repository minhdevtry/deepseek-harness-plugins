/**
 * Fast fuzzy file switcher and line-jump modal.
 *
 * Populates from open tabs when the query is empty to avoid round-tripping to
 * the host filesystem search, and aborts previous in-flight searches on every
 * keystroke via AbortController so fast typing never surfaces stale results.
 */
import { useEffect, useMemo, useState } from 'react'
import { searchNames, type NameHit } from '../api/files.ts'
import { fileIconId } from '../explorer/icons/index.ts'
import { FileIcon } from '../explorer/FileIcon.tsx'
import { basename } from '../utils/path.ts'
import { usePickerNavigation } from '../utils/usePickerNavigation.ts'
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

  useEffect(() => {
    if (open) {
      setQuery('')
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

  const executeSelection = (hit: NameHit) => {
    onOpenFile(hit.path, jumpLine)
    onClose()
  }

  const { selectedIndex, setSelectedIndex, inputRef, handleKeyDown } = usePickerNavigation({
    open,
    itemCount: results.length,
    onSelect: idx => {
      const selected = results[idx]
      if (selected) executeSelection(selected)
    },
    onClose,
  })

  // Fetch search results from host
  useEffect(() => {
    if (!open) return
    if (root === undefined && tabs.length === 0) return

    if (cleanQuery.length === 0) {
      // Empty query shows currently open tabs
      const tabHits: NameHit[] = tabs.map(path => {
        const name = basename(path) || path
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
  }, [cleanQuery, open, root, tabs, setSelectedIndex])

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
