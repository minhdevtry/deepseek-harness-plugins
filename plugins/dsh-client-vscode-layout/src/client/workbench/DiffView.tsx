/**
 * Unified diff banner between the file on disk and the unsaved buffer.
 *
 * Sits above the live editor while per-hunk inline diffs (unifiedMergeView with
 * mergeControls: true) are active in the CodeEditor.
 */
import type { Text } from '@codemirror/state'
import css from './DiffView.module.css'

/** Diff view props. */
export interface DiffViewProps {
  path: string
  /** The document as it stands on disk — the left-hand side. */
  diskDoc: Text
  /** The unsaved buffer — the right-hand side. */
  currentDoc: Text
  /** Write the buffer to disk. */
  onAccept: () => void
  /** Restore the disk text into the buffer (undoable in the editor). */
  onDiscard: () => void
  onClose: () => void
}

/** Added and removed line counts between two documents. */
export function countChanges(diskDoc: Text, currentDoc: Text): { added: number; removed: number } {
  const before = new Map<string, number>()
  for (let i = 1; i <= diskDoc.lines; i += 1) {
    const line = diskDoc.line(i).text
    before.set(line, (before.get(line) ?? 0) + 1)
  }
  let added = 0
  for (let i = 1; i <= currentDoc.lines; i += 1) {
    const line = currentDoc.line(i).text
    const remaining = before.get(line) ?? 0
    if (remaining > 0) before.set(line, remaining - 1)
    else added += 1
  }
  let removed = 0
  for (const remaining of before.values()) removed += remaining
  return { added, removed }
}

/** The diff banner surface. */
export function DiffView({ diskDoc, currentDoc, onAccept, onDiscard, onClose }: DiffViewProps) {
  const { added, removed } = countChanges(diskDoc, currentDoc)

  return (
    <div className={css.header}>
      <span className={css.title}>Changes against disk</span>
      <span className={css.added}>+{added}</span>
      <span className={css.removed}>−{removed}</span>
      <span className={css.spacer} />
      <button type="button" className={css.accept} onClick={onAccept}>Save changes</button>
      <button type="button" className={css.discard} onClick={onDiscard}>Discard</button>
      <button type="button" className={css.close} aria-label="Close diff" onClick={onClose}>✕</button>
    </div>
  )
}
