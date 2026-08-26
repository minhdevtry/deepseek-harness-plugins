# Should we build our own? — and what TipTap actually costs

Two questions were asked: make it work for ordinary files **and** for TipTap
(stated as the hard part), and decide whether to build something from scratch.

**Short answer: do not build from scratch — for two very different reasons.**

- For **ordinary files**, the entire per-hunk review UI is already a dependency
  of this plugin and is already wired into `CodeEditor.tsx`. It is currently
  driven by the save-preview toggle. Pointing it at a second driver is a small
  change, not a build.
- For **TipTap**, there is nothing to copy — but I measured it, and it is
  tractable. The core mechanism is about 120 lines, and all four premises it
  rests on are proven below.

What follows is what I verified by running it, not by reading.

---

## 1. Ordinary files: mostly built already

`plugins/dsh-client-vscode-layout/package.json:51` lists `@codemirror/merge`
`^6.12.2`, and [CodeEditor.tsx:87](plugins/dsh-client-vscode-layout/src/client/workbench/CodeEditor.tsx:87) already does:

```ts
unifiedMergeView({ original: diffOriginal, mergeControls: true })
```

`mergeControls: true` **is** the per-chunk Accept/Reject buttons. Today the only
thing that feeds `original` is the save-preview toggle
([Workbench.tsx:627](plugins/dsh-client-vscode-layout/src/client/workbench/Workbench.tsx:627)):
`diffOriginal={diffOpen ? status.diskDoc : undefined}`.

Map what the package exports against what an AI review needs:

| Need | Already exported by `@codemirror/merge` |
|---|---|
| Accept / reject one hunk | `acceptChunk(view, pos)` / `rejectChunk(view, pos)` |
| The hunk list (for a file-level header, counts) | `getChunks(state)` |
| Next / previous hunk (`Alt+↓` / `Alt+↑`) | `goToNextChunk` / `goToPreviousChunk` |
| **The two-text model** (`ReviewCore`'s `originalText`) | `getOriginalDoc(state)`, `updateOriginalDoc`, `originalDocChangeEffect` — the baseline is a first-class CodeMirror `StateField` the library maintains for us |
| Collapsed context with expand-on-click (B's feature) | `collapseUnchanged: { margin, minSize }` + `uncollapseUnchanged` |
| Our own button styling and Vietnamese labels | `mergeControls` also accepts a render function `(type, action) => HTMLElement` |
| Inline word-level changes | `allowInlineDiffs: true` |
| Gutter markers | `gutter: true` |

The two-text model that `dsh-vscode-review` implements by hand in
`review-core.js` is, on the CodeMirror side, **already a library feature.**

### What is actually left to do

1. Give `original` a second driver: `reviewBase` (the pre-AI text) instead of
   only `diffOpen ? diskDoc : undefined`.
2. Hook accept/reject to save through the existing `SaveQueue`, and to clear the
   review when `getChunks(state)` comes back empty.
3. A file-level header (`n changes · Accept all · Reject all · ↑ ↓`).
4. Custom `mergeControls` renderer for styling and i18n.

### One conflict to resolve first

`diffOpen` (save preview: disk vs buffer) and an AI review (pre-AI vs current)
both want the same `original` slot, and they mean different things. One of them
has to win, and it should be an explicit decision rather than whichever effect
ran last. Simplest rule: a review, while open, owns `original`; the save-preview
toggle is disabled with a tooltip saying why.

---

## 2. TipTap: the hard part, measured

The difficulty is real: ProseMirror holds a tree, and the markdown text is a
projection of it (`documents.markdown(path)`). A line-level hunk has no obvious
node to attach to.

The way through is to stop thinking in lines and think in **top-level blocks**.
I tested the four things that has to be true. All four hold.

### 2.1 Block serialization is compositional

Serialize each top-level node on its own, join with a blank line, and you get the
whole document back:

```
simple    nodes=3 compositional=true      (heading + paragraphs)
list      nodes=3 compositional=true
code      nodes=3 compositional=true      (fenced code block)
table     nodes=2 compositional=true
quote     nodes=2 compositional=true      (blockquote)
opaque    nodes=3 compositional=true      (rawHtmlLine `<!-- keep -->`)
nested    nodes=2 compositional=true      (nested + ordered lists)
task      nodes=2 compositional=true      (task list)
```

Every construct this editor supports, including the two the round-trip work had
to fight (`rawHtmlLine`, tables). This is the load-bearing fact: without it there
is no block↔text mapping at all.

### 2.2 The block → line-range map is exact

Accumulating each block's line count (plus one for the blank separator) and
slicing the whole-document serialization at those line numbers reproduces each
block's own text, byte for byte:

```
1) line map exact: true | blocks= 5 | lines= 12
```

So a line-level hunk from any diff can be resolved to the blocks it touches, and
a block can be resolved to the lines it occupies — which is what the diff view
and the AI's line-based hunks both need.

### 2.3 A hunk applies as ONE transaction, and native undo restores it

```ts
editor.view.dispatch(
  editor.state.tr.replaceWith(pos, pos + size, replacementFragment)
)
```

```
replacement fragment childCount = 1
after = "# Title\n\nFirst para, EDITED by the AI.\n\n- a\n- b\n\n```ts\nconst x = 1\n```\n\nlast"
  edited landed : true
  rest untouched: true
  undo restores : true
```

This is the part `dsh-vscode-review` could not get and had to work around by
rebinding `Ctrl+Z` to its own op stack. Because we apply hunks as ordinary
ProseMirror transactions, **native undo already does the right thing** — no
rebinding, no parallel undo log, no `preDocText` matching. The caret maps through
`tr.mapping` for free, and `HeadingFoldPlugin`'s state survives for the same
reason (it already maps its decorations through `tr.mapping.mapResult`).

One gotcha found while testing: a fragment parsed in a throwaway editor belongs
to a **different schema instance**, and splicing it in silently produces an empty
result. It has to be rebuilt in the live editor's schema:

```ts
const fragment = editor.schema.nodeFromJSON(throwaway.state.doc.toJSON()).content
```

### 2.4 Node identity survives edits, so the map can be cached

```
node identity preserved after one edit: 49/50
```

ProseMirror nodes are immutable and are reused across transactions. A `WeakMap`
keyed on the node object therefore caches a block's serialized text for as long
as that block is untouched.

This matters because the cold cost is not free:

```
file: 9989 bytes, 1100 lines, 400 blocks
  parse                 = 149 ms
  blockMap (400 blocks) = 178 ms      (~0.44 ms per block)
  whole-doc getMarkdown =   3 ms
```

Serializing 400 blocks one at a time costs 60× what serializing the whole
document costs. Rebuilding that on every keystroke would be unusable. With the
`WeakMap`, a rebuild after one edit re-serializes one block — sub-millisecond —
and the cold 178 ms is paid once, when a review opens.

### 2.5 Design that falls out

```
blockMap.ts
  ├── blocks(editor): { index, pos, size, text, startLine, endLine }[]
  │     cached per node object in a WeakMap; O(changed blocks) after the first call
  ├── blocksToLines / linesToBlocks   ← resolve either direction
  └── replaceBlocks(editor, from, to, markdown): one transaction
```

Review flow for a markdown file:

1. AI writes; we hold `reviewBase` (pre-AI markdown) and the AI's markdown.
2. Parse the AI text into a throwaway editor → its block texts.
3. Diff the two **arrays of block texts** (not lines) → block hunks.
4. Render: `Decoration.node` on changed blocks (green), `Decoration.widget` above
   them carrying the removed blocks as red phantom rows, and a widget with the
   `✓ Accept i/n  ↺ Reject i/n` bar.
5. Accept = keep the AI blocks and advance `reviewBase`. Reject = replace those
   blocks with the base ones via `replaceBlocks`.

### 2.6 Caveats to design around

- **Frontmatter is excluded.** `splitFrontmatter` keeps it out of the tree
  entirely, so a change to frontmatter is invisible to a block diff. It needs its
  own one-block hunk handled separately, or the review will silently show nothing
  for a frontmatter-only edit.
- **`rawHtmlLine` nodes are atoms.** They serialize back verbatim, which is what
  makes 2.1 pass, but they cannot be partially accepted — they are one block or
  nothing. That is correct behaviour, just worth stating.
- **Blocks with identical text.** Two paragraphs that serialize to the same
  string are indistinguishable to an array diff. It will pick one; standard diff
  behaviour, and the same thing happens in line diffs. Not a bug, but it will look
  like one the first time a duplicated line moves.
- **Granularity is the block, not the line.** Accepting "one line" of a
  ten-line list item means accepting the whole item. For markdown that is
  arguably the *right* granularity — half a list is not valid markdown — but it
  should be a stated decision, not a surprise.
- **Big files.** 178 ms cold on 400 blocks is fine; a 3000-block file would be
  ~1.3 s. That wants either a threshold that falls back to raw-view review, or an
  incremental build. The existing 120 KB `reconcile.ts` cap is the natural line.

---

## 3. Do not write a diff engine

`@codemirror/merge` exports its diff as plain string functions, usable with no
editor at all:

```ts
declare function diff(a: string, b: string, config?: DiffConfig): readonly Change[]
declare function presentableDiff(a: string, b: string, config?: DiffConfig): readonly Change[]
```

Run against the four cases that break `dsh-vscode-review`'s hand-rolled Myers:

| Case | Result |
|---|---|
| `"a\r\nb\r\n"` → `"a\r\nB\r\n"` | 1 change at `[3,4)` — **CRLF untouched** |
| `""` → `"hello\n"` | 1 change `[0,0)→[0,6)` — clean |
| `"hello\n"` → `""` | 1 change `[0,6)→[0,0)` — **terminates** |
| `"a\nb"` → `"a\nb\n"` | 1 change `[3,3)→[3,4)` — **visible**, not zero hunks |

All four correct, because it works in character offsets rather than splitting on
`/\r?\n/` and throwing the line endings away. The library we already ship gets
right exactly the four things the reference implementation gets wrong.

Using it for the TipTap block diff too means both surfaces agree by construction
and no third diff library enters the bundle (we already carry
`@sanity/diff-match-patch` for `reconcile.ts`).

---

## 4. Build / borrow / own

| Piece | Verdict | Size |
|---|---|---|
| Diff engine | **already own** — `@codemirror/merge`'s `diff` / `presentableDiff` | 0 |
| Per-hunk UI, ordinary files | **already own** — `unifiedMergeView`, already wired | ~150 lines to redirect + header + styled controls |
| Two-text baseline, ordinary files | **already own** — `getOriginalDoc` / `updateOriginalDoc` | 0 |
| Two-text baseline, TipTap | **port** — `ReviewCore`'s four verbs, design only | ~100 lines |
| `blockMap.ts` | **genuinely new; nobody has this** | ~120 lines |
| TipTap review decorations + action bar | **new** | ~250 lines |
| Capture (which files the AI touched) | **port B's shape** | ~80 lines client-side |
| Undo/redo safety | **port B's** bidirectional content transform | ~80 lines |
| Multi-op revert | **port D's** `merge3` | ~40 lines |
| Autosave freeze / force-on, review state | **new**, small | ~150 lines |

Roughly 1000 lines, of which about 300 is ported logic and only `blockMap.ts` is
genuinely novel. That is a real project, but it is nothing like writing a review
system from nothing — and half of the ordinary-file half is already sitting in
the repo unused for this purpose.

---

## 5. Recommended order

**Phase 0 — install `dsh-file-review` (zero work).** It is on npm, MIT, has
tests, and registers into `conversation.chat.turnTail` / `conversation.input.dock`
— rings our frame already renders through `renderSlot('conversation')`. That
gives per-turn review, whole-change undo, and line comments **today**, and tells
us how much of the problem is left before we write anything. If it turns out to
be enough, the rest of this document is optional.

**Phase 1 — ordinary files.** Freeze autosave during an in-flight AI write
(the earlier audit's E-1, still the prerequisite), then give `original` a second
driver, hook accept/reject to save, add the header and styled controls. Small,
and it covers every non-markdown file plus markdown in raw view.

**Phase 2 — `blockMap.ts`** as a pure module with tests, no UI. This is the piece
worth being careful about.

**Phase 3 — TipTap review decorations** on top of it.

**Phase 4 — capture, undo/redo safety, per-op revert**, ported as in §4.

Reassess after Phase 1. It is entirely possible that Phase 0 plus per-hunk review
on ordinary files is where the value stops, and that markdown review in raw view
is good enough — in which case Phases 2 and 3 never need to be written.
