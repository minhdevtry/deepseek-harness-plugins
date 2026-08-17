/**
 * The open-file registry: one CodeMirror `EditorState` per open tab, plus the
 * disk text each is compared against.
 *
 * This is the piece that decides how the editor behaves, so it is a plain
 * class with no React and no DOM — constructible and assertable in a test.
 *
 * **CodeMirror owns the document; React owns only metadata.** Nothing here
 * copies file text into React state. Keeping a per-tab `EditorState` means
 * switching tabs restores the undo history and the cursor position for free,
 * which the previous editor could not do — it kept one textarea and re-read
 * its text out of the DOM with `querySelector`.
 *
 * Dirtiness compares `Text` objects (`doc.eq`), not strings. CodeMirror's rope
 * short-circuits on shared structure, so the check stays cheap on every
 * keystroke where `toString()` on a large file would not.
 */
import { EditorState, Transaction, type Extension, type Text } from '@codemirror/state'
import { readFile, writeFile, type ApiResult } from '../api/files.ts'

/** What the registry knows about one path. */
export type BufferStatus =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  /** Not text; there is nothing to edit and nothing to show. */
  | { kind: 'binary'; size: number }
  | {
    kind: 'text'
    /** Live editor state — replaced on every sync from the view. */
    state: EditorState
    /** The document as it stands on disk; the dirty comparison's other side. */
    diskDoc: Text
    dirty: boolean
    /**
     * True when the host truncated the file. The buffer opens read-only:
     * saving a truncated document back would destroy everything past the cut.
     */
    truncated: boolean
    /** Size on disk in bytes. */
    size: number
  }

/** Observable facts a renderer needs; identity is stable between changes. */
export interface BufferSnapshot {
  /** Bumped on every notified change, so consumers can memoise against it. */
  version: number
  /** Paths with unsaved edits. */
  dirty: ReadonlySet<string>
}

/**
 * Builds the per-path extension set (language, theme, keymaps).
 * Supplied by the caller so this module stays free of view concerns.
 */
export type ExtensionsFor = (path: string, readOnly: boolean) => Extension

/** Per-path editor states and their disk baselines (see module doc). */
export class BufferRegistry {
  readonly #buffers = new Map<string, BufferStatus>()
  readonly #listeners = new Set<() => void>()
  readonly #extensionsFor: ExtensionsFor
  /** In-flight loads, so two tabs opening the same path issue one read. */
  readonly #loading = new Map<string, Promise<void>>()
  /**
   * Per-path load token. Closing or reloading a path bumps it, which retires
   * any read still in flight for the previous token — without this, an
   * in-flight read shared through {@link #loading} would be handed to the
   * caller that superseded it and then discard its own result, leaving the
   * reopened tab permanently blank.
   */
  readonly #loadToken = new Map<string, number>()
  #snapshot: BufferSnapshot = { version: 0, dirty: new Set() }

  constructor(extensionsFor: ExtensionsFor) {
    this.#extensionsFor = extensionsFor
  }

  /**
   * Subscribe to observable changes (load settled, dirty flipped, buffer
   * forgotten). Keystrokes that do not change dirtiness do not notify.
   * @returns the unsubscriber.
   */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }

  /** The current snapshot; the same reference until something actually changes. */
  getSnapshot(): BufferSnapshot {
    return this.#snapshot
  }

  /** What the registry knows about one path, or undefined if never opened. */
  status(path: string): BufferStatus | undefined {
    return this.#buffers.get(path)
  }

  /** True when a path has edits not yet written to disk. */
  isDirty(path: string): boolean {
    const buffer = this.#buffers.get(path)
    return buffer?.kind === 'text' && buffer.dirty
  }

  /**
   * Read a file into a buffer, unless it is already loaded or loading.
   *
   * Concurrent callers share one request: the explorer can open a file the
   * status bar is already resolving, and issuing the read twice would be both
   * wasteful and racy.
   */
  async load(path: string): Promise<void> {
    if (this.#buffers.has(path)) return
    const existing = this.#loading.get(path)
    if (existing !== undefined) return existing

    const token = this.#nextToken(path)
    const work = (async () => {
      this.#buffers.set(path, { kind: 'loading' })
      this.#bump()
      const result = await readFile(path)
      // Retired while in flight: the tab was closed, or a reload superseded
      // this read. Adopting the result would resurrect a buffer nobody asked
      // for, or overwrite a fresher one.
      if (this.#loadToken.get(path) !== token) return
      this.#buffers.set(path, this.#buffer(path, result))
      this.#bump()
    })()

    this.#loading.set(path, work)
    // Only clear the slot if it is still ours: a retired load must not evict
    // the entry belonging to the load that replaced it.
    void work.finally(() => { if (this.#loading.get(path) === work) this.#loading.delete(path) })
    return work
  }

  /** Discard a buffer and re-read it from disk. */
  async reload(path: string): Promise<void> {
    this.#retire(path)
    this.#buffers.delete(path)
    return this.load(path)
  }

  /**
   * Adopt the view's current state.
   *
   * Called on every editor update, so it must stay cheap: the state is a
   * reference assignment, and listeners are notified only when the dirty flag
   * actually flips — otherwise every keystroke would re-render the tab strip.
   */
  sync(path: string, state: EditorState): void {
    const buffer = this.#buffers.get(path)
    if (buffer?.kind !== 'text') return
    buffer.state = state
    const dirty = !state.doc.eq(buffer.diskDoc)
    if (dirty === buffer.dirty) return
    buffer.dirty = dirty
    this.#bump()
  }

  /**
   * Replace a buffer's text content directly (e.g. projected from the WYSIWYG tree).
   *
   * Dispatches a transaction across the whole document so extensions stay valid,
   * recomputes dirtiness against the disk document, and notifies if changed.
   *
   * @param path - absolute file path.
   * @param text - the replacement text.
   * @param opts.addToHistory - whether the replacement is undoable here.
   *   Pass `false` for a projection of a document owned elsewhere: the write is
   *   not an edit anybody made in *this* buffer, and recording it would put a
   *   whole-document replacement on the undo stack that steps past every real
   *   edit around it. Defaults to true, which is right for a genuine text edit.
   */
  setText(path: string, text: string, opts?: { addToHistory?: boolean }): void {
    const buffer = this.#buffers.get(path)
    if (buffer?.kind !== 'text') return
    if (buffer.state.doc.toString() === text) return
    const transaction = buffer.state.update({
      changes: { from: 0, to: buffer.state.doc.length, insert: text },
      ...(opts?.addToHistory === false
        ? { annotations: Transaction.addToHistory.of(false) }
        : {}),
    })
    buffer.state = transaction.state
    const dirty = !buffer.state.doc.eq(buffer.diskDoc)
    if (dirty === buffer.dirty) return
    buffer.dirty = dirty
    this.#bump()
  }

  /** Current text content of a loaded text buffer, if any. */
  getText(path: string): string | undefined {
    const buffer = this.#buffers.get(path)
    return buffer?.kind === 'text' ? buffer.state.doc.toString() : undefined
  }

  /**
   * Write a buffer to disk and rebase its dirty comparison.
   *
   * The document written is the one captured at call time, and that same
   * document becomes the new baseline — not whatever the buffer holds when the
   * response lands. Typing during a save must stay dirty rather than being
   * marked clean against text that was never written.
   */
  async save(path: string): Promise<ApiResult<void>> {
    const buffer = this.#buffers.get(path)
    if (buffer?.kind !== 'text') return { ok: false, error: 'nothing to save' }
    if (buffer.truncated) return { ok: false, error: 'file is too large to edit safely' }

    const written = buffer.state.doc
    const result = await writeFile(path, written.toString())
    if (!result.ok) return result

    const current = this.#buffers.get(path)
    if (current?.kind !== 'text') return { ok: true, value: undefined }
    current.diskDoc = written
    const dirty = !current.state.doc.eq(written)
    if (dirty !== current.dirty) {
      current.dirty = dirty
      this.#bump()
    }
    return { ok: true, value: undefined }
  }

  /**
   * A transaction that restores the disk text.
   *
   * Returned rather than applied because only the live view can dispatch it —
   * and going through the view keeps the revert in the undo history, so an
   * accidental discard is recoverable with Ctrl+Z.
   * @returns the transaction spec, or undefined when there is nothing to undo.
   */
  revertSpec(path: string): { changes: { from: number; to: number; insert: Text } } | undefined {
    const buffer = this.#buffers.get(path)
    if (buffer?.kind !== 'text' || !buffer.dirty) return undefined
    return { changes: { from: 0, to: buffer.state.doc.length, insert: buffer.diskDoc } }
  }

  /** Drop a buffer entirely — the tab was closed. */
  forget(path: string): void {
    this.#retire(path)
    if (!this.#buffers.delete(path)) return
    this.#bump()
  }

  /** Invalidate any in-flight read for a path and free its shared slot. */
  #retire(path: string): void {
    this.#nextToken(path)
    this.#loading.delete(path)
  }

  /** Advance and return the path's load token. */
  #nextToken(path: string): number {
    const token = (this.#loadToken.get(path) ?? 0) + 1
    this.#loadToken.set(path, token)
    return token
  }

  /** Build the buffer for a settled read. */
  #buffer(path: string, result: ApiResult<{ kind: string; content: string; size: number }>): BufferStatus {
    if (!result.ok) return { kind: 'error', message: result.error }
    const { kind, content, size } = result.value
    if (kind === 'binary') return { kind: 'binary', size }
    const truncated = kind === 'too-large'
    const state = EditorState.create({
      doc: content,
      extensions: [this.#extensionsFor(path, truncated)],
    })
    return { kind: 'text', state, diskDoc: state.doc, dirty: false, truncated, size }
  }

  /** Publish a new snapshot and notify. */
  #bump(): void {
    const dirty = new Set<string>()
    for (const [path, buffer] of this.#buffers) {
      if (buffer.kind === 'text' && buffer.dirty) dirty.add(path)
    }
    this.#snapshot = { version: this.#snapshot.version + 1, dirty }
    for (const listener of this.#listeners) {
      // One throwing subscriber must not skip the rest or kill the caller.
      try { listener() } catch { /* a broken listener is not the registry's problem */ }
    }
  }
}
