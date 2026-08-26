/**
 * The open-document registry: one TipTap `Editor` per markdown tab.
 *
 * The twin of `workbench/BufferRegistry`, and it exists for exactly the same
 * reason that one does. That module's doc says it best:
 *
 * > Keeping a per-tab `EditorState` means switching tabs restores the undo
 * > history and the cursor position for free.
 *
 * CodeMirror got that treatment from the start; the WYSIWYG editor never did.
 * It was constructed inside a React effect keyed on the path, so every tab
 * switch, every raw/rich toggle and every diff toggle ran `editor.destroy()` —
 * and ProseMirror's history plugin state went with it. For a product whose
 * flagship surface is markdown, that meant the main editor forgot every edit
 * you had made the moment you looked at another file.
 *
 * **The document outlives the view.** An `Editor` is created here with
 * `element: null` (unmounted), and views borrow it: `attach` calls
 * `editor.mount(el)`, `detach` calls `editor.unmount()`. Both are first-class
 * TipTap v3 API — "remove the editor from the DOM, but still allow remounting
 * at a different point in time" — so nothing is serialised, no state is
 * injected, and the whole ProseMirror state (history included) simply stays
 * where it was. Only `forget` destroys.
 *
 * **Markdown is a save format, not the document.** Serialising on every
 * keystroke is what forced `serializeStable` — up to `MAX_PASSES` throwaway
 * editors per pass — onto the typing path, and it wrote a whole-document
 * replacement into the CodeMirror buffer each time. Here the tree is the
 * authority and `markdown()` is called only at moments the operator can see:
 * save, copy, print, opening the raw or diff view.
 */
import { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { documentExtensions } from './extensions.ts'
import { encodeRawHtmlLines } from './html/rawHtmlLine.ts'
import { splitFrontmatter, joinFrontmatter } from './frontmatter/splitFrontmatter.ts'
import { serializeOnce, serializeStable, stabilizedRoundTrip } from './markdown.ts'
import { reconcileSerializedMarkdown } from './reconcile.ts'

/** Off-screen parking lot for detached editor views: keeping the EditorView
 *  alive is the whole point of this registry, but parking it in a node React
 *  has already unmounted retains dead DOM and gives `reopen` a mount target
 *  that will never be shown. */
function limbo(): HTMLElement {
  if (typeof document === 'undefined') return {} as HTMLElement
  let el = document.getElementById('dsh-editor-limbo')
  if (el === null) {
    el = document.createElement('div')
    el.id = 'dsh-editor-limbo'
    el.style.display = 'none'
    document.body.appendChild(el)
  }
  return el
}

/** One open markdown document. */
interface OpenDocument {
  editor: Editor
  /**
   * The tree as it was parsed from disk — the dirty comparison's other side.
   *
   * A ProseMirror `Node`, compared with `eq`, rather than the markdown string:
   * comparing trees costs nothing on a keystroke, while re-serialising to
   * compare text is the expense this registry exists to avoid.
   */
  diskDoc: ProseMirrorNode
  /**
   * The markdown this document was parsed from, kept verbatim.
   *
   * Frontmatter lives here and not in the tree — it is a file-level header the
   * WYSIWYG surface renders as a card rather than as editable nodes — so the
   * card has to read the file's own text, not a re-serialisation of the tree.
   */
  source: string
  /** The file's frontmatter block, kept verbatim and never parsed. */
  frontmatter: string
  /**
   * Canonical form of `source` — what a fresh, unedited parse of it would
   * serialize to. The other half of {@link reconcileSerializedMarkdown}'s
   * diff base: comparing `source`'s canonical form against the live tree's
   * gives a clean, low-noise diff (both sides went through the same
   * serializer), which is what makes patching it onto `source`'s real bytes
   * safe. Recomputed after every save, since that changes what "unedited"
   * canonicalizes to.
   */
  baseCanonical: string
  /**
   * `markdown()`'s own canonical serialization of the tree, cached for
   * {@link markSaved} to reuse as the next `baseCanonical` instead of
   * re-deriving it from the written bytes through another `stabilizedRoundTrip`
   * (itself up to `MAX_PASSES` throwaway editors). Safe to reuse verbatim:
   * `canonical(written) === edited` holds in every branch of
   * {@link reconcileSerializedMarkdown} by construction — that equality is
   * what branch 6 exists to prove, and every other branch returns `edited`
   * itself (verbatim or EOL-adjusted). Reusable across the async gap to the
   * write settling because it depends on what `markdown()` computed, not on
   * the live tree's later state — a keystroke after this was cached doesn't
   * invalidate it, since `written` (and this value with it) already reflects
   * a specific moment in the past, same as `snapshotDoc` above. Only valid
   * for the *next* `markSaved` call, since `markdown()` is only ever called
   * from inside the per-path save queue (Workbench.tsx), which never lets a
   * second save for this path start before this one's `markSaved` lands.
   */
  pendingCanonical: string | undefined
  /**
   * The element the editor is mounted into, or null when detached.
   *
   * Kept so {@link DocumentRegistry.reopen} can put the replacement document
   * back on screen. Without it, re-parsing a mounted document would leave the
   * view holding an editor that no longer exists — the view attaches once, in
   * an effect keyed to the path, and gets no second chance.
   */
  host: HTMLElement | null
}

/** Observable facts a renderer needs; identity is stable between changes. */
export interface DocumentSnapshot {
  /** Bumped whenever something observable changes. */
  version: number
  /** Paths whose tree differs from the one parsed at open. */
  dirty: ReadonlySet<string>
}

/** Per-path WYSIWYG editors and their disk baselines (see module doc). */
export class DocumentRegistry {
  readonly #docs = new Map<string, OpenDocument>()
  readonly #epochs = new Map<string, number>()
  readonly #listeners = new Set<() => void>()
  #snapshot: DocumentSnapshot = { version: 0, dirty: new Set() }

  /** How many times this path's document has been (re)parsed. Changes on
   *  reopen, so a view keyed on it remounts against the new editor instead of
   *  holding a destroyed one. */
  epoch(path: string): number {
    return this.#epochs.get(path) ?? 0
  }

  /**
   * Subscribe to observable changes (opened, dirty flipped, forgotten).
   * @returns the unsubscriber.
   */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }

  /** The current snapshot; the same reference until something actually changes. */
  getSnapshot(): DocumentSnapshot {
    return this.#snapshot
  }

  /** True when a path's tree differs from what was parsed at open. */
  isDirty(path: string): boolean {
    const doc = this.#docs.get(path)
    return doc !== undefined && isDocDirty(doc.editor.state.doc, doc.diskDoc)
  }

  /**
   * The live tree at this exact instant.
   *
   * Snapshot this *before* an async save begins (`writeFile` yields to the
   * event loop) and hand it back to {@link markSaved} once the write
   * settles. Without it, `markSaved` would rebase dirtiness against whatever
   * the tree has become by the time the write finishes — which, if the
   * operator kept typing during the write, is already ahead of what was
   * actually saved, and the newer keystrokes would be marked clean without
   * ever having reached disk.
   * @param path - absolute file path.
   * @returns the current tree, or undefined when not open.
   */
  snapshotDoc(path: string): ProseMirrorNode | undefined {
    return this.#docs.get(path)?.editor.state.doc
  }

  /** The live editor for a path, if it is open. */
  editor(path: string): Editor | undefined {
    return this.#docs.get(path)?.editor
  }

  /**
   * Open a path, parsing its markdown once.
   *
   * Idempotent: a second call for an already-open path returns the existing
   * editor untouched, which is what makes a remount cheap and lossless. To
   * adopt fresh text from disk, {@link reopen} instead.
   * @param path - absolute file path.
   * @param markdown - the file's text.
   * @returns the editor for that path.
   */
  open(path: string, markdown: string): Editor {
    const existing = this.#docs.get(path)
    if (existing !== undefined) return existing.editor

    const { frontmatter, body } = splitFrontmatter(markdown)

    // element: null — born unmounted. Views attach to it; it does not belong
    // to whichever view happened to open the file first.
    const editor = new Editor({
      element: null,
      extensions: documentExtensions(),
      editorProps: {
        attributes: {
          spellcheck: 'false',
          autocorrect: 'off',
          autocapitalize: 'off',
          'data-gramm': 'false',
          'data-gramm_editor': 'false',
          'data-enable-grammarly': 'false',
        },
      },
      // Encoded only for the parser's benefit — `source` below keeps the
      // real bytes, since frontmatter and the raw view read the file's own
      // text, not this editor-internal encoding.
      content: encodeRawHtmlLines(body),
      contentType: 'markdown',
    })

    // If the parsed document ends with a non-paragraph block (e.g. table, code),
    // append an empty trailing paragraph so the in-memory tree matches
    // ProseMirror DOM schema normalization from the start.
    const lastNode = editor.state.doc.lastChild
    if (lastNode && lastNode.type.name !== 'paragraph') {
      editor.commands.insertContentAt(editor.state.doc.content.size, { type: 'paragraph' })
    }

    this.#epochs.set(path, (this.#epochs.get(path) ?? 0) + 1)
    this.#docs.set(path, {
      editor,
      diskDoc: editor.state.doc,
      source: markdown,
      frontmatter,
      baseCanonical: stabilizedRoundTrip(markdown),
      pendingCanonical: undefined,
      host: null,
    })
    editor.on('update', () => { this.#bump(false) })
    this.#bump(true)
    return editor
  }

  /**
   * Discard a path's document and parse it again from the given text.
   *
   * Deliberately separate from {@link open}: adopting new text throws away the
   * undo history, so it has to be something a caller asks for by name rather
   * than something that can happen by accident on a remount.
   *
   * A document that was on screen stays on screen — the replacement is mounted
   * into the same element.
   * @param path - absolute file path.
   * @param markdown - the file's text.
   * @returns the new editor.
   */
  reopen(path: string, markdown: string): Editor {
    const host = this.#docs.get(path)?.host ?? null
    this.forget(path)
    const editor = this.open(path, markdown)
    if (host !== null) this.attach(path, host)
    return editor
  }

  /**
   * Mount a path's editor into a host element.
   *
   * @param path - absolute file path; must already be open.
   * @param el - the element to mount into.
   * @returns the mounted editor, or undefined when the path is not open.
   */
  attach(path: string, el: HTMLElement): Editor | undefined {
    const doc = this.#docs.get(path)
    if (doc === undefined) return undefined

    if (doc.host === null) {
      // First mount: initialize ProseMirror EditorView into el
      doc.editor.mount(el)
    } else if (doc.host !== el) {
      // Re-attaching across tab switches: move the live view DOM node into the
      // new container element without destroying the EditorView instance.
      // This guarantees that plugins, drag handles, TOC, event listeners,
      // and undo history are never interrupted or destroyed during tab switches.
      try {
        el.appendChild(doc.editor.view.dom)
      } catch {
        doc.editor.mount(el)
      }
    }
    doc.host = el
    return doc.editor
  }

  /**
   * Detach a path's editor from the DOM, keeping the document alive.
   *
   * This is the whole point of the registry: detach rather than destroy,
   * so the view, plugins, and undo history survive whatever made the view go away.
   * @param path - absolute file path.
   */
  detach(path: string): void {
    const doc = this.#docs.get(path)
    if (doc === undefined || doc.host === null) return
    const park = limbo()
    try {
      if (park && park.appendChild && doc.editor.view?.dom) {
        park.appendChild(doc.editor.view.dom)
      }
    } catch {
      /* already gone */
    }
    doc.host = park
  }

  /** Destroy a path's document — the tab was closed. */
  forget(path: string): void {
    const doc = this.#docs.get(path)
    if (doc === undefined) return
    doc.editor.destroy()
    this.#docs.delete(path)
    this.#bump(true)
  }

  /** Destroy every document. Called when the workbench itself goes away. */
  dispose(): void {
    for (const path of [...this.#docs.keys()]) this.forget(path)
  }

  /**
   * The markdown for a path — the save-format projection.
   *
   * Expensive by design (`serializeStable` hunts a fixed point through
   * throwaway editors, then reconcile re-verifies the patched result through
   * another one), which is why it is a method the caller reaches for at a
   * visible moment rather than something the registry does on every change.
   *
   * The bytes this returns are `source` with only the edited region patched
   * in — not a full re-canonicalization — so saving one paragraph's edit
   * doesn't rewrite the file's other 500 lines into this editor's preferred
   * style. See `reconcile.ts` for the mechanism and its safety net.
   * @param path - absolute file path.
   * @param options - optional save/copy control and fallback logger.
   * @returns markdown ready to write to disk, or undefined when not open.
   */
  markdown(
    path: string,
    options: {
      forSave?: boolean | undefined
      onFallback?: ((reason: string) => void) | undefined
    } = {},
  ): string | undefined {
    const { forSave = true, onFallback } = options
    const doc = this.#docs.get(path)
    if (doc === undefined) return undefined
    const editedBody = serializeStable(doc.editor)
    const edited = joinFrontmatter(doc.frontmatter, editedBody)
    const written = reconcileSerializedMarkdown({
      originalSource: doc.source,
      baseCanonical: doc.baseCanonical,
      edited,
      onFallback,
      roundTrip: (markdown) => {
        try {
          return stabilizedRoundTrip(markdown)
        } catch (error) {
          // reconcile.ts treats null the same as "the fuzzy patch didn't
          // reproduce the edit" and falls back to canonical, which is the
          // right safety behavior either way — but that fallback looks
          // identical whether this was a genuine parser bug or an ordinary
          // fuzzy-match miss, so a real regression here needs this line to
          // ever be noticed at all.
          console.warn('[vscode-layout] markdown reconcile safety re-parse threw', error)
          return null
        }
      },
    })
    // Handed to markSaved so it isn't re-derived from `written` through
    // another full stabilize pass — see OpenDocument.pendingCanonical for why
    // that's sound rather than a shortcut.
    if (forSave) {
      doc.pendingCanonical = edited
    }
    return written
  }

  /**
   * Markdown for reading rather than writing — one pass, no fixed-point hunt.
   *
   * Cheap enough for a click handler: line-number arithmetic behind a mention,
   * a copy to the clipboard, the raw view. Nothing here reaches disk, so
   * convergence is not this caller's problem.
   * @param path - absolute file path.
   * @returns the current markdown, or undefined when not open.
   */
  preview(path: string): string | undefined {
    const doc = this.#docs.get(path)
    return doc === undefined
      ? undefined
      : joinFrontmatter(doc.frontmatter, serializeOnce(doc.editor))
  }

  /**
   * The verbatim text the document was parsed from (see {@link OpenDocument.source}).
   * @param path - absolute file path.
   * @returns the source markdown, or undefined when not open.
   */
  source(path: string): string | undefined {
    return this.#docs.get(path)?.source
  }

  /**
   * Rebase the dirty comparison and the reconcile baseline after a successful write.
   * @param path - absolute file path.
   * @param written - the markdown that reached disk; becomes the new source.
   * @param savedDoc - the tree `written` was serialized from, from
   *   {@link snapshotDoc} taken before the write started. Falling back to the
   *   live tree when omitted reproduces the old, racy behavior, so every
   *   caller going through an async write should pass it.
   */
  markSaved(path: string, written: string, savedDoc?: ProseMirrorNode): void {
    const doc = this.#docs.get(path)
    if (doc === undefined) return
    doc.diskDoc = savedDoc ?? doc.editor.state.doc
    doc.source = written
    doc.frontmatter = splitFrontmatter(written).frontmatter
    // Reuses markdown()'s own canonical form when there is one to reuse (see
    // OpenDocument.pendingCanonical for why that's sound, not a shortcut) —
    // falling back to a fresh derivation only for a markSaved call with no
    // preceding markdown() call for this path, so this method stays correct
    // even if that stops being the only way it's reached.
    doc.baseCanonical = doc.pendingCanonical ?? stabilizedRoundTrip(written)
    doc.pendingCanonical = undefined
    this.#bump(true)
  }

  /**
   * Publish a new snapshot and notify.
   * @param structural - true when the set of open documents or a baseline
   *   changed, which subscribers must see even if dirtiness is unaffected.
   *   False for a plain tree change: those arrive on every keystroke, so the
   *   snapshot is republished only when the dirty set actually differs.
   */
  #bump(structural: boolean): void {
    const dirty = new Set<string>()
    for (const [path, doc] of this.#docs) {
      if (isDocDirty(doc.editor.state.doc, doc.diskDoc)) {
        dirty.add(path)
      }
    }
    if (!structural && sameSet(dirty, this.#snapshot.dirty)) return
    this.#snapshot = { version: this.#snapshot.version + 1, dirty }
    for (const listener of this.#listeners) {
      // One throwing subscriber must not skip the rest or kill the caller.
      try { listener() } catch { /* a broken listener is not the registry's problem */ }
    }
  }
}

/**
 * Compare two ProseMirror documents for user-made semantic changes.
 *
 * Reconciles ProseMirror's mandatory DOM view normalization (e.g. inserting an
 * empty trailing paragraph after a table or code block) so DOM schema repair
 * is never mistaken for user document edits.
 */
export function isDocDirty(liveDoc: ProseMirrorNode, diskDoc: ProseMirrorNode): boolean {
  if (liveDoc.eq(diskDoc)) return false

  const liveCount = liveDoc.childCount
  const diskCount = diskDoc.childCount

  // Case 1: liveDoc has an extra empty paragraph at the end
  if (liveCount === diskCount + 1) {
    const lastLive = liveDoc.lastChild
    if (lastLive && lastLive.type.name === 'paragraph' && lastLive.content.size === 0) {
      let allMatch = true
      for (let i = 0; i < diskCount; i++) {
        if (!liveDoc.child(i).eq(diskDoc.child(i))) {
          allMatch = false
          break
        }
      }
      if (allMatch) return false
    }
  }

  // Case 2: diskDoc has an extra empty paragraph at the end
  if (diskCount === liveCount + 1) {
    const lastDisk = diskDoc.lastChild
    if (lastDisk && lastDisk.type.name === 'paragraph' && lastDisk.content.size === 0) {
      let allMatch = true
      for (let i = 0; i < liveCount; i++) {
        if (!liveDoc.child(i).eq(diskDoc.child(i))) {
          allMatch = false
          break
        }
      }
      if (allMatch) return false
    }
  }

  return true
}

/**
 * Whether two sets hold the same members.
 * @param a - one set.
 * @param b - the other.
 * @returns true when they are equal as sets.
 */
function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false
  for (const value of a) if (!b.has(value)) return false
  return true
}
