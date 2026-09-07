# AI Review — implementation handoff

**Audience:** the agent finishing this feature. **Status:** the feature is
already ~70% built and committed (`1723a8c`). This document is not a
build-from-scratch spec — it is the list of **measured invariants you must not
break**, the **bugs found by auditing the committed code**, and the **work that
remains**, in priority order.

Read §1 before touching anything. Every claim in it was produced by running the
real libraries, not by reading them. Several contradict what looks obvious.

Background research, in case you need the reasoning behind a rule:
`docs/ai-external-edit-audit.md`, `docs/ai-inline-review-research.md`,
`docs/ai-review-plugins-comparison.md`, `docs/ai-review-build-vs-borrow.md`,
`docs/ai-review-phase1-spec.md`.

---

## 1. Ground truth — do not "fix" these

### 1.1 Accept does NOT modify the document. Only the baseline moves.

Measured with a real `EditorView`:

```
start        : chunks = 2  | baseline = "a\nb\nc\nd\n"
acceptChunk  : doc changed = FALSE | chunks = 1 | baseline = "a\nB-CHANGED\nc\nd\n"
```

The AI's text is already in the document. Accepting a hunk advances the
*baseline* so that hunk stops being a difference. Consequences:

- **Native `Ctrl+Z` cannot undo an accept.** There is no document change in the
  history to revert. Verified: `undo()` after an accept leaves both the doc and
  the chunk count unchanged.
- **An accept-only review never dirties the buffer.** Disk already holds the AI
  text. Do not force a save on accept.
- The same asymmetry applies to the TipTap side, for the same reason.

Reject is the opposite and behaves normally:

```
rejectChunk  : doc changed = TRUE | chunks = 0
undo         : doc back to the AI text = TRUE | chunks = 1   ← fully restored
```

So **reject dirties the buffer and is natively undoable; accept does neither.**

### 1.2 Undoing an accept requires re-arming the compartment

```
updateOriginalDoc.of({ doc, changes: ChangeSet.empty(len) })
   → baseline text restored ✓   but chunks STAY at the post-accept count ✗
comp.reconfigure(unifiedMergeView({ original: SNAPSHOT }))
   → chunks correctly recomputed ✓
```

`updateOriginalDoc` does not force a re-diff. The committed `undoReview` already
uses `reconfigure` — **keep it that way.**

### 1.3 `getChunks` returns `null`, not `undefined`, when disarmed

`getChunks(state) === undefined` is a false negative. Always
`getChunks(state)?.chunks ?? []`. The committed code is correct here.

### 1.4 Block diffs must use `diff()`, never `presentableDiff()`

`blockMap.ts` encodes each block as one private-use character. `presentableDiff`
coalesces changes separated by little unchanged text, which at one char per block
means "a couple of untouched paragraphs":

| Input | `presentableDiff` | `diff` |
|---|---|---|
| `[a,b,c,d,e]` → `[A,b,c,D,e]` | **1 hunk spanning [0,4)** | 2 hunks `[0,1)`, `[3,4)` |

The committed `blockMap.ts` imports `diff`. **Do not change it to
`presentableDiff` for "nicer" hunks.**

### 1.5 Facts the TipTap side depends on (all measured)

- Serializing each top-level node separately and joining with a blank line
  reproduces the whole document — verified for headings, paragraphs, lists,
  nested lists, task lists, code blocks, tables, blockquotes, and `rawHtmlLine`.
- The block → line-range map is exact.
- One block replaced via `tr.replaceWith` leaves the rest of the document
  byte-identical, and native undo restores it.
- **A fragment parsed in a throwaway editor belongs to a different schema
  instance and splices in as EMPTY, silently.** It must be rebuilt:
  `editor.schema.nodeFromJSON(tmp.state.doc.toJSON()).content`.
- ProseMirror node identity survives edits (49/50 nodes unchanged after one
  edit), so the `WeakMap` cache in `blockMap.ts` is sound. Cold cost is real:
  ~0.44 ms per block (178 ms for 400 blocks), versus 3 ms to serialize the whole
  document. Never rebuild the whole map on a keystroke.

---

## 2. What is already built (do not rewrite)

| File | Contains |
|---|---|
| `workbench/saveQueue.ts` | `hold` / `release` / `isHeld`; `enqueue` and `reconcileAutosave` both respect holds |
| `workbench/CodeEditor.tsx` | `DiffMode`, baseline snapshot stack, `acceptAll` / `rejectAll` / `undoReview` / `nextChunk` / `prevChunk`, Vietnamese `mergeControls`, stats via `dispatchTransactions` |
| `workbench/ReviewHeader.tsx`, `FloatingReviewBar.tsx` | review chrome |
| `tiptap/blockMap.ts` | block ↔ line mapping, `diff`-based block hunks |
| `tiptap/TipTapReviewPlugin.ts` | decorations, per-hunk buttons, `acceptSingleHunk` / `rejectSingleHunk` |
| `chat/TurnReviewCard.tsx` | the `conversation.chat.turnTail` card |
| `client/index.ts` | capture: subscribes to the session snapshot, drains `tool-result` nodes |
| `workbench/Workbench.tsx` | `__dsh_start_ai_review` / `__dsh_stop_ai_review` / `__dsh_hold_autosave` / `__dsh_release_autosave` |

---

## 3. Bugs found in the committed code

### P0-1 — An `edit` tool destroys the buffer

**Where:** `client/index.ts:357-367` → `workbench/Workbench.tsx:415-455`.

`index.ts` passes the diff hunk's `oldText` / `newText` straight through:

```ts
;(window as any).__dsh_start_ai_review?.(absPath, hunk.oldText ?? '', hunk.newText)
```

and `Workbench.tsx` treats them as whole-file content:

```ts
let effectiveBaseline = baseline                       // ← hunk fragment
registry.setText(targetPath, newContent, { addToHistory: false })   // ← REPLACES THE WHOLE BUFFER
```

The host's own documentation for these views says the settled result carries
**"the applied contextual hunks … (an edit's real before/after, a create's
whole-file diff)"**. So for `write`/`create` the payload is the whole file and
this happens to work — but for **`edit` it is a fragment**, and
`registry.setText(path, fragment)` replaces the entire open buffer with just the
changed lines. Everything else in the file disappears from the editor, and any
subsequent save writes that truncation to disk.

**Fix.** Never derive file content from a hunk. Instead:

1. Read the file's real current content after the tool ran — `readFile(path)`
   (it is already imported in `Workbench.tsx`) or `registry.reload(path)`. That
   is the AI's result, authoritatively.
2. Derive the baseline by *reversing* the hunks against that content: for each
   hunk, replace the first occurrence of `newText` with `oldText`. If a hunk's
   `newText` is not found, the baseline cannot be reconstructed — fall back to
   the buffer's `diskDoc`/pre-write text and log it.
3. Only `create` (`oldText === null`) uses the empty string as the baseline.

Signature change: `__dsh_start_ai_review(path, hunks: {oldText, newText}[])`
rather than `(path, baseline, newContent)`.

### P0-2 — Subagent writes are invisible

**Where:** `client/index.ts:352`.

```ts
for (const node of snap.nodes ?? []) {
  if (node.kind !== 'tool-result') continue
```

`ToolResultNode.subCalls` holds the calls a subagent made. Nothing walks it, so
every file a subagent writes is missed entirely — no hold, no review, and the
stale buffer can still be autosaved over it.

**Fix.** Recurse:

```ts
function* eachToolResult(nodes: readonly any[]): Generator<any> {
  for (const node of nodes ?? []) {
    if (node?.kind !== 'tool-result') continue
    yield node
    yield* eachToolResult(node.subCalls ?? [])
  }
}
```

Use it in both the running-call scan and the settled scan.

### P0-3 — A hold is never released when a tool call fails or is cancelled

**Where:** `client/index.ts:337-349` (hold) and `:359, :382` (release).

`__dsh_hold_autosave` is called for every running call that names a path.
`release` only happens on the **settled-with-a-write** path. A call that errors,
is cancelled, or settles without a diff leaves the path held **forever** — the
user types, nothing autosaves, no error is shown. `enqueue` also returns `false`
for held paths, so a manual `Ctrl+S` silently does nothing too.

**Fix.** Track held paths per callId and release on *any* settlement:

```ts
const heldByCall = new Map<string, string[]>()   // callId -> paths
// on running: heldByCall.set(callId, paths); hold(each)
// on ANY settled node with that callId (error or not): release(each); heldByCall.delete(callId)
```

Also release everything still held when the turn ends (`snap.running === false`)
and in the effect's disposer, as a backstop.

### P1-1 — Multiple hunks in one file reset each other

**Where:** `client/index.ts:358-366`.

```ts
for (const hunk of diffs) { … __dsh_start_ai_review(absPath, …) }
```

An edit with three hunks in one file calls `start_ai_review` three times, and each
call overwrites `diffModes[path]` with a fresh `{ snapshots: [] }`. Group the
hunks by path first and call once per path.

### P1-2 — A second AI write discards the first review's baseline

**Where:** `workbench/Workbench.tsx:452-455`.

`setDiffModes` unconditionally installs a new `ai-review` entry. If a review is
already open for that path, its baseline (and its undo stack) is thrown away, so
already-accepted hunks come back as changes.

**Fix.** If `prev[targetPath]?.kind === 'ai-review'`, keep the existing baseline
and snapshots; only adopt the new content. The baseline should be anchored at the
**first** AI write of a turn (cumulative review), as decided in
`docs/ai-review-phase1-spec.md` §2.3.

### P1-3 — `rejectAll` does not push a baseline snapshot

**Where:** `workbench/CodeEditor.tsx:146-155`.

`acceptAll` calls `onBeforeAccept()`; `rejectAll` does not. `canUndo` is derived
from the snapshot stack length, so after a Reject All the header shows nothing to
undo — even though the rejection is a real document change.

**Fix.** Reject is natively undoable, so the correct fix is to make the header's
Undo button mean one thing. Simplest: push a snapshot in `rejectAll` too and have
`undoReview` first try `undo(view)` and fall back to re-arming. Whichever you
choose, `canUndo` must reflect it.

### P1-4 — Markdown review reopens the TipTap document

**Where:** `workbench/Workbench.tsx:441-445`.

```ts
documents.reopen(targetPath, freshBuffer.state.doc.toString())
```

`reopen` is documented in `tiptap/documents.ts` as throwing away undo history; it
also loses the caret, the scroll position, and every heading's fold state. Doing
it on every AI write drops the user to the top of the document.

This is acceptable *only* as the interim step. The real path is
`blockMap.ts` + `replaceBlocks` (§4.2). Until then, at minimum restore the scroll
position and note the limitation in the review header.

### P2-1 — Windows paths are treated as relative

`target.startsWith('/')` is the only absolute-path test, so `C:\...` gets the cwd
prefixed onto it. Low priority for this deployment, but it is a one-line guard.

### P2-2 — Holds are re-issued on every snapshot

The running-call loop calls `hold(path)` on every republish (many per second
while streaming). `Set.add` makes it harmless, but the `heldByCall` map from
P0-3 removes the churn anyway.

---

## 4. Remaining work

### 4.1 Close the loop

- Call `__dsh_stop_ai_review(path)` automatically when the chunk count reaches 0.
  `CodeEditor` already reports stats through `onReviewStatsChange`; `Workbench`
  should act on `count === 0` by clearing the mode and saving once if dirty.
- Release the autosave hold when a review ends, not only when a write settles.
- Disable the save-preview toggle while `ai-review` is active
  (`Workbench.tsx:799` already partly does this) and give it a tooltip saying
  why.

### 4.2 TipTap: replace `reopen` with transactions

This is the last substantial piece and the payoff for `blockMap.ts`:

```
1. baseline blocks  = blockMap(reviewBaseEditor)        // pre-AI markdown
2. current blocks   = blockMap(liveEditor)
3. hunks            = blockHunks(baseline, current)     // diff(), §1.4
4. accept(hunk)     = advance the baseline only          // no transaction, §1.1
5. reject(hunk)     = tr.replaceWith(pos, pos+size, editor.schema.nodeFromJSON(...).content)
```

Rule: never call `documents.reopen` for an AI write once this lands.

Markdown text on either side must go through the existing pipeline —
`splitFrontmatter` then `encodeRawHtmlLines` then parse — or frontmatter and
opaque lines (`<!-- -->`, `[^1]:`) are destroyed. **Frontmatter is excluded from
the tree entirely, so a frontmatter-only change is invisible to a block diff**
and needs its own one-block hunk.

### 4.3 Guards

- Skip review and fall back to whole-file adopt above ~120 KB (the same
  threshold `reconcile.ts` already uses).
- Cap the snapshot stack (say 50) so a long session cannot grow it unbounded.

---

## 5. Tests to add

Regression, in rough priority order:

1. **P0-1**: an `edit`-shaped payload (fragment `oldText`/`newText`) against a
   200-line file leaves the buffer at 200 lines, not at the fragment's length.
2. **P0-3**: a tool call that errors releases its hold; `saveQueue.isHeld` is
   false afterwards and a manual save succeeds.
3. **P0-2**: a hunk nested in `subCalls` starts a review.
4. Accept does not dirty the buffer; reject does.
5. `getChunks(state)?.chunks ?? []` is empty after disarming.
6. Undo after reject restores the AI text **and** brings the chunk back.
7. Undo after accept restores the baseline and the chunk — via re-arm, not
   `updateOriginalDoc`.
8. Two hunks in one file produce one review with two chunks, not two reviews.
9. A second AI write mid-review keeps already-accepted hunks accepted.
10. `blockMap`: `[a,b,c,d,e] → [A,b,c,D,e]` yields **2** hunks.
11. Markdown with frontmatter and opaque lines survives an accept-all round trip
    byte-for-byte.
12. Autosave stays frozen while a write is in flight and resumes after.

The existing harness pattern is `tests/*.test.ts` with jsdom; for CodeMirror
tests, `window.requestAnimationFrame` must be shimmed or `new EditorView` throws.

---

## 6. Do not

- Do not make accept dispatch a document change to "make Ctrl+Z work". It would
  rewrite the file with text it already contains and produce a spurious dirty
  flag. Use the snapshot stack.
- Do not use `presentableDiff` for block arrays (§1.4).
- Do not test `getChunks(...) === undefined` (§1.3).
- Do not parse replacement markdown in a throwaway editor and splice the fragment
  directly — rebuild it in the live schema (§1.5).
- Do not call `documents.reopen` on an AI write once §4.2 lands.
- Do not derive file content from a diff hunk (§P0-1).
- Do not remove the autosave hold; it is the only thing preventing the 1200 ms
  timer from flushing a stale buffer over the AI's write.
