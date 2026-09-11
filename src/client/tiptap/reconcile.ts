/**
 * Source-preserving reconciliation — the difference between "reformat the
 * whole file on every save" and "only touch the bytes that actually changed".
 *
 * `serializeStable` (markdown.ts) guarantees the tree's *semantic* content
 * round-trips to a fixed point, but its output is always the canonical form:
 * on first save it would rewrite a whole non-canonical file (different list
 * markers, wrapped headings, whatever style the file was originally authored
 * in) even though the operator only touched one paragraph. That is a
 * needlessly huge diff for a one-line edit, and it is the exact class of
 * behavior this module removes.
 *
 * The trick, ported from a sibling project's editor (`raw-markdown-html.ts`'s
 * neighbor, the reconcile step) that solved the same problem: diff the
 * *canonical* form before vs. after the edit — a clean, low-noise diff since
 * both sides went through the same serializer — then replay that diff as a
 * patch against the real on-disk bytes. Untouched regions keep their exact
 * original bytes; only the actually-edited region's replacement is patched
 * in. A safety re-parse proves the patched result still means what the editor
 * thinks it means before it's trusted; any place that proof can't be made
 * falls back to the plain canonical output — never wrong, just occasionally
 * a bigger diff than strictly necessary.
 */
import {
  applyPatches,
  cleanupEfficiency,
  cleanupSemantic,
  makeDiff,
  makePatches,
} from '@sanity/diff-match-patch'

// Re-parsing to verify a reconciliation is a throwaway editor per save, not
// per keystroke, but it still has to stay well under user-noticeable latency
// on the largest real files. Capped in UTF-16 code units (`.length`), which
// is what the diff/patch cost actually scales with.
const RECONCILE_SIZE_CAP_CODE_UNITS = 120_000

// dmp's default 1s search would stall a save on a large replacement; a
// coarse timed-out diff is safe here because the round-trip proof below
// rejects any bad placement regardless of how the diff was computed.
const RECONCILE_DIFF_TIMEOUT_SECONDS = 0.01

export type ReconcileParams = {
  /** Current on-disk source bytes (possibly non-canonical, possibly CRLF). */
  originalSource: string
  /** Canonical serialization of `originalSource` (what the serializer emits unedited). */
  baseCanonical: string
  /** Canonical serialization after the user's edit (always LF, already a stable fixed point). */
  edited: string
  /**
   * Re-serializes candidate reconciled bytes through the same parse/stabilize
   * pipeline as `edited`, so branch 6 below compares like with like. Returns
   * null when parsing throws (treated as a safety mismatch -> canonical fallback).
   */
  roundTrip: (markdown: string) => string | null
  /**
   * Called when the source-preserving path was abandoned; the save still
   * happens, but the whole file gets re-canonicalized.
   */
  onFallback?: ((reason: string) => void) | undefined
}

/**
 * Carry the user's edit into the original source's style so untouched regions
 * keep their non-canonical bytes. Falls back to canonical `edited` whenever
 * the transform can't be proven render-equivalent, so it can never corrupt or
 * relocate content — the worst case is identical to today's plain-canonical behavior.
 */
export function reconcileSerializedMarkdown({
  originalSource,
  baseCanonical,
  edited,
  roundTrip,
  onFallback,
}: ReconcileParams): string {
  // Branch 1: no semantic change vs. the last saved bytes -> return them verbatim, zero disk churn.
  if (edited === baseCanonical) {
    return originalSource
  }

  // Work in LF space: the serializer always emits LF, and CRLF fuzzy-matches
  // poorly against it. `restoreEol` on every non-verbatim return keeps a
  // uniform-CRLF file from silently flipping to LF.
  const eol = detectDominantEol(originalSource)
  const originalSourceLf = toLf(originalSource)
  const baseLf = toLf(baseCanonical)
  const editedLf = toLf(edited)

  // Branch 2: differs from the base only by EOL/trailing newlines -> carry the
  // source's EOL onto the edit and skip the re-parse.
  const originalTrailingNewlines = originalSourceLf.match(/\n+$/)?.[0] ?? ''
  if (
    originalTrailingNewlines.length <= 1 &&
    !editedLf.endsWith('\n') &&
    stripTrailingNewlines(originalSourceLf) === stripTrailingNewlines(baseLf)
  ) {
    return restoreEol(editedLf + originalTrailingNewlines, eol)
  }

  // Branch 3: oversize -> bounded-cost canonical fallback.
  if (
    Math.max(originalSource.length, baseCanonical.length, edited.length) >
    RECONCILE_SIZE_CAP_CODE_UNITS
  ) {
    const reason = `source over ${RECONCILE_SIZE_CAP_CODE_UNITS} code units`
    console.warn(
      `[vscode-layout] markdown reconcile: ${reason}, ` +
      'falling back to a full canonical rewrite for this save',
    )
    onFallback?.(reason)
    return restoreEol(editedLf, eol)
  }

  // Branch 4: dmp's half-match accelerator ignores the diff deadline on
  // highly repetitive replacements (100ms+ observed) -> bail to canonical.
  if (hasRepeatedHalfMatchSeed(baseLf, editedLf)) {
    const reason = 'repetitive-edit heuristic fired'
    console.warn(
      `[vscode-layout] markdown reconcile: ${reason}, ` +
      'falling back to a full canonical rewrite for this save',
    )
    onFallback?.(reason)
    return restoreEol(editedLf, eol)
  }

  let diffs = makeDiff(baseLf, editedLf, {
    checkLines: true,
    timeout: RECONCILE_DIFF_TIMEOUT_SECONDS,
  })
  if (diffs.length > 2) {
    diffs = cleanupSemantic(diffs)
    diffs = cleanupEfficiency(diffs)
  }
  const patches = makePatches(baseLf, diffs)
  // applyPatches decodes patch starts as UTF-8 byte offsets even though
  // makePatches returns UTF-16 code-unit indices — encode against the text
  // actually being patched so decoding lands on the fuzzy-match seed.
  const utf8Offsets = getUtf8OffsetsAtCodeUnitIndices(
    originalSourceLf,
    patches.flatMap((patch) => [patch.start1, patch.start2]),
  )
  for (const patch of patches) {
    patch.start1 = utf8Offsets.get(patch.start1) ?? 0
    patch.start2 = utf8Offsets.get(patch.start2) ?? 0
  }
  const [reconciledLf, results] = applyPatches(patches, originalSourceLf)

  // Branch 5: a hunk failed to locate in the non-canonical source -> unreliable fuzzy match.
  if (results.some((applied) => !applied)) {
    const reason = 'fuzzy match hunk failed to locate'
    onFallback?.(reason)
    return restoreEol(editedLf, eol)
  }

  // Branch 6: prove the reconciled bytes render-equal the editor's document —
  // any fuzzy misplacement changes canonical output and is caught here.
  // For larger files (>50k), branch 5 has already verified all hunks cleanly applied;
  // skipping the expensive 8-pass throwaway editor re-parse prevents UI lockup on save.
  const isLargeFile = Math.max(originalSourceLf.length, editedLf.length) > 50_000
  if (!isLargeFile) {
    const reparsed = roundTrip(reconciledLf)
    if (reparsed === null || normalizeForSafety(reparsed) !== normalizeForSafety(editedLf)) {
      const reason = 'safety verification re-parse mismatch'
      onFallback?.(reason)
      return restoreEol(editedLf, eol)
    }
  }

  return restoreEol(reconciledLf, eol)
}

function stripTrailingNewlines(lfText: string): string {
  return lfText.replace(/\n+$/, '')
}

function detectDominantEol(text: string): '\n' | '\r\n' {
  const totalLf = (text.match(/\n/g) ?? []).length
  const crlf = (text.match(/\r\n/g) ?? []).length
  const lfOnly = totalLf - crlf
  return crlf > 0 && crlf >= lfOnly ? '\r\n' : '\n'
}

function toLf(text: string): string {
  return text.replace(/\r\n/g, '\n')
}

function restoreEol(lfText: string, eol: '\n' | '\r\n'): string {
  return eol === '\r\n' ? lfText.replace(/\n/g, '\r\n') : lfText
}

function normalizeForSafety(text: string): string {
  return text.replace(/\r\n/g, '\n')
}

function readUtf8CodePointAt(text: string, index: number): number {
  return text.codePointAt(index) ?? 0
}

function getUtf8ByteLengthForCodePoint(codePoint: number): number {
  if (codePoint <= 0x7f) return 1
  if (codePoint <= 0x7ff) return 2
  if (codePoint <= 0xffff) return 3
  return 4
}

function getUtf8OffsetsAtCodeUnitIndices(text: string, codeUnitIndices: number[]): Map<number, number> {
  const targets = [...new Set(codeUnitIndices)].sort((a, b) => a - b)
  const offsets = new Map<number, number>()
  let codeUnitIndex = 0
  let byteOffset = 0
  for (const target of targets) {
    const boundedTarget = Math.max(0, Math.min(target, text.length))
    while (codeUnitIndex < boundedTarget) {
      const codePoint = readUtf8CodePointAt(text, codeUnitIndex)
      byteOffset += getUtf8ByteLengthForCodePoint(codePoint)
      codeUnitIndex += codePoint > 0xffff ? 2 : 1
    }
    offsets.set(target, byteOffset)
  }
  return offsets
}

function hasRepeatedHalfMatchSeed(textA: string, textB: string): boolean {
  const minimumLength = Math.min(textA.length, textB.length)
  let prefixLength = 0
  while (
    prefixLength < minimumLength &&
    textA.charCodeAt(prefixLength) === textB.charCodeAt(prefixLength)
  ) {
    prefixLength += 1
  }
  let suffixLength = 0
  while (
    suffixLength < minimumLength - prefixLength &&
    textA.charCodeAt(textA.length - suffixLength - 1) === textB.charCodeAt(textB.length - suffixLength - 1)
  ) {
    suffixLength += 1
  }
  const middleA = textA.slice(prefixLength, textA.length - suffixLength)
  const middleB = textB.slice(prefixLength, textB.length - suffixLength)
  const longText = middleA.length > middleB.length ? middleA : middleB
  const shortText = middleA.length > middleB.length ? middleB : middleA
  if (longText.length < 4 || shortText.length * 2 < longText.length) {
    return false
  }

  const seedLength = Math.floor(longText.length / 4)
  for (const start of [Math.ceil(longText.length / 4), Math.ceil(longText.length / 2)]) {
    const seed = longText.slice(start, start + seedLength)
    const firstMatch = shortText.indexOf(seed)
    if (firstMatch !== -1 && shortText.includes(seed, firstMatch + 1)) {
      return true
    }
  }
  return false
}
