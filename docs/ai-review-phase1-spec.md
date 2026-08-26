# Phase 1 spec: AI review on `CodeEditor`, measured

The previous document argued that ordinary-file review is nearly free because
`@codemirror/merge` is already wired in. Before anyone writes the ~80 lines, I
drove the real library with a real `EditorView` in jsdom and answered the
questions an implementer will hit. **Two of the answers contradict what the
previous document (and its review) assumed.** Those come first.

---

## 1. Corrections

### 1.1 Accept does NOT change the document — so `Ctrl+Z` cannot undo it

Measured:

```
start        : chunks = 2  | baseline = "a\nb\nc\nd\n"
acceptChunk  : doc changed = false | chunks = 1 | baseline = "a\nB-CHANGED\nc\nd\n"
undo         : chunks = 1  | doc = "a\nB-CHANGED\nc\nd\n"     ← nothing happened
```

The reasoning is obvious once seen: **the AI's text is already in the document.**
Accepting a hunk does not insert anything — it advances the *baseline* so that
hunk stops being a difference. There is no document change, so the history plugin
has nothing to revert.

Reject is the opposite, and behaves exactly as hoped:

```
rejectChunk  : doc changed = true  | doc = "a\nb\nc\nd\n" | chunks = 0
undo         : true | doc back to the AI text = true | chunks = 1   ← fully restored
```

So the earlier claim — "we apply hunks as ordinary transactions, so native undo
already does the right thing, no `Ctrl+Z` rebinding needed" — is **half right**.
It holds for reject. It does not hold for accept, in either editor: the same
asymmetry will appear in the TipTap design, because there too the AI text is
already in the document and accept is a baseline advance.

`dsh-vscode-review` shipped an explicit `dshReview.undoLast` command and rebound
`Ctrl+Z` in review mode. That was the right call, not a workaround for a VS Code
limitation. **Phase 1 needs an explicit "undo last review action".**

### 1.2 The way to undo an accept is to re-arm the compartment

The obvious API does not do it:

```
accept                              → chunks 1, baseline advanced
updateOriginalDoc.of({ doc, changes: ChangeSet.empty(len) })
                                    → baseline text restored ✓ but chunks STILL 1 ✗
```

`updateOriginalDoc` moves the text but does not force a re-diff — the merge view
recomputes from the `changes` it is handed, and an empty ChangeSet says nothing
changed. Reconfiguring the compartment does force it:

```
comp.reconfigure(unifiedMergeView({ original: SNAPSHOT }))  → chunks back to 2 ✓
```

So the undo stack is a stack of baseline snapshots (strings), and undo re-arms
with the top of it. A full re-diff per undo click is irrelevant at that frequency.

---

## 2. Everything else, confirmed

| Question | Answer |
|---|---|
| Does compartment reconfigure arm the review? | Yes — `chunks = 2`, baseline preserved exactly |
| Does it disarm cleanly? | Yes — `cm-deletedChunk` and `cm-chunkButtons` both gone from the DOM |
| Is the editor still writable during review? | **Yes**, and chunks recompute as you type |
| Do accept/reject reach our `dispatchTransactions` hook? | Yes — exactly **1 transaction** each, so `registry.sync(path, state)` runs, the dirty flag updates and autosave arms, for free |
| Does the baseline auto-advance on accept? | Yes — the library implements `ReviewCore`'s semantics natively |
| Can `mergeControls` be styled and translated? | Yes — the function form returns our own element: labels `["Giu","Bo"]` and class `dsh-review-accept` both survived |

### 2.1 Gotcha: `getChunks` returns `null`, not `undefined`, when disarmed

```ts
getChunks(state) === undefined   // false even with no merge view — WRONG test
const chunks = getChunks(state)?.chunks ?? []   // right
```

An `=== undefined` guard silently reads a disarmed editor as armed.

### 2.2 CSS hooks the library emits

```
cm-changeGutter  cm-changedLineGutter  cm-deletedLineGutter
cm-deletedChunk  cm-deletedLine  cm-deletedText  cm-chunkButtons
```

Everything except the button labels can be themed from CSS alone; use the
`mergeControls` function form only for the labels and the button markup.

### 2.3 A second AI write while a review is open

```
baseline untouched → the new AI text simply shows up as additional chunks
```

Both behaviours are reachable and it is a product decision, not a technical one:

- **Cumulative** (do nothing): the review keeps the original pre-AI baseline, and
  everything the agent did across several writes is reviewed together. This is
  what a turn-level review wants.
- **Re-anchor** (`comp.reconfigure` with the new pre-write text): only the newest
  write is under review, and already-accepted work stays accepted.

Recommend cumulative, with the baseline anchored at the **first** AI write of a
turn, and a re-anchor only when the review is closed and reopened.

---

## 3. Phase 1 shape

### 3.1 One owner for `original`

`diffOriginal` currently has exactly one source
([Workbench.tsx:627](plugins/dsh-client-vscode-layout/src/client/workbench/Workbench.tsx:627)):
`diffOpen ? status.diskDoc : undefined`. Two drivers now want it and they mean
different things, so make the mode explicit rather than letting the last effect
win:

```ts
type DiffMode =
  | { kind: 'none' }
  /** Save preview: what is on disk vs what is in the buffer. */
  | { kind: 'unsaved'; baseline: Text }
  /** AI review: the pre-AI text vs the current buffer. */
  | { kind: 'ai-review'; baseline: Text; snapshots: Text[] }
```

`ai-review` outranks `unsaved`; while it is active the save-preview toggle is
disabled with a tooltip saying why. `snapshots` is the undo stack from §1.2.

### 3.2 What Phase 1 actually contains

| Piece | Notes |
|---|---|
| `DiffMode` state + one owner for `original` | replaces the `diffOpen` boolean |
| Re-arm on mode change | the existing `useEffect` on `diffOriginal` already does this; it just needs the new source |
| Review header | `n changes · Accept all · Reject all · Undo · ↑ ↓` — counts from `getChunks(state)?.chunks ?? []` |
| Accept all / Reject all | loop `acceptChunk` / `rejectChunk` over `getChunks`, pushing one baseline snapshot for the whole batch |
| Undo last review action | pop `snapshots`, `comp.reconfigure(unifiedMergeView({ original: popped }))` |
| `↑` / `↓` | `goToPreviousChunk` / `goToNextChunk`, already exported |
| Custom `mergeControls` | Vietnamese labels, our button classes |
| Close on empty | when `chunks.length === 0`, drop back to `{ kind: 'none' }` and save once |
| CSS | theme the seven `cm-*` classes with `--dsw-alias-*` tokens |

The "~80 lines" estimate was optimistic mostly because of the undo stack and the
header; **~200 lines is realistic**, still small.

### 3.3 Saving

Because accept is not a document change, an accept-only review never dirties the
buffer — the file on disk already holds the AI text and nothing needs writing.
Only **reject** dirties it. So:

- Reject → the existing autosave path handles it (the transaction already reaches
  `registry.sync`).
- Accept → no write needed; do not force one.
- Review closed → one `save(path)` if the buffer is dirty, and clear the mode.

And the prerequisite from the first audit still stands: autosave must be **frozen**
for a path while an AI write is in flight, or the 1200 ms timer flushes the pre-AI
buffer over the AI's write before the review can even open.

---

## 4. A Phase 2 result worth recording now

The TipTap design needs to diff two **arrays of block texts**, not two strings.
`@codemirror/merge`'s diff is character-based, so encode each distinct block as
one private-use character and diff those:

```ts
const enc = (blocks: readonly string[]) => blocks.map(t => {
  let c = ids.get(t)
  if (c === undefined) { c = String.fromCharCode(0xe000 + ids.size); ids.set(t, c) }
  return c
}).join('')
```

Verified against nine cases — edit / insert / delete / append / no-change /
whole-file-new / whole-file-gone / duplicate blocks / two separate edits — and it
maps back to block indices exactly.

**But it must use `diff()`, not `presentableDiff()`.** Measured:

| Input | `presentableDiff` | `diff` |
|---|---|---|
| `[a,b,c,d,e]` → `[A,b,c,D,e]` (2 blocks apart) | **1 hunk spanning [0,4)** | 2 hunks: `[0,1)` and `[3,4)` |
| same, 10 blocks apart | 2 hunks | 2 hunks |

`presentableDiff` coalesces changes separated by little unchanged text — good for
prose, wrong here, because with one character per block "little unchanged text"
means "a couple of untouched paragraphs". Using it would silently collapse two
distinct edits into one un-splittable hunk covering everything between them,
which destroys the per-hunk granularity the whole feature exists for.

Use `presentableDiff` for real text (the CodeMirror side, where the merge view
already calls it internally) and `diff` for the block-encoded side.

---

## 5. Tests to write with Phase 1

- Accept does not dirty the buffer; reject does.
- `getChunks(state)?.chunks ?? []` is empty after disarming (guard against the
  `=== undefined` mistake).
- Undo after reject restores the AI text **and** brings the chunk back.
- Undo after accept restores the baseline and brings the chunk back — via the
  re-arm path, not `updateOriginalDoc`.
- Accept-all then undo returns every chunk in one step.
- The editor stays writable during review, and typing recomputes chunks.
- A second AI write mid-review adds chunks without losing accepted ones.
- `ai-review` mode disables the save-preview toggle rather than racing it.
- Autosave stays frozen for a path while an AI write is in flight.
