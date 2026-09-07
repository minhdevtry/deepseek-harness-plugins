/**
 * Reconstruct a file's pre-write text from its post-write content and the
 * hunks a tool reported for it.
 *
 * `write`/`edit` settle with real contextual `FileDiff` hunks (see
 * `@deepseek-ai/dsh-tools`'s `presentation.d.ts`): a fragment with genuine
 * context on both sides for an edit, or for an overwrite of a file that
 * already existed (`computeHunkDiffs` runs identically for both) — and a
 * single whole-file hunk with `oldText: null` for a genuine create, the one
 * case with nothing to diff against.
 *
 * Reversing each hunk against the known-current content — replace the first
 * occurrence of `newText` with `oldText ?? ''` — recovers the baseline
 * without needing to know which case produced the hunks: a create's one hunk
 * reverses its `newText` (the whole file) to `''`, and an edit's or an
 * overwrite's fragments each reverse back to what that region read before.
 *
 * Hunks are reversed in the order given (the host reports them in file
 * order), each search starting from wherever the previous replacement left
 * off — so two hunks that happen to share identical `newText` still resolve
 * to the correct, non-overlapping occurrences.
 */
export interface HunkPair {
  oldText: string | null
  newText: string
}

export interface ReconstructResult {
  /** The reconstructed text — a best-effort partial reconstruction when `ok` is false. */
  text: string
  /** False if some hunk's `newText` could not be located in the text built so far. */
  ok: boolean
}

/**
 * @param postWriteContent - the file's actual current (post-write) content.
 * @param hunks - the hunks reported for this path, in file order.
 * @returns the reconstructed pre-write text, and whether every hunk reversed cleanly.
 */
export function reconstructBaseline(postWriteContent: string, hunks: readonly HunkPair[]): ReconstructResult {
  let text = postWriteContent
  let ok = true
  for (const hunk of hunks) {
    // An empty newText matches at every position (String.indexOf('') === 0),
    // which would splice oldText in arbitrarily. There is nothing coherent
    // to reverse for such a hunk, so it is left as-is.
    if (hunk.newText === '') continue
    const idx = text.indexOf(hunk.newText)
    if (idx === -1) {
      ok = false
      break
    }
    const replacement = hunk.oldText ?? ''
    text = text.slice(0, idx) + replacement + text.slice(idx + hunk.newText.length)
  }
  return { text, ok }
}
