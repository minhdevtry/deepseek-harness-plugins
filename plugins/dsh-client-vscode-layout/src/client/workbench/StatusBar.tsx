/**
 * Editor status bar: git branch, caret position, document size, language,
 * encoding, and the two toggles (auto-save, diff).
 *
 * Counts come from the buffer, not from a React copy of the text — the
 * registry holds the live `EditorState`, so `doc.lines` and `doc.length` are
 * already computed and cost nothing to read.
 */
import type { CursorInfo } from './CodeEditor.tsx'
import { Tooltip, Spinner } from '../ui/primitives/index.ts'
import css from './StatusBar.module.css'

/** Status bar props. */
export interface StatusBarProps {
  /** Current git branch, or undefined outside a repository. */
  branch: string | undefined
  cursor: CursorInfo | undefined
  /** Total lines in the open document (text mode). */
  lines: number | undefined
  /** Total characters in the open document. */
  characters: number | undefined
  /** Total words in the open document (markdown mode). */
  words?: number | undefined
  /** Estimated reading time in minutes. */
  readingTime?: number | undefined
  language: string | undefined
  /** True when the buffer opened read-only (host truncated it). */
  readOnly: boolean
  autoSave: boolean
  onToggleAutoSave: () => void
  diffOpen: boolean
  /** Undefined when there is nothing to compare — a clean or absent buffer. */
  onToggleDiff: (() => void) | undefined
  /** Transient save state shown at the right. */
  saveState: 'idle' | 'saving' | 'saved' | { error: string }
}

/** The editor status bar (see module doc). */
export function StatusBar({
  branch, cursor, lines, characters, words, readingTime, language, readOnly,
  autoSave, onToggleAutoSave, diffOpen, onToggleDiff, saveState,
}: StatusBarProps) {
  return (
    <div className={css.bar}>
      {branch !== undefined && (
        <Tooltip content="Current Git branch" placement="top">
          <span className={css.item}>⑂ {branch}</span>
        </Tooltip>
      )}

      {cursor !== undefined && (
        <Tooltip content="Line and column position" placement="top">
          <span className={css.item}>
            Ln {cursor.line}, Col {cursor.column}
            {cursor.selected > 0 && ` (${cursor.selected} selected)`}
          </span>
        </Tooltip>
      )}

      {words !== undefined && characters !== undefined ? (
        <Tooltip content="Document statistics" placement="top">
          <span className={css.item}>
            {words} {words === 1 ? 'word' : 'words'} · {characters} chars
            {readingTime !== undefined && ` · ~${readingTime} min read`}
          </span>
        </Tooltip>
      ) : lines !== undefined && characters !== undefined ? (
        <span className={css.item}>{lines} lines · {characters} chars</span>
      ) : null}

      <span className={css.spacer} />

      {readOnly && (
        <Tooltip content="File was truncated by the host and cannot be saved" placement="top">
          <span className={css.badge}>Read-only</span>
        </Tooltip>
      )}

      {saveState === 'saving' && (
        <span className={css.item} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Spinner size="xs" /> Saving…
        </span>
      )}
      {saveState === 'saved' && <span className={css.item}>Saved ✓</span>}
      {typeof saveState === 'object' && (
        <Tooltip content={saveState.error} placement="top">
          <span className={css.error}>Save failed</span>
        </Tooltip>
      )}

      {onToggleDiff !== undefined && (
        <Tooltip content="Compare with the file on disk" placement="top">
          <button
            type="button"
            className={css.toggle}
            data-on={diffOpen || undefined}
            aria-pressed={diffOpen}
            onClick={onToggleDiff}
          >
            Diff
          </button>
        </Tooltip>
      )}

      <Tooltip content={autoSave ? 'Auto-save is on' : 'Auto-save is off'} placement="top">
        <button
          type="button"
          className={css.toggle}
          data-on={autoSave || undefined}
          aria-pressed={autoSave}
          onClick={onToggleAutoSave}
        >
          Auto-save
        </button>
      </Tooltip>

      {language !== undefined && <span className={css.item}>{language}</span>}
      <span className={css.item}>UTF-8</span>
    </div>
  )
}
