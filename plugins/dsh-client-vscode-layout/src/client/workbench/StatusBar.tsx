/**
 * Editor status bar: git branch, caret position, document size, language,
 * encoding, and the two toggles (auto-save, diff).
 *
 * Counts come from the buffer, not from a React copy of the text — the
 * registry holds the live `EditorState`, so `doc.lines` and `doc.length` are
 * already computed and cost nothing to read.
 */
import type { CursorInfo } from './CodeEditor.tsx'
import css from './StatusBar.module.css'

/** Status bar props. */
export interface StatusBarProps {
  /** Current git branch, or undefined outside a repository. */
  branch: string | undefined
  cursor: CursorInfo | undefined
  /** Total lines in the open document. */
  lines: number | undefined
  /** Total characters in the open document. */
  characters: number | undefined
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
  branch, cursor, lines, characters, language, readOnly,
  autoSave, onToggleAutoSave, diffOpen, onToggleDiff, saveState,
}: StatusBarProps) {
  return (
    <div className={css.bar}>
      {branch !== undefined && <span className={css.item} title="Current git branch">⑂ {branch}</span>}

      {cursor !== undefined && (
        <span className={css.item} title="Line and column">
          Ln {cursor.line}, Col {cursor.column}
          {cursor.selected > 0 && ` (${cursor.selected} selected)`}
        </span>
      )}

      {lines !== undefined && characters !== undefined && (
        <span className={css.item}>{lines} lines · {characters} chars</span>
      )}

      <span className={css.spacer} />

      {readOnly && <span className={css.badge} title="File was truncated by the host and cannot be saved">Read-only</span>}

      {saveState === 'saving' && <span className={css.item}>Saving…</span>}
      {saveState === 'saved' && <span className={css.item}>Saved ✓</span>}
      {typeof saveState === 'object' && <span className={css.error} title={saveState.error}>Save failed</span>}

      {onToggleDiff !== undefined && (
        <button
          type="button"
          className={css.toggle}
          data-on={diffOpen || undefined}
          aria-pressed={diffOpen}
          title="Compare with the file on disk"
          onClick={onToggleDiff}
        >
          Diff
        </button>
      )}

      <button
        type="button"
        className={css.toggle}
        data-on={autoSave || undefined}
        aria-pressed={autoSave}
        title={autoSave ? 'Auto-save is on' : 'Auto-save is off'}
        onClick={onToggleAutoSave}
      >
        Auto-save
      </button>

      {language !== undefined && <span className={css.item}>{language}</span>}
      <span className={css.item}>UTF-8</span>
    </div>
  )
}
