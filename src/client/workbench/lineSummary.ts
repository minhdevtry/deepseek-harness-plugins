/**
 * Real added/removed line counts between two whole-file texts.
 *
 * Uses `@codemirror/merge`'s own `Chunk.build` — the same machinery that
 * powers the gutter markers and the merge-view highlighting — against plain
 * `Text` objects. No `EditorView` (or any DOM) is needed, so this is cheap
 * enough to run for a file that is not even open, which is exactly the case
 * the in-chat per-turn summary needs: `TurnReviewCard` shows counts for
 * every file a turn touched, most of which the operator never opened.
 */
import { Text } from '@codemirror/state'
import { Chunk } from '@codemirror/merge'

export interface LineSummary {
  added: number
  removed: number
}

/** Lines spanned by `[from, to)` in `text`, where `to === from` means none. */
function lineSpan(text: Text, from: number, to: number): number {
  if (to <= from) return 0
  return text.lineAt(to - 1).number - text.lineAt(from).number + 1
}

/**
 * @param baseline - the file's text before the change.
 * @param current - the file's text now.
 * @returns how many lines were added and removed between them.
 */
export function computeLineSummary(baseline: string, current: string): LineSummary {
  if (baseline === current) return { added: 0, removed: 0 }
  const textA = Text.of(baseline.split(/\r?\n/))
  const textB = Text.of(current.split(/\r?\n/))
  const chunks = Chunk.build(textA, textB)
  let added = 0
  let removed = 0
  for (const chunk of chunks) {
    removed += lineSpan(textA, chunk.fromA, chunk.toA)
    added += lineSpan(textB, chunk.fromB, chunk.toB)
  }
  return { added, removed }
}
