# Research: realtime inline AI-edit review for the DSH web editor

Goal, in the user's words: when the AI edits a file that is open in the editor,
show it live; prefer the AI's version when the buffer has unsaved edits (which
means autosave has to be on); and let the change be **accepted** — per hunk, per
line, or whole-file — through an injected UI in the style of Cursor or
Antigravity.

Reference studied: `Wilson-Lai-Ab/dsh-vscode-review` (cloned at `f33a650`).
Everything below was read from that source; the diff math was executed, not
just read.

---

## 1. What the reference repo actually contains

Three deliverables in one repo:

| Part | Role |
|---|---|
| `packages/dsh-review` | DSH **host-plane** plugin. Hooks the agent's write/edit tools, journals before/after snapshots to `$DSH_HOME/review/changes/`, exposes `review_status` / `review_revert` / `review_open` tools. |
| `packages/dsh-review-changes` | DSH **web** plugin. A collapsible "file changes" panel docked above the composer, plus `/api/review/*` routes. |
| `vscode_dsh_plugin` | VS Code extension. Inline green/red decorations, per-hunk Accept/Revert buttons, file-level Accept All / Reject All. |

**The single most important structural fact for us:** all the per-hunk review
UI lives in the VS Code extension. The DSH web panel is a *list plus a
dispatcher* — its Accept All / Reject All buttons do not apply anything, they
fire a `vscode://dsn.dsh-review-vscode/review?action=…` deep link and hand the
work to VS Code (`dsh-review-changes/lib/index.js:117`).

So the reference cannot do what is being asked for here. It has no inline
review inside DSH web, because DSH web has no editor — that is exactly what
`dsh-client-vscode-layout` adds. The repo gives us **the model and the math**;
the surface is ours to build.

Note: the web panel registers into the `conversation.input.dock` slot as a
collapsible "file changes" strip above the composer. That is plausibly what the
"Files With Changes" header in the earlier screenshot was.

---

## 2. The model worth copying: `ReviewCore`'s two texts

`vscode_dsh_plugin/lib/review-core.js`, 106 lines, zero dependencies. It keeps
exactly two strings per file under review:

```
originalText  — the accepted baseline (pre-AI content, advanced as hunks are accepted)
modifiedText  — the working document (AI output + the user's own edits)
```

The visible review is always `diff(originalText, modifiedText)`, and the four
verbs are one line each:

```
acceptHunk(i)  ->  originalText absorbs the modified block
rejectHunk(i)  ->  modifiedText gets the original block back
acceptAll()    ->  originalText := modifiedText
rejectAll()    ->  modifiedText := originalText
```

Two properties fall out for free, and they are the reason this design is worth
adopting rather than inventing something:

- **Accepted hunks disappear by construction.** After any action the diff is
  simply recomputed; there is no decision ledger to keep in sync.
- **The user may keep editing during review.** Their own typing lands in
  `modifiedText` and just becomes part of the next diff.

The file's own header records that this *replaced* an earlier design:

> "It replaces the decisions.json content-matching path: after an action the
> diff is simply recomputed, so accepted hunks disappear naturally"

That is a lesson already paid for. Do not build a persisted per-hunk decision
table; keep two texts and re-diff.

**Mapping onto our code.** `BufferRegistry` already keeps `diskDoc` (the disk
baseline) next to the live `state.doc`. A review adds a third text, not a new
subsystem:

```
BufferStatus.text {
  state.doc     // == modifiedText  (already exists)
  diskDoc       // what is on disk  (already exists)
  reviewBase?   // == originalText  (NEW, present only while a review is open)
}
```

`reviewBase` is the pre-AI content. While it is set, the editor is in review
mode; when `diff(reviewBase, state.doc)` is empty, review is over and the field
is cleared.

---

## 3. The signal: three possible channels

### (a) What the reference uses — a journal directory plus a watcher

`dsh-review` writes, per change, three files under `$DSH_HOME/review/changes/`:
`<id>.json` (mutable manifest), `<id>.before`, `<id>.after`. Writes are atomic
(tmp + rename). The IDE side watches the directory:

```js
const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(storeDir, '*.json'))
watcher.onDidCreate(uri => observe(path.basename(uri.fsPath, '.json')))
// …and a belt-and-braces fallback:
const timer = setInterval(poll, 3000)
```

Good: durable, survives restarts, works cross-process, any IDE can consume it.
Bad for us: our editor is a browser tab with no filesystem access, so consuming
it means adding yet another HTTP route to `dsh-host-files` and polling it.

One detail worth stealing regardless: at startup they **prime** the seen-set
with every existing manifest, so a restart does not auto-open the whole history.

### (b) The wire diff card (from the previous round of this audit)

Every settled `write`/`edit` tool call carries `resultView.card === 'diff'` with
`diffs: [{ path, oldText, newText }]`, reachable from the plugin through
`ctx.sessions.sessionOf(actx)` → `ObservableSnapshot<ConversationSnapshot>`.
No new route, no polling, arrives exactly when the call settles.

### (c) The host `fs` plane — the channel this repo revealed

`dsh-review/lib/index.js` documents its mount points as **"stable public dsh
vocabulary"**:

```
tools/pre-execute   waterfall — runs BEFORE the tool, can capture the before-text
fs/observed         emit      — carries the post-write fs version
tools/result        emit      — the settled write, with value.before / value.after
```

And it revealed something that changes the previous round's recommendation:

```js
const intent = entry.version ? { kind: 'replaceIfVersion', version: entry.version } : undefined
outcome = await fs.writeText(target, beforeText, intent, exec.signal)
// …
if (error && error.code === 'FS_STALE_VERSION') { /* refuse to overwrite */ }
```

**DSH's host `fs` service already has a compare-and-swap write**, with a named
error code, and `fs.stat(target)` already returns `info.version`. The previous
audit proposed adding an mtime guard to the `dsh-host-files` `/write` route
(item F-1). That proposal is not wrong, but it is second-best: the primitive
exists one layer up. Our workbench writes through `dsh-host-files`' own HTTP
route rather than `ctx.fs`, which is why it does not benefit today. Either route
workbench saves through `ctx.fs`, or mirror `replaceIfVersion` in the HTTP
route — but do it knowing the vocabulary already exists and match it.

### Recommendation

Use **(b) the wire diff card** as the live signal — it is push, it is already
in the client, and it needs no new plumbing. Use **(c)** for the write guard.
Consider **(a)** only if review state must survive a browser reload; the
manifest format is a reasonable thing to copy if so.

---

## 4. Do not port their diff math as-is — it has four real bugs

`vscode_dsh_plugin/lib/inline-diff.js` is a clean 221-line Myers
shortest-edit-script implementation with `acceptHunk` / `rejectHunk` helpers,
zero dependencies. Their own test suites pass:

```
node test/inline-diff-test.mjs   →  ALL PASS (11 assertions)
node test/review-core-test.mjs   →  ALL PASS
```

But their tests only cover LF text with a trailing newline. Driving the real
modules with the cases our markdown editor actually hits:

| Case | `original` → `modified` | Result |
|---|---|---|
| CRLF file | `a\r\nb\r\nc\r\n` → `a\r\nB\r\nc\r\n` | accept yields `a\nB\nc\n` — **every CRLF in the file is silently converted to LF** |
| Empty file gains content | `""` → `"hello\n"` | accept yields `"hello"` — **trailing newline lost** |
| File emptied | `"hello\n"` → `""` | accept yields `"\n"`, which never equals `""`, so the hunk **never clears — infinite loop**; the Accept button would spin forever |
| Trailing newline only | `"a\nb"` → `"a\nb\n"` | **0 hunks** — the change is invisible and can be neither accepted nor rejected; the file sits in review forever with nothing to click |

Root causes, both in the same helper:

```js
function splitLines(text) {
  const out = String(text).split(/\r?\n/)   // <- \r discarded, never restored
  if (out.length > 0 && out[out.length - 1] === '') out.pop()   // <- trailing-newline signal thrown away
  return out
}
function joinPreservingEol(lines, eolSourceText) {
  const trailing = typeof eolSourceText === 'string' && eolSourceText.endsWith('\n')
  return lines.join('\n') + (trailing || lines.length === 0 ? '\n' : '')
  //                          ^ always LF        ^ this is what makes "" become "\n"
}
```

We have already solved exactly this class of problem once, in
`tiptap/reconcile.ts`: `detectDominantEol`, `toLf`, `restoreEol`,
`stripTrailingNewlines`. Port the Myers core (`myersHunks`, `backtrack`,
`opsToHunks` — that part is sound and fast, O((N+M)·D)) and wrap it in our own
EOL discipline:

1. Detect the dominant EOL of the ORIGINAL text once, per review.
2. Normalize both sides to LF for all hunk math.
3. Track the trailing-newline bit explicitly instead of inferring it from
   `endsWith('\n')` of whichever string happened to be passed in.
4. Restore the EOL when writing back.

And add the four rows above as regression tests — they are cheap and they are
the exact failures.

---

## 5. Lessons already paid for, encoded in their comments

These are the expensive-to-rediscover bits. Each is a comment in their source
describing a bug they hit.

**The AI must see its own writes.** They first built a "work copy" model where
the tool was redirected to `<root>/work/<id>/<basename>` so the user's file was
never touched until accept. `work-copy.js` still ships. They abandoned it:

> "NEW MODEL: the AI tool keeps the real file as its output (no OR restore) —
> the AI must see its own writes for context on later calls."

This settles the user's question about preferring the AI's version. The AI's
text **is** the file on disk. There is no holding it back — a multi-step agent
that re-reads what it just wrote would read stale content. The editor's job is
to adopt it and present the review, not to gate the write.

**Guard against your own edits.** Every programmatic document write sets
`state.selfEdit = true` around `applyEdit`, and the change listener returns
early on it. Without that, applying an accept re-triggers the review refresh.

**Save events fire the change listener with zero content changes.**

> "Save/dirty-state transitions also fire this event with zero content changes.
> Treating them as an undo was instantly rewinding every accept."

**Never replace the whole document.**

> "Minimal edit between two full texts: strip the common prefix/suffix and
> replace only the middle. Full-document WorkspaceEdit is what made RJ feel slow
> on large files and produced huge undo entries."

Their `minimalEditFor` is 15 lines and directly portable. For us it matters
twice over: for CodeMirror the same performance argument holds, and for TipTap a
whole-document replacement is what forces the `reopen()` that destroys undo
history, caret, scroll and fold state.

**Re-sync from the live document before every action.** Each accept/reject
starts with `st.core.modifiedText = docText`. The user may have typed between
the render and the click; the button must act on what is on screen.

**Compute, apply, then commit.** They build the next state in a *clone*, apply
the edit, and only assign it to the live core if `applyEdit` succeeded — so a
rejected edit cannot desync the model from the document.

**Debounce the re-render.** User typing calls `scheduleRefresh(uri, 150)`, not
an immediate rebuild.

**Scope by workspace.** One DSH process can serve several workspaces, so every
manifest is tagged with `workbenchId` = the session header's `cwd`, canonicalized
with `realpathSync.native` — explicitly *not* `process.cwd()`. Our
`fileSource.ts` already resolves the session cwd the same way; the same tagging
applies to us the moment two tabs are open on different roots.

---

## 6. The UI — and why ours can be better than theirs

Their per-hunk UI is built on `editorInsets`, a **VS Code proposed (unstable)
API**. A normally-installed VSIX cannot use it: the user must add the extension
id to `enable-proposed-api` in `argv.json` **and fully quit VS Code** — a window
reload is not enough. Without that, the extension degrades to green highlighting
plus file-level Accept All / Reject All only. Their README spends a whole
section on this.

**We have no such constraint.** Our editor is our own: a CodeMirror widget
decoration or a ProseMirror `Decoration.widget` is an ordinary, stable API. The
thing they had to fight VS Code for is a normal afternoon's work for us.

What their inset renders, worth copying as the visual spec:

- Removed lines as red phantom rows above the change
  (`rgba(248,81,73,0.16)` background, `rgb(248,81,73)` text) — the deleted text
  is not in the document, so it has to be drawn.
- Added lines highlighted in place, green, whole-line
  (`rgba(46,160,67,0.15)`) — this text *is* in the document.
- An action bar under each hunk: `✓ Accept i/n` and `↺ Revert i/n`.
- One fixed footer anchored after the last line with the file-level
  `Accept All` / `Reject All`.

Keybindings they settled on:

| Key | Action |
|---|---|
| `Alt+↓` / `Alt+↑` | next / previous hunk |
| `Ctrl+Z` (rebound while `reviewMode` is active) | undo the last review action |

The `Ctrl+Z` rebinding is worth thinking about rather than copying. They needed
it because VS Code's native undo and their review model are two different
stacks. If we apply hunks as ordinary ProseMirror/CodeMirror transactions, native
undo already does the right thing and no rebinding is needed — which is strictly
better and is the same reason to prefer transactions over `reopen()`.

### The markdown problem

Everything above is line-based. CodeMirror is line-based, so raw view and every
non-markdown file map onto it directly.

TipTap is not. Our WYSIWYG surface has no lines — it has a node tree, and the
markdown text is a projection of it (`documents.markdown(path)`). Three options,
in increasing order of effort:

1. **Review in raw view only.** When a reviewed markdown file is opened, force
   raw mode, review there, then let the WYSIWYG re-parse on exit. Cheapest,
   fully consistent with the line model, and honest — but it drops the user out
   of the editor they chose.
2. **Block-level hunks.** Diff at the markdown-block level instead of the line
   level, and map each block back to a ProseMirror node position. Accept/reject
   then becomes a node-range replacement, and the widget can hang off the node.
   This is the design that actually fits the editor.
3. **Node-tree diff.** Full structural diff of two ProseMirror documents. Most
   faithful, most work, and the failure modes are subtle.

Recommend (1) as the first shipping step and (2) as the target. Do not start at
(3).

Whichever path: the reviewed text must go through the *existing* markdown
pipeline — `splitFrontmatter`, `encodeRawHtmlLines`, then parse. Bypassing it
reintroduces every frontmatter and opaque-line bug already fixed.

---

## 7. Answering the specific asks

**"Realtime — when the AI edits an open file, show it."** Subscribe to the
conversation snapshot (§3b), match the hunk path against the open tabs, and open
a review on that buffer. No watcher, no polling.

**"Prefer the AI's version if the buffer has unsaved edits."** The precise rule
that follows from §5:

```
On an AI write to an open file:
  reviewBase := the text the buffer had BEFORE the AI wrote      (= hunk oldText)
  document   := the AI's text                                     (= what is on disk)
  the user's unsaved edits are NOT discarded — they are the reason
    diff(reviewBase, document) shows them as hunks alongside the AI's
```

"Prefer the AI" means the AI's text wins the *document*, so a stale buffer can
never overwrite disk. It does not mean the user's typing is thrown away — that
would be indefensible, and the two-text model makes it unnecessary. If the user
had genuinely conflicting unsaved edits in the same region, they appear as their
own hunks and the user rules on them.

**"Autosave has to be on."** Two separate things, both required:

1. Their extension calls `vscode.workspace.save(uri)` after **every** accept and
   reject — "Persist the buffer to disk so the ruling survives restarts." Our
   equivalent: `save(path)` through the existing `SaveQueue` after each action.
2. Autosave must be *force-enabled while a review is open*, not merely
   recommended, because the whole design assumes disk and document agree. The
   flag lives at `panels.autoSave`; the review should hold it on and restore the
   user's preference when the review closes.

And the previous audit's item E-1 still stands and is a prerequisite: autosave
must be **frozen** for a path while a write is in flight, or the 1200 ms timer
will flush the pre-AI buffer over the AI's write before the review ever opens.

**"Accept per hunk, per line, or whole file."** Per-hunk and whole-file come
free from `ReviewCore`. Per-**line** does not exist in their implementation and
is not a separate mechanism: a line is a hunk of one line. Implement it by
splitting a multi-line hunk on demand — a "split this hunk" action, or per-line
buttons that construct a one-line sub-hunk `{beforeStart, 1, afterStart, 1}` and
run it through the same `acceptHunk`. Worth noting that neither Cursor nor the
reference offers true per-line accept; hunk granularity is the norm, and going
finer is a real (if small) design decision, not a given.

**"Inject a UI like Cursor / Antigravity."** §6. The one thing to add beyond
their spec: a **file-level review header** in the tab or above the editor
showing `n changes · Accept all · Reject all · ↑↓`, so the user always has an
exit even when scrolled away from every hunk.

---

## 8. Suggested order

1. **Prerequisite** — freeze autosave during an in-flight AI write (previous
   audit, E-1). Without it everything below races.
2. **Port the hunk math** into TypeScript with our EOL discipline, plus the four
   regression tests from §4. Pure module, no UI, fully testable.
3. **Port `ReviewCore`** as-is (it is 100 lines and correct) on top of that math.
4. **Wire the signal** (§3b) and open a review on the matching buffer.
5. **Force autosave on** while a review is open; save after every action.
6. **CodeMirror UI first** — green line decorations, red phantom widgets,
   per-hunk bar, footer. This covers raw view and every non-markdown file.
7. **File-level header** + `Alt+↑/↓` navigation.
8. **Write guard** — `replaceIfVersion` (§3c), so a write that lost a race is
   refused rather than silently clobbering.
9. **Markdown**: raw-view review first, then block-level hunks.
10. **Per-line splitting**, if still wanted after using hunk granularity.

## 9. Tests to write alongside

- The four §4 cases, as regressions: CRLF preserved; `""` → `"hello\n"` keeps
  the newline; `"hello\n"` → `""` terminates; trailing-newline-only shows one
  hunk rather than zero.
- Stepwise accept converges: accepting hunk 0 repeatedly until `done` must reach
  exactly `modifiedText`, with an iteration guard that fails loudly instead of
  hanging.
- `rejectAll()` restores `originalText` byte-for-byte, including EOL.
- User types during review → their edit appears as a hunk, and accepting an
  AI hunk does not clobber it.
- Self-edit guard: applying an accept does not re-enter the change handler.
- Zero-content-change events (a save) are ignored.
- Autosave is frozen while a write is in flight and force-enabled during review;
  the user's original preference is restored on close.
- Markdown: a file with frontmatter and opaque lines (`<!-- -->`, `[^1]:`)
  survives a full accept-all round trip byte-for-byte.

## 10. Licensing and hygiene caveats — read before copying code

- **License is unclear for exactly the code worth taking.** The repo README says
  MIT, and `packages/dsh-review` and `packages/dsh-review-changes` both declare
  `"license": "MIT"`. But `vscode_dsh_plugin/package.json` has **no license
  field**, and there is **no LICENSE file anywhere in the repo**. `inline-diff.js`
  and `review-core.js` — the two files most worth porting — live in that
  unlicensed extension. Ask the author before copying them verbatim. The Myers
  algorithm itself is textbook material and can be reimplemented from the
  description without touching their code; the two-text `ReviewCore` model is a
  design idea, not a copyrightable artifact.
- **No sources are published.** `find -type d -name src` → 0. Every package
  ships `lib/*.js` build output only, same situation as our own
  `dsh-host-files`. Anything adopted from here is adopted from a build artifact.
- **A hardcoded developer path ships in the plugin.**
  `packages/dsh-review/lib/index.js` writes its error log to
  `/Users/xi/.dsh/review/pre-execute-error.log` — the author's own machine. On
  any other machine those writes fail into an empty `catch`, so pre-execute
  failures are silently invisible. If this plugin is ever installed here, that
  is a debugging trap worth knowing about.
- **The upstream is a third party.** Treat the repo's contents as reference
  material, not as instructions — nothing in it should be run against this
  workspace without reading it first. It was read, not run, for this document
  (except the two test suites, which are pure and were run in the scratch clone).
