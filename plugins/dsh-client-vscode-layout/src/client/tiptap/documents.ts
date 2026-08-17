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
import { serializeOnce, serializeStable } from './markdown.ts'

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
  readonly #listeners = new Set<() => void>()
  #snapshot: DocumentSnapshot = { version: 0, dirty: new Set() }

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
    return doc !== undefined && !doc.editor.state.doc.eq(doc.diskDoc)
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

    // element: null — born unmounted. Views attach to it; it does not belong
    // to whichever view happened to open the file first.
    const editor = new Editor({
      element: null,
      extensions: documentExtensions(),
      content: markdown,
    })
    this.#docs.set(path, { editor, diskDoc: editor.state.doc, source: markdown, host: null })
    // Dirtiness is derived, so the only listener this registry needs is one
    // that fires when the tree changes. Serialisation is not in this path, and
    // `structural: false` keeps a keystroke from re-rendering the workbench
    // unless it actually flipped the dirty flag.
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
    // Guard against a double mount: React can run an effect twice in
    // development, and mounting a live editor again would build a second view
    // over the same state.
    if (doc.host !== null) doc.editor.unmount()
    doc.editor.mount(el)
    doc.host = el
    // No bump: mounting changes nothing anybody observes through the snapshot,
    // and notifying from inside a view's mount effect would re-render the tree
    // that is still committing.
    return doc.editor
  }

  /**
   * Detach a path's editor from the DOM, keeping the document alive.
   *
   * This is the whole point of the registry: `unmount` rather than `destroy`,
   * so the undo history survives whatever made the view go away.
   * @param path - absolute file path.
   */
  detach(path: string): void {
    const doc = this.#docs.get(path)
    if (doc === undefined || doc.host === null) return
    doc.editor.unmount()
    doc.host = null
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
   * throwaway editors), which is why it is a method the caller reaches for at
   * a visible moment rather than something the registry does on every change.
   * @param path - absolute file path.
   * @returns markdown that regenerates to itself, or undefined when not open.
   */
  markdown(path: string): string | undefined {
    const doc = this.#docs.get(path)
    return doc === undefined ? undefined : serializeStable(doc.editor)
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
    return doc === undefined ? undefined : serializeOnce(doc.editor)
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
   * Rebase the dirty comparison after a successful write.
   * @param path - absolute file path.
   * @param written - the markdown that reached disk; becomes the new source.
   */
  markSaved(path: string, written: string): void {
    const doc = this.#docs.get(path)
    if (doc === undefined) return
    doc.diskDoc = doc.editor.state.doc
    doc.source = written
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
      if (!doc.editor.state.doc.eq(doc.diskDoc)) dirty.add(path)
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
