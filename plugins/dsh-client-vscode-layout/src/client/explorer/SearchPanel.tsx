/**
 * Workspace-wide content search.
 *
 * Debounced, and every superseded run is aborted. Two things go wrong without
 * that: a fast typist leaves a queue of full-tree greps racing to render, where
 * the last one to *land* — not the last one *issued* — would win, and the host
 * keeps walking the tree for answers nobody wants. The controller stops the
 * work; the generation guard settles the ordering.
 *
 * Results group by file with a match count, mirroring VS Code's search view;
 * clicking a line reports the file and line outward. What "jump to line" means
 * is the editor's business, not this panel's.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { searchContent, type ContentHit } from '../api/files.ts'
import { fileIconId } from './icons/index.ts'
import { FileIcon } from './FileIcon.tsx'
import css from './SearchPanel.module.css'

/** Search panel props. */
export interface SearchPanelProps {
  /** Absolute path the search walks. */
  root: string
  /** Reveal a hit; `line` is 1-based. */
  onOpenFile: (path: string, line?: number) => void
}

/** Idle time after the last keystroke before a search runs, in ms. */
const DEBOUNCE_MS = 250

/** Search panel (see module doc). */
export function SearchPanel({ root, onOpenFile }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [regex, setRegex] = useState(false)
  const [hits, setHits] = useState<ContentHit[]>([])
  const [state, setState] = useState<'idle' | 'searching' | 'done'>('idle')
  const [error, setError] = useState<string | undefined>(undefined)

  const generation = useRef(0)
  const inFlight = useRef<AbortController | undefined>(undefined)

  const run = useCallback(async (text: string, options: { caseSensitive: boolean; regex: boolean }): Promise<void> => {
    generation.current += 1
    const mine = generation.current
    // Stop the previous grep before starting another; the host is walking the
    // whole tree for it.
    inFlight.current?.abort()
    if (text.trim().length === 0) {
      inFlight.current = undefined
      setHits([])
      setState('idle')
      setError(undefined)
      return
    }
    const controller = new AbortController()
    inFlight.current = controller
    setState('searching')
    const result = await searchContent(root, text.trim(), options, controller.signal)
    // A newer keystroke already superseded this run (its abort surfaces here as
    // an ordinary failure, which this guard drops before it can render).
    if (generation.current !== mine) return
    inFlight.current = undefined
    if (!result.ok) {
      setError(result.error)
      setHits([])
      setState('done')
      return
    }
    setError(undefined)
    setHits(result.value)
    setState('done')
  }, [root])

  // Debounce the query; option toggles and root changes re-run immediately
  // because they are deliberate single gestures, not a stream of keystrokes.
  useEffect(() => {
    const timer = setTimeout(() => { void run(query, { caseSensitive, regex }) }, DEBOUNCE_MS)
    return () => { clearTimeout(timer) }
  }, [query, caseSensitive, regex, run])

  // Leaving the panel (or the whole frame) must not leave a grep running.
  useEffect(() => () => { inFlight.current?.abort() }, [])

  const total = hits.reduce((sum, hit) => sum + hit.matches.length, 0)

  return (
    <div className={css.panel}>
      <div className={css.field}>
        <input
          className={css.input}
          value={query}
          placeholder="Search in workspace"
          aria-label="Search in workspace"
          onChange={(event) => { setQuery(event.target.value) }}
        />
        <div className={css.toggles}>
          <button
            type="button"
            className={css.toggle}
            data-on={caseSensitive || undefined}
            aria-pressed={caseSensitive}
            title="Match case"
            onClick={() => { setCaseSensitive(v => !v) }}
          >
            Aa
          </button>
          <button
            type="button"
            className={css.toggle}
            data-on={regex || undefined}
            aria-pressed={regex}
            title="Use regular expression"
            onClick={() => { setRegex(v => !v) }}
          >
            .*
          </button>
        </div>
      </div>

      <div className={css.status} role="status">
        {state === 'searching' && 'Searching…'}
        {state === 'done' && error === undefined && (
          total === 0 ? 'No results' : `${total} result${total === 1 ? '' : 's'} in ${hits.length} file${hits.length === 1 ? '' : 's'}`
        )}
        {error !== undefined && <span className={css.error}>{error}</span>}
      </div>

      <div className={css.results}>
        {hits.map(hit => (
          <div key={hit.path} className={css.group}>
            <div className={css.groupHeader} title={hit.rel}>
              <FileIcon symbolId={fileIconId(hit.name)} />
              <span className={css.groupName}>{hit.name}</span>
              <span className={css.groupPath}>{hit.rel}</span>
              <span className={css.count}>{hit.matches.length}</span>
            </div>
            {hit.matches.map(match => (
              <button
                key={`${hit.path}:${match.line}`}
                type="button"
                className={css.match}
                onClick={() => { onOpenFile(hit.path, match.line) }}
              >
                <span className={css.line}>{match.line}</span>
                <span className={css.preview}>{match.preview}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
