# AI Review — overhaul plan

**Audience:** whoever implements this next. **Status:** produced by a six-lens
audit of the shipped code (`1723a8c`) — capture pipeline, CodeMirror merge
lifecycle, TipTap/markdown path, focus & data-loss, review UI/UX, and a
cross-cutting sweep — each finding independently re-verified against the real
source and the real `@codemirror/state`/`@codemirror/merge`/`prosemirror-view`
packages installed in this repo (several were reproduced with a live
`EditorView`, not inferred). 97 findings were raised, 91 survived verification,
6 were refuted. This document keeps only the 91.

This supersedes nothing in `docs/ai-review-implementation-handoff.md` — that
document's §1 measured invariants (accept is baseline-only, `diff()` not
`presentableDiff()`, `getChunks` returns `null` not `undefined`, a fragment
parsed in a throwaway editor splices in as empty) are still ground truth and
are restated in §6. What changed is that the "already built" table in that
document's §2 turns out to contain the actual root causes of all six reported
symptoms — this plan says which parts of "already built" have to be rebuilt,
and in what order.

---

## 1. Root-cause story

The six reported symptoms are two structural diseases wearing six costumes.

**Disease A — there is no durable review state, only a mount's memory of one.**
The real baseline lives in three different places depending on the moment you
ask: CodeMirror's internal `originalDoc`/`ChunkField` (advances on accept, per
handoff §1.1), the TipTap plugin's `baselineBlocks` (advances on accept, but
`baselineMarkdown`/`baseNodes` do not — see §1 below), and React's
`diffModes[path].baseline` (**never advances**, and is what every remount reads
from). Any event that unmounts the editor — a tab switch, a second AI write, a
markdown `reopen` — throws away the two engines' progress and re-arms from the
stale React copy. Compounding this, `CodeEditor`'s merge extensions are
appended to the registry-persisted `EditorState` via `StateEffect.appendConfig`
from a **new `Compartment` created per mount**; CodeMirror never removes the
previous mount's compartment, and its `StateField` resolution is
first-match-wins, so after one remount **every future `reconfigure()` on that
path is a silent no-op** — not just "reverts to the old baseline" but
structurally dead until the buffer closes.

**Disease B — cross-surface "accept"/"reject" are not real verbs.** The only
place a hunk can actually be resolved is the imperative handle
(`editorRef`/`tipTapRef`) of the *currently mounted, currently active* editor.
Everything outside the Workbench — the in-chat `TurnReviewCard`, and in
principle any future surface — can only reach two window globals,
`__dsh_stop_ai_review` (delete the diff-mode entry: hides the chrome, resolves
nothing) and `__dsh_revert_turn_file` (dispatch a revert transaction into
*whichever* editor happens to be mounted, which is frequently a different
file). "Accept all" in the chat is not a weaker accept — it is not an accept at
all.

| Symptom (as reported) | Direct cause(s) | Disease |
|---|---|---|
| 1. No per-turn accept/diff in chat | `turncard-accept-all-does-not-accept`, `no-per-turn-diff-in-chat-only-a-fake-plus`, `revert-turn-never-reaches-disk`, `reject-turn-never-reaches-disk`, `revert-turn-file-dispatches-into-wrong-editor` | B |
| 2. Accept button doesn't turn off | `remount-stacks-second-mergeview`, `reconfigure-dead-after-remount`, `stale-widget-closure-accept-noop`, `accept-reject-never-disabled-at-zero-chunks`, `review-bar-never-closes`, `onstatschange-never-wired`, `tiptap-baseline-resets-on-remount` | A |
| 3. Incorrect diff shown | `baseline-resolved-after-the-write`, `baseline-read-from-disk-after-ai-wrote`, `settext-never-reaches-live-editorview`, `serialize-block-drops-marks-and-structure`, `phantom-trailing-paragraph-hunk`, `block-serialization-drops-marks` | A (+ serializer bugs, new class) |
| 4. Bottom bar UI/UX is poor | `floating-bar-wrong-containing-block-in-markdown`, `insertion-hunk-buttons-unhoverable`, `no-multi-file-review-context-anywhere`, `three-vocabularies-for-two-actions`, `bar-covers-the-last-lines-and-has-no-scroll-padding`, `review-chrome-a11y-…`, `review-header-is-dead-code` | chrome design, independent of A/B |
| 5. AI write steals focus / destroys unsaved text | `editor-steals-focus-on-ai-open` (+ 3 duplicate lens confirmations), `ai-write-destroys-unsaved-edits-unrecoverably`, `reopen-destroys-unsaved-wysiwyg-edits`, `settext-never-reaches-live-editorview`, `hold-loop-reads-nonexistent-field` (autosave protection is dead code) | new class: no conflict policy, no focus policy |
| 6. "many more bugs" | the remaining ~60 findings: path-identity, IME/global-hotkey collisions, session-rebind replay, subagent-write blindness, performance freezes, dead code | assorted |

Two load-bearing facts the handoff did not have: **the autosave hold that is
supposed to protect an in-flight AI write never fires** —
`snap.runningCalls` elements are the flat `RunningToolCall` shape
(`{callId, name, argsRaw, …}`); the code reads `running.call?.argsRaw`, which
is `undefined` for every entry, so `__dsh_hold_autosave` has exactly one
caller in production and it never executes. And **`registry.setText` does not
reach the mounted `EditorView`** for the active tab — the view is the one that
calls `registry.sync` on every transaction, so an external `setText` is
silently reverted by the user's very next keystroke (or by the diff-mode
`useEffect` firing on the same commit). These two bugs explain why testers see
inconsistent results ("sometimes the diff looks right, sometimes it's empty,
sometimes the AI's write disappears") — the behavior is a race, not a
reproducible defect.

---

## 2. The architectural verdict

**This cannot be patched hunk-by-hunk. It needs one durable store.**

The evidence: every "Disease A" finding above is a distinct proof that
per-mount/per-component state cannot survive the events this feature is built
around (tab switches, multiple AI writes, cross-surface commands). Patching
each symptom (re-arm the baseline on remount, wire the missing stats callback,
disable the buttons at zero) fixes the visible complaint but leaves the same
architectural gap for the next surface that needs to touch a review — which is
exactly how the chat card degenerated into "hide the chrome" and "revert to
disk" instead of a real accept/reject.

**Recommendation: introduce a `ReviewStore`**, a plain class outside React —
the same shape this codebase already uses for `BufferRegistry` and
`SaveQueue` (`subscribe`/`getSnapshot`, no framework dependency, testable
without mounting anything). It is the single source of truth for "what is
under AI review right now," and every surface — `Workbench`, `CodeEditor`,
`TipTapEditor`, `TurnReviewCard`, the capture pipeline in `index.ts` — reads
and writes it through named methods, never through untyped `window.__dsh_*`
globals with positional string arguments.

### Shape

```ts
interface ReviewEntry {
  path: string              // normalized, absolute — see §3 T1-4
  turnId: string            // groups entries from one agent turn
  baseline: string          // the REAL current baseline — advances on every accept
  totalHunks: number
  resolvedHunks: number
  snapshots: string[]       // baseline history, for Undo
  status: 'reviewing' | 'done' | 'dismissed'
}

class ReviewStore {
  subscribe(listener: () => void): () => void
  getSnapshot(): ReadonlyMap<string, ReviewEntry>          // keyed by normalized path

  // capture pipeline calls this once per (turn, path) — never touches a buffer
  registerWrite(turnId: string, path: string, oldText: string | null, newText: string): void

  // called by whichever engine (CodeMirror/TipTap) actually performed the
  // accept/reject, immediately after — NOT by the UI directly
  advanceBaseline(path: string, newBaseline: string): void   // pushes a snapshot first
  markResolvedCount(path: string, resolved: number, total: number): void

  // the only entry points TurnReviewCard (or anything outside Workbench) uses
  acceptAll(path: string): Promise<void>   // delegates to the live handle if mounted, else
                                            // operates on registry+baseline directly
  rejectAll(path: string): Promise<void>
  dismiss(path: string): void               // status -> 'dismissed', chrome hides, hunks may remain unresolved (must confirm if resolvedHunks < totalHunks)

  entriesForTurn(turnId: string): ReviewEntry[]
}
```

CodeMirror and TipTap keep doing the actual diffing and rendering — this store
does not replace `unifiedMergeView` or the block-diff plugin. What it replaces
is `Workbench`'s `diffModes` `useState` map as the thing that survives a
remount, and it replaces the window-global seam as the thing other surfaces
call. Concretely:

- `CodeEditor`'s `updateStats` (already called from `dispatchTransactions`)
  additionally calls `reviewStore.advanceBaseline(path, getOriginalDoc(state).toString())`
  and `markResolvedCount`. This is the one-way sync that makes the store
  correct without CodeMirror ceding control of its own state.
- `TipTapReviewPlugin`'s `SET_BASELINE_BLOCKS` handler does the same after
  rebuilding all three baseline fields together (see T1-1).
- `Workbench` subscribes to `reviewStore` (`useSyncExternalStore`, the same
  pattern already used for `registry`/`documents`) instead of owning
  `diffModes` as local state. A remount reads the *current* baseline from the
  store, not a frozen one from props.
- `TurnReviewCard.acceptAll`/`.rejectAll` call `reviewStore.acceptAll(path)`
  directly. For the active tab this delegates to the mounted imperative
  handle (so the visible engine and the store move together); for a
  background tab it operates on `registry`/`documents` + the store without
  requiring a mount — which is also what finally makes "accept a review on a
  file you don't have open" possible.

### What this fixes structurally (not case-by-case)

- Tab switch / second AI write no longer resets progress, because the store
  — not a per-mount ref, not a `useState` snapshot frozen at diff-mode
  creation — is what every remount reads from.
- The chat card gets real verbs. "Accept all" advances baselines; "Reject
  all" reverts the buffer **and writes it to disk** (see T1-6), against the
  entry the store tracks — not the mounted editor's ref, so it cannot land in
  the wrong file.
- A path is only ever resolved once (T1-4) and the store is the only thing
  keyed by it, so the capture pipeline, `Workbench`, and `TurnReviewCard`
  cannot disagree about which file a command targets.

This is the one large structural change in this plan. Everything else below
is either a prerequisite for it (T0) or independent of it (T2 copy/layout, T3
serializer fidelity, T4 cleanup).

---

## 3. Fix plan

Ordered; each item is sized to be one commit. IDs from the audit are in
parens for traceability.

### Tier 0 — stop the data loss, make Accept safe to press

**T0-1. Fix the dead autosave hold.** `index.ts`'s running-call scan reads
`running.call?.argsRaw`; `RunningToolCall` has no `call` field, only a flat
`argsRaw`. One-line fix: read `running.argsRaw`. Ship together with the
handoff's own P0-3 (`heldByCall: Map<callId, path[]>`, released on *any*
settlement, not only a settled write) — fixing the read without that turns a
dead hold into a leaking one. *(`hold-loop-reads-nonexistent-field`)*
Test: feed a literal flat `RunningToolCall` through `drainSnapshot`, assert
`saveQueue.isHeld(path)`.

**T0-2. Gate the fallback capture branch on `!node.isError`, delete the
name-substring match.** Drive exclusively off `node.resultView?.card ===
'diff'` — the host's own "this call mutated files" signal. A cancelled/failed
call (Stop mid-edit) currently still matches on name and replaces the whole
open buffer with a fragment the agent never actually wrote; a read-only tool
whose name contains a trigger word hard-reloads the buffer for having merely
looked at the file. *(`name-match-fires-on-reads-and-failures`)*
Test: an `isError: true` node with a write-shaped name does not touch the
registry; a settled node with `resultView: null` and no diff card is a no-op,
not a reload.

**T0-3. Never adopt AI content into a dirty buffer/tree.** Before any
`registry.setText`/`documents.reopen` in the adopt path, check
`registry.isDirty(path) || documents.isDirty(path)`. If dirty: do **not**
overwrite. Stash the AI's `newText` on the (about to exist) `ReviewStore`
entry, `onNotify` the conflict, and require the user to explicitly choose
(a follow-up UI affordance, not silent adoption). This is the single fix for
the sharpest data-loss path in the whole audit — a user's unsaved edits (code
or markdown) are currently replaced with `addToHistory: false` / destroyed via
`documents.reopen`, with no dirty check anywhere in the function and no way
back. *(`ai-write-destroys-unsaved-edits-unrecoverably`,
`reopen-destroys-unsaved-wysiwyg-edits`)*
Test: a dirty buffer/tree survives an AI write to the same path; the
conflict is surfaced, not silently lost.

**T0-4. Route AI content adoption through the live view, not around it.**
`registry.setText` never reaches a mounted `EditorView` (the view only reads
`buffer.state` at construction and writes itself back via `registry.sync` on
every transaction). Add `CodeEditorHandle.applyExternalText(text)` that
dispatches a real transaction (`{changes: {from:0,to:doc.length,insert:text},
annotations: Transaction.addToHistory.of(false)}`) into the live view when the
path is active; keep `registry.setText` only for background tabs. Snapshot
the pre-adopt baseline *before* dispatching. Also rebase `diskDoc` in the same
step — after this call, disk equals `newText`, and every dirty computation
downstream needs to agree. *(`settext-never-reaches-live-editorview`,
`settext-leaves-diskdoc-stale`)*
Test: mount a `CodeEditor`, call the adopt path, assert `view.state.doc`
changed and the merge view computed the correct non-zero hunk count.

**T0-5. Preserve the create/overwrite marker (`oldText: null`) end to end.**
Change `__dsh_start_ai_review`'s signature to take
`hunks: {oldText: string|null, newText: string}[]` instead of two flattened
strings. `oldText === null` on **every** hunk with the buffer previously
unloaded means a genuine create → baseline is `''`, no `readFile`. When the
path *was* already loaded (registry holds a pre-write buffer), that pre-write
buffer text is the real baseline for an overwrite — never a fresh
post-write `readFile`, which recovers the post-state and produces a
zero-hunk, useless review every time. *(`baseline-resolved-after-the-write`,
`baseline-read-from-disk-after-ai-wrote`)*
Test: a `write` to an unopened new file shows the whole file as one insertion
hunk; a `write` overwriting an opened, unmodified file shows a real diff
against the pre-write buffer, not zero hunks.

**T0-6. Do not steal focus on an agent-initiated open.** Add a
non-activating open to the tab store: `openFileBackground(path)` that pushes
to `tabs` and leaves `activePath` untouched. `__dsh_start_ai_review` calls
this instead of `onOpenFile`. Ship together with a **review indicator on the
tab strip** (a small dot, same mechanism as the existing `dirty` dot) so a
background review is not invisible — today's alternative (force-activate) is
exactly the focus-steal the user is afraid of, and a bare `autoFocus` prop
cannot fix it (the mount happens after the async read settles, with no
gesture to attribute it to). Keep a defense-in-depth guard regardless:
`CodeEditor` skips `view.focus()` whenever
`document.activeElement` is inside `[data-dsh-chat-panel="true"]`.
*(`editor-steals-focus-on-ai-open`, confirmed independently by 3 lenses)*
Test: an AI write while the composer has focus leaves
`document.activeElement` inside the composer; the written file appears as a
background tab with the review indicator.

**T0-7. One merge-related `Compartment` pair per path, not per mount.**
This is the fix for "Accept doesn't turn off" and "the diff is stale after a
tab switch," and it is a genuine CodeMirror/architecture bug independent of
the `ReviewStore` work above — do it first, since T1 depends on
`reconfigure()` actually working. Hoist `diffCompartment`/`readOnlyCompartment`
out of `CodeEditor`'s per-mount `useRef` into `BufferRegistry` (one pair per
path, created on first use). On mount, if the buffer's stored state already
has these compartments configured (`getChunks(buffer.state, false) !== null`
or a tracked flag), **reconfigure**, never `appendConfig`, a second time.
*(`remount-stacks-second-mergeview`, `reconfigure-dead-after-remount`)* —
both independently measured against the real `@codemirror/state`/`merge`
packages; `appendConfig` accumulates, and `StateField` reinit resolution is
first-match-wins, so a second mount's `reconfigure()` calls become
**permanently** inert, not merely stale.
Test: mount → unmount → remount on the same path; assert
`state.config.compartments.size` stays at 2 (not 4), `reconfigure` on the
live compartment actually changes `getOriginalDoc`, and disarming yields
`getChunks(state) === null`.

### Tier 1 — correctness of the diff and the accept/reject/undo cycle

**T1-1 (`ReviewStore`).** Build the store described in §2. This is the
prerequisite for everything below in this tier and for all of Tier 2.
Test: a fresh module test — no React, no DOM — exercising
`registerWrite`/`advanceBaseline`/`acceptAll`/`rejectAll` against a fake
buffer/registry pair.

**T1-2. Wire `ReviewStore` into `CodeEditor` and `Workbench`.** Replace
`diffModes` React state with a subscription to `ReviewStore`. `updateStats`
calls `reviewStore.advanceBaseline`/`markResolvedCount` after every
transaction. `undoReview` becomes: pop a snapshot from the store, reconfigure
the (now-fixed, single) compartment, and — new — fail loudly
(`onNotify`) rather than silently if `getOriginalDoc` after the dispatch
doesn't match, instead of the handoff's suggested `EditorState.create`
rebuild (which destroys the tab's undo history, the one invariant
`BufferRegistry` exists to protect).

**T1-3. Fix the TipTap baseline desync on accept.**
`SET_BASELINE_BLOCKS` currently updates only `baselineBlocks`, leaving
`baselineMarkdown`/`baseNodes` pinned to the pre-accept baseline. Any accept
whose replacement block count differs from the replaced count desyncs
`fromA`/`toA` from both, and a later reject on a different hunk can delete a
paragraph outright instead of restoring it — a silent, measured data-loss bug
independent of the "does the button turn off" complaint. Fix: rebuild
`baselineBlocks` **and** `baseNodes` together on every accept (blocks are
available from the live doc via
`getBlocks(view.state.doc).slice(hunk.fromB, hunk.toB).map(b => b.node)`,
read *after* the dispatch, not from the closure); drop `baselineMarkdown` as
reject's source and make `rejectSingleHunk` splice from `baseNodes` instead
of re-parsing markdown (this also fixes T1-8's freeze). Guard: if a
`replace`/`delete` hunk's rebuilt `baseNodes` slice is empty, abort the
reject and log — never dispatch a bare delete. *(An `add` hunk legitimately
rejects to empty; do not blanket-guard that case.)*
*(`reject-after-accept-deletes-content`)*
Test: accept a hunk that changes block count, then reject a *different*
hunk; assert the rejected content is restored, not deleted.

**T1-4. Fix the stale-widget-closure accept no-op.** The per-hunk widget's
`key` is index-only (`hunk-${i}-${fromA}-${toA}-${fromB}-${toB}`); a keystroke
inside the changed block doesn't change it, so `prosemirror-view` reuses the
DOM node and its `onclick` closure forever — clicking "Giữ" after any edit
inside the hunk permanently does nothing (measured: accept called twice,
chunk count unchanged both times). Fix: don't close over `hunk`/`pluginState`
in the click handler — capture `hunk.id` only, and inside the handler do
`reviewPluginKey.getState(view.state)` fresh and look up the hunk by id,
bailing quietly on a miss. Do **not** make the key content-addressed (that
churns the DOM every keystroke and breaks hover state) — the id needing to
tolerate a stale/missing lookup is the actual fix.
*(`stale-widget-closure-accept-noop`)*
Test: type inside a hunk's changed block, click Accept; assert the chunk
resolves (not: assert it doesn't reappear).

**T1-5. One normalized path key.** Export the existing
`target.startsWith('/') ? target : (cwd ? \`${cwd}/${target}\` : target)`
rule (currently duplicated ad hoc in `index.ts`) from `utils/path.ts`, and use
it — and *only* it — everywhere a path becomes a map key: `index.ts`'s
capture pipeline, `TurnReviewCard`'s calls into the review API, `ReviewStore`.
Normalize `./`/`../` and a Windows drive letter while at it.
*(`path-normalization-two-keys`, `turncard-keys-do-not-match-review-keys`)*
Test: `./src/a.ts` and `src/a.ts` and `/cwd/src/a.ts` resolve to one key
given the same cwd.

**T1-6. Make "Reject all" actually revert disk.** Both the floating bar's
Reject and the chat card's Reject need a write step: revert the buffer to the
`ReviewStore` entry's baseline (not `BufferRegistry.diskDoc`, which is stale
the moment an external write landed) **and then save it** — currently a
same-content revert computes `dirty === false` and nothing is ever written,
so the file on screen and the file on disk silently disagree.
*(`reject-turn-never-reaches-disk`, `revert-turn-never-reaches-disk`,
`reject-all-never-reaches-disk`)*
Test: AI writes an already-open, clean-before-the-write file; Reject All;
assert the file **on disk** (not just the buffer) equals the pre-AI text.

**T1-7. Fix per-hunk button reachability for insertion-only hunks.**
`@codemirror/merge` renders an insertion-only chunk's controls inside a
zero-height `.cm-deletedChunk`; the current hover-to-reveal CSS can never be
triggered on a zero-height box, so **every AI-added block and every new
file** has no per-hunk controls at all — only the all-or-nothing floating
bar. Give `.cm-deletedChunk` a `min-height`, and fix the dead
`.cm-changedLine:hover .cm-chunkButtons` selector (the buttons are a child of
`.cm-deletedChunk`, never a descendant of `.cm-changedLine`).
*(`insertion-hunk-buttons-unhoverable`, `per-hunk-buttons-unreachable-on-insertions`)*

**T1-8. Stop rebuilding a TipTap Editor per hunk on Reject All.**
`rejectSingleHunk` re-parses the whole baseline markdown into a throwaway
editor on every call; `rejectAll` calls it in a synchronous loop — measured
6.7s freeze at 50 hunks. Fixed by T1-3's `baseNodes`-based reject (no
re-parse needed) plus batching all hunk reverts into **one** transaction
instead of N (also makes an accidental Reject All a single Ctrl+Z, not N).
*(`rejectall-freezes-ui`)*

**T1-9. Fix the phantom trailing-paragraph hunk and frontmatter-only
invisibility.** `documents.open` appends a normalization paragraph that
`parseMarkdownToBlocks` (used for the baseline) does not — any file not
ending in a paragraph shows a spurious "✨ MỚI" hunk. Align the two parse
paths (the existing `isDocDirty` fix already works around this same
asymmetry for the dirty flag — reuse its approach for the diff path). Give
frontmatter its own one-block pseudo-hunk instead of silently excluding a
frontmatter-only change from the tree entirely.
*(`phantom-trailing-paragraph-hunk`, `frontmatter-only-change-invisible`)*

### Tier 2 — the in-chat per-turn review surface (symptom 1)

This tier is only worth building on top of Tier 0/1 — without `ReviewStore`
and the compartment fix, a chat-side accept/reject would inherit the same
"doesn't actually resolve anything" defect.

**T2-1. Keep the hunk text instead of throwing it away.** `index.ts` already
reads `node.resultView.diffs` (`{path, oldText, newText}[]`) per turn and
currently discards it after installing the review. Store it:
`ReviewStore.registerWrite` already takes this shape (T1-1) — persist it
keyed by `turnId`, capped at ~20 turns.

**T2-2. Real per-turn diff card.** Rebuild `TurnReviewCard` to render, per
file, real `+N −M` counts (from the stored hunks, not a hardcoded `[+]`) and
an expandable inline read-only diff: `unifiedMergeView({original, ...},
{mergeControls: false, gutter: false, collapseUnchanged: {margin: 2}})`,
capped at ~40 lines with a "Show N more lines in editor →" link that calls
the *owner's* `openFile(path)` — never `openInWorkbench` directly, which
skips the host's cwd resolution (`turncard-open-bypasses-cwd-resolution`).
*(`no-per-turn-diff-in-chat-only-a-fake-plus`)*

**T2-3. Real per-turn Accept/Reject.** Footer buttons call
`reviewStore.acceptAll(path)` / `.rejectAll(path)` for every path in the
turn (T1-1's real verbs — for the active tab via the live handle, for
background tabs directly), replacing `__dsh_stop_ai_review` (hide-only) and
the ref-based `__dsh_revert_turn_file` (which can dispatch into the *wrong*
mounted editor entirely — `revert-turn-file-dispatches-into-wrong-editor`).
Disable both buttons once no path in the turn has a live review entry.
*(`turncard-accept-all-does-not-accept`)*

**T2-4. Stop depending on an undeclared plugin.** `selectTurnModifiedFiles`
reads `turn.data.get('deliverables')`, published by
`@deepseek-ai/dsh-client-ui-deliverables` — not a declared dependency of this
plugin and not present in this repo's `node_modules`. If that plugin is
absent from the host profile, the card **never renders**, with no
diagnostic — this is very plausibly why "there is no per-turn review in
chat" reads as literally true today. Source the file list from `ReviewStore`
(populated directly from the tool-result stream this plugin already
watches) instead of a second plugin's turn-data key.

### Tier 3 — UI/UX of the review chrome (symptom 4)

**T3-1. Dock the bar; render it once.** Resurrect `ReviewHeader` (dead code,
and the version that already got disabled-states and non-shifting-Undo
right) as a flex row docked beneath `Breadcrumb`, replacing the floating,
absolutely-positioned `FloatingReviewBar` that is currently **rendered twice
with copy-pasted handlers** (Workbench.tsx's markdown and code branches) and
diverges between them — the markdown copy has no positioned ancestor and
lands over the chat panel; the code copy is correctly positioned. Docking
removes: the containing-block bug, the occlusion of a file's last lines, the
z-index question, and the two-copies-diverging bug, all at once.
*(`floating-bar-wrong-containing-block-in-markdown`,
`floatingbar-unpositioned-in-markdown`,
`bar-covers-the-last-lines-and-has-no-scroll-padding`)*

**T3-2. Give the bar a real terminal state.** At `resolvedHunks === totalHunks`:
swap the whole bar to a single dismissable success row (`✓ All N changes
kept · Undo · Done`) instead of leaving live-looking, unstyled-disabled
Accept/Reject buttons that silently no-op. This — plus T0-7 making
`reconfigure` actually work again — is the direct fix for "the button
doesn't turn off." *(`accept-reject-never-disabled-at-zero-chunks`,
`review-bar-never-closes`)*

**T3-3. Add the missing multi-file affordance.** A file stepper
(`⟨ README.md 2/3 ⟩`) driven by `reviewStore.entriesForTurn`, so accepting or
dismissing the active file's review doesn't leave the other files in the
same turn invisibly under review. *(`no-multi-file-review-context-anywhere`)*

**T3-4. One vocabulary, one locale namespace.** Register real strings via
`ctx.locale.register` instead of ad hoc Vietnamese/English mixes per
component. Fixed table: per-hunk `Giữ` / `Bỏ`; per-file `Giữ tất cả trong
file` / `Bỏ tất cả trong file`; per-turn `Giữ toàn bộ lượt` / `Hoàn tác lượt
này`. Never reuse a bare verb across scopes.
*(`three-vocabularies-for-two-actions`)*

**T3-5. Fix hunk-navigation on both engines.** CodeMirror's Alt+↑/↓ already
work (`goToNextChunk`/`goToPreviousChunk`); the TipTap and the bar's ↑/↓
always jump to the first/last hunk because there is no active-hunk cursor.
Add one. *(`nextchunk-prevchunk-do-not-navigate` and its 2 duplicates)*

**T3-6. Accessibility pass.** Replace bare `<button>` + emoji with the
existing `ui/primitives/IconButton` + `Tooltip` (brings focus rings for
free); remove the undersupported `role="toolbar"` or implement roving focus
for real; make per-hunk buttons reachable by keyboard and touch (drop
`pointer-events: none` until hover — always-visible-but-quiet, full on
hover/focus, per the audit's UX-lens redesign notes).
*(`review-chrome-a11y-unlabelled-icon-buttons-and-fake-toolbar`,
`hover-only-hunk-buttons-kill-keyboard-and-touch`)*

### Tier 4 — everything else

Grouped; each is independently small.

- **Keyboard scoping (do together, one PR).** `FloatingReviewBar` binds
  Ctrl+Enter/Ctrl+Backspace/Alt+J/K at `window` in the **capture phase** with
  `stopPropagation` and no target check — Ctrl+Enter is the composer's send
  chord and Ctrl+Backspace is delete-word-backwards in every text field,
  so a review being open makes the composer unable to send and turns a
  routine word-delete into "revert everything the AI wrote." Move these into
  editor-scoped keymaps (`Prec.high(keymap.of(...))` — appended config is
  *lower* precedence than `defaultKeymap`, so a naive move silently produces
  dead shortcuts) or gate on `hostRef.current?.contains(document.activeElement)`
  with `capture` dropped; delete Ctrl+Backspace as a destructive binding
  entirely. Same audit applies to `AppFrame`'s global Ctrl+P/K/B/L (fires
  while typing in the composer or the markdown editor) and to the total
  absence of any `isComposing`/`keyCode === 229` guard anywhere in the
  plugin, which breaks Vietnamese IME candidate windows in the slash menu and
  doc-link menu. *(`floating-bar-global-capture-hotkeys` + 4 duplicate
  confirmations, `appframe-global-keys-not-scoped`,
  `no-ime-composition-guard-anywhere`)*
- **`Ctrl+W` bypasses the unsaved-changes dialog** and fires even while
  typing in the composer. Route it through `requestClose`.
  *(`ctrl-w-closes-dirty-tab-without-prompting`)*
- **Session/tab lifecycle leaks.** `diffModes`/`reviewStats`/`rawModes` (or
  their `ReviewStore` successor) are never cleared on tab close, so
  reopening a file resurrects a review against an hour-old baseline; a
  session rebind (switching sessions, scrollback paging) replays the *entire*
  node window as fresh reviews with no watermark; `processedCallIds` is
  marked before confirming the window global existed, permanently swallowing
  writes that arrive before mount. Fix `forget` to reap review state too; add
  a `lastProcessedSeq` watermark; don't mark processed until after a
  successful dispatch. *(`diffmodes-survive-tab-close`,
  `tab-close-does-not-end-review`, `session-rebind-replays-whole-history`,
  `processed-before-dispatch-loses-review`)*
- **Subagent writes are still invisible after the handoff's own prescribed
  fix.** `subCalls` entries are projected with `resultView: null`, so
  recursing into them (handoff P0-2) enables only the name-substring
  fallback — which T0-2 is about to delete. Don't ship P0-2's recursion
  without also solving what a subagent write's render intent should be; for
  now, treat "child result, no resultView" as unreviewable and say so in a
  log line rather than silently mis-handling it via the fallback.
  *(`subcall-results-carry-no-diff-view`)*
- **A held path from a read-only tool call never releases.** Any call whose
  args carry a path field holds autosave; release only happens on a settled
  *write* branch. Asking the agent to read a file you're editing freezes
  autosave (and silently no-ops Ctrl+S) for the rest of the session. This is
  the same `heldByCall` fix as T0-1 — ship together.
  *(`read-only-tools-freeze-autosave-forever`)*
- **Markdown's per-hunk reject is a no-op you can't tell happened.**
  Rejecting inside the read-only raw text view visibly removes the AI's
  text on screen, but markdown's dirty flag deliberately excludes the buffer
  and the tree is what's authoritative — the first `projectMarkdown` call
  (a save, or a view flip) silently restores the AI's text. Route
  per-hunk reject through the tree, never through `rejectChunk` on the raw
  view. *(`markdown-reject-silently-discarded`)*
- **`revealLine` only fires on mount.** A second search hit in an
  already-open file does nothing (markdown: no hit ever scrolls). Make it a
  dependency of its own effect, not a mount-time read.
  *(`revealline-ignored-on-same-path`, its crosscut duplicate)*
- **`SET_BASELINE`/`POP_SNAPSHOT` build a full `Editor` inside a
  ProseMirror `apply`** — measured ~200-210ms blocking, and a documented
  purity violation. Move the parse to the call site.
  *(`set-baseline-builds-editor-inside-apply`)*
- **Delete dead code**: `ReviewHeader`/`ReviewHeader.module.css` (until
  resurrected per T3-1 — then it's not dead, it's the basis), the unused
  `TipTapReview.module.css`, `TurnReviewCard.module.css`'s unreferenced
  `.statsPill`/`.statDel`, `FloatingReviewBar.tsx`'s empty Ctrl+Z branch,
  `TurnReviewCard.tsx`'s unreachable `if (!opened) openFile(path)` fallback.
- **Type the window-global seam**, or better, delete it once `ReviewStore`
  ships and nothing calls through `window.__dsh_*` for review commands
  anymore. `as any` at both ends is currently why the fragment-vs-whole-file
  shape mismatch from handoff P0-1 didn't fail to compile.
  *(`start-review-args-untyped`)*
- **`TipTapEditor`'s window Ctrl+S isn't focus-gated** like its own Ctrl+F/
  Ctrl+K are — pressing Ctrl+S in the composer saves the markdown tab.
  *(`tiptap-ctrl-s-not-focus-gated`)*

---

## 4. The focus policy

One rule, stated as a decision table. `CodeEditor`/`TipTapEditor` never call
`.focus()` from a mount effect — only from a handler attached to an explicit
user gesture (a click in the explorer, tab strip, `QuickOpen`, a search
result). An AI-initiated open is a **background open**: it pushes the path
into `tabs` (so it's reachable) and leaves `activePath` untouched.

| Trigger | Open a tab? | Activate it (`activePath`)? | Move keyboard focus? |
|---|---|---|---|
| User clicks a file (explorer, tab strip, `QuickOpen`, search hit) | yes | yes | yes — this is the one legitimate `.focus()` call |
| Agent write/edit settles, target not open | yes, **background** | no | no |
| Agent write/edit settles, target already open, not active | no (already open) | no | no |
| Agent write/edit settles, target already open **and active** | n/a | n/a | no — never re-focus an already-focused-elsewhere tab |
| User explicitly opens a review from `TurnReviewCard` / a tab's review badge | yes | yes | yes (this is a user gesture) |
| The file the user has open is dirty and the agent also wrote it | do not adopt silently (T0-3) | do not change | no |

Defense in depth, regardless of the table above: any focus-moving call checks
`!document.activeElement?.closest('[data-dsh-chat-panel="true"]')` first —
the selector already exists (`composer.ts`/`RightColumn.tsx`) and this one
guard is cheap insurance against a future regression re-introducing an
unconditional `.focus()`.

---

## 5. Test plan

Beyond the 12 tests already listed in the handoff's §5 (which remain
required), add:

1. **T0-1** — a literal flat `RunningToolCall` (no `.call` field) held via
   `drainSnapshot` results in `saveQueue.isHeld(path) === true`.
2. **T0-3** — a dirty buffer is not overwritten by an AI write to the same
   path; the conflict is surfaced, the user's text is still in the buffer
   after the write settles.
3. **T0-4** — `registry.setText`/the new `applyExternalText` on an
   **active, mounted** path is reflected in `view.state.doc`, not silently
   reverted by the next `dispatchTransactions`.
4. **T0-5** — a `write` with `oldText: null` to a file not previously open
   renders as one all-green insertion hunk, not zero hunks; the same
   `write` overwriting an already-open, clean file diffs against the
   pre-write buffer.
5. **T0-6** — an AI write while `document.activeElement` is inside
   `[data-dsh-chat-panel="true"]` leaves it there; the written path appears
   in `tabs` without becoming `activePath`.
6. **T0-7** — mount → unmount → remount the same path; assert
   `state.config.compartments.size` does not grow past 2, `reconfigure` on
   the live compartment changes `getOriginalDoc`, and disarming yields
   `getChunks(state) === null` (never test for `undefined`).
7. **T1-1** — a store-only test (no DOM): `registerWrite` → `advanceBaseline`
   → `acceptAll` on a background (unmounted) path correctly rewrites the
   buffer and marks the entry `done`.
8. **T1-3** — accept a hunk whose replacement block count differs from the
   original, then reject a *later, unrelated* hunk; assert the later hunk's
   content is restored, not deleted.
9. **T1-4** — type inside an accepted-but-unresolved hunk's block, click
   Accept; assert the hunk resolves on the first click.
10. **T1-6** — Reject All on a file that was open before the AI wrote it;
    assert the **on-disk** content (not just the buffer) is the pre-AI text.
11. **T2-3** — `TurnReviewCard`'s Accept All against a file that is *not*
    the active tab still resolves its review (proves the store-based path
    works without a mounted handle).
12. **Path identity** — `./src/a.ts`, `src/a.ts`, and the cwd-joined
    absolute form all resolve to one `ReviewStore` key.
13. **Keyboard scoping** — a synthetic Ctrl+Backspace dispatched with
    `document.activeElement` inside the (simulated) composer does **not**
    reach any review handler.
14. **IME** — a synthetic keydown with `isComposing: true` (or
    `keyCode: 229`) is ignored by every menu/review keydown handler in the
    plugin.

---

## 6. What not to do

Carried forward from the handoff, plus what the verification pass flagged:

- Do not make accept dispatch a document change to "make Ctrl+Z work" —
  measured invariant, still true: it would rewrite the file with text it
  already contains and produce a spurious dirty flag. Use the snapshot
  stack (now living in `ReviewStore`).
- Do not use `presentableDiff` for block arrays — still `diff()` only.
- Do not test `getChunks(...) === undefined` — it is `null` when disarmed.
- Do not parse replacement markdown in a throwaway editor and splice the
  fragment directly — rebuild in the live schema.
- Do not call `documents.reopen` on an AI write without first checking
  `documents.isDirty` (T0-3) — and plan to remove `reopen` from this path
  entirely once handoff §4.2's `blockMap` + `replaceBlocks` lands, which
  remains the correct long-term shape for adopting AI content into markdown
  without destroying history/caret/folds.
- Do not derive file content from a diff hunk fragment (T0-5's whole point).
- Do not "fix" `undoReview`/remount desync by rebuilding the `EditorState`
  from scratch (`EditorState.create`) — that destroys the tab's undo
  history, which `BufferRegistry` exists specifically to preserve. Fail
  loudly instead (`onNotify`), never silently rebuild.
- Do not content-address the per-hunk widget key (T1-4) — it fixes the
  stale-closure bug at the cost of destroying the widget DOM on every
  keystroke inside a hunk, which is worse. Fix the click handler's lookup
  instead.
- Do not ship the handoff's P0-2 (`subCalls` recursion for subagent writes)
  in isolation — child `ToolResultNode`s carry `resultView: null`, so
  recursing into them only enables the name-substring fallback that T0-2
  removes. Solve what a subagent write's render intent should be, or
  explicitly log it as unreviewable, before wiring the recursion.
- Do not remove the autosave hold (once T0-1 makes it real) — it is the
  only thing preventing the 1200ms timer from flushing a stale buffer over
  an AI's in-flight write.
- Do not treat "hide the review chrome" (`__dsh_stop_ai_review`'s current
  behavior) as "accept" anywhere in the new design — every path that used
  to call it needs to call `ReviewStore.acceptAll`/`.dismiss()` explicitly,
  and dismissing with unresolved hunks needs its own confirmation, not a
  silent discard.
