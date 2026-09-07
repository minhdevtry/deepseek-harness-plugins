/**
 * The CodeMirror host: one `EditorView` bound to the active path.
 *
 * The view is created from the buffer's stored `EditorState` and, on the way
 * out, hands its final state back to the registry. That round trip is what
 * makes tab switching preserve undo history and cursor position — the state
 * object *is* the tab's memory, not something reconstructed from text.
 *
 * React never renders the document. It owns one empty div; everything inside
 * belongs to CodeMirror. Re-rendering this component does not touch the editor.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { EditorView, keymap } from '@codemirror/view'
import { Compartment, EditorState, StateEffect, Transaction, type Extension, type Text, type TransactionSpec } from '@codemirror/state'
import {
  unifiedMergeView,
  getChunks,
  getOriginalDoc,
  acceptChunk,
  rejectChunk,
  goToNextChunk,
  goToPreviousChunk,
} from '@codemirror/merge'
import type { BufferRegistry } from './buffers.ts'
import css from './CodeEditor.module.css'

/** Where the caret is, for the status bar. */
export interface CursorInfo {
  /** 1-based line number. */
  line: number
  /** 1-based column. */
  column: number
  /** Characters covered by the selection (0 when it is a bare caret). */
  selected: number
}

/** Diff modes for CodeEditor */
export type DiffMode =
  | { kind: 'none' }
  /** Save preview: what is on disk vs what is in the buffer. */
  | { kind: 'unsaved'; baseline: Text | string }
  /**
   * AI review: the pre-AI text vs current buffer, with baseline undo stack.
   * `turnId` groups this entry with every other file the same agent turn
   * touched, for a per-turn surface (the in-chat review card) that has no
   * other way to know which files belong together.
   */
  | {
      kind: 'ai-review'
      baseline: Text | string
      snapshots?: string[]
      turnId?: string | undefined
      /**
       * The pre-write frontmatter block (fences included, or `''`), for
       * markdown only. `undefined` means "not computed" (a non-markdown
       * path, or a review started before this field existed), distinct from
       * `''` meaning "the baseline genuinely had no frontmatter."
       */
      frontmatterBaseline?: string | undefined
    }

/**
 * Live review stats, reported on every transaction (see `onReviewStatsChange`).
 *
 * `baseline`/`snapshots` exist so a REMOUNT can re-arm from wherever the
 * review actually is, not from the value React was handed when the review
 * started: accept advances the merge view's internal baseline directly
 * (never through React), so without an echo channel back to the owner, a
 * tab switch would silently reconfigure from the ORIGINAL pre-accept
 * baseline and every already-resolved hunk would reappear.
 */
export interface ReviewStats {
  count: number
  canUndo: boolean
  /** The live merge view's current baseline text, or `''` when disarmed. */
  baseline: string
  /** The live undo-snapshot stack. */
  snapshots: readonly string[]
}

/** Editor props. */
export interface CodeEditorProps {
  /** Absolute path of the buffer to show; changing it remounts via `key`. */
  path: string
  registry: BufferRegistry
  /** 1-based line to reveal once on open — a search hit's target. */
  revealLine?: number | undefined
  /** Explicit diff mode. Takes precedence over diffOriginal. */
  diffMode?: DiffMode | undefined
  /** Original disk document when inline per-hunk diff is active (legacy/fallback). */
  diffOriginal?: Text | string | undefined
  /** Lock the document against editing. */
  readOnly?: boolean | undefined
  onCursor: (info: CursorInfo) => void
  /** Notified on every transaction that could have changed review state. */
  onReviewStatsChange?: (stats: ReviewStats) => void
}

/**
 * Commands the column issues to the live view.
 */
export interface CodeEditorHandle {
  /** Apply a transaction — the revert path, which stays undoable this way. */
  dispatch: (spec: TransactionSpec) => void
  focus: () => void
  /**
   * Replace the whole document with externally-supplied text — e.g. adopting
   * an AI write into this already-mounted view — without recording it in
   * this buffer's own undo history: the change did not originate as an edit
   * made through this view, the same reasoning `BufferRegistry.setText`'s
   * `addToHistory: false` documents for a tree projection. Unlike
   * `registry.setText`, this reaches the live view directly, so it cannot be
   * silently reverted by the view's own next transaction.
   */
  applyExternalText: (text: string) => void
  acceptAll: () => void
  rejectAll: () => void
  undoReview: () => boolean
  nextChunk: () => boolean
  prevChunk: () => boolean
  getChunkCount: () => number
}

/** The editing surface (see module doc). */
export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { path, registry, revealLine, diffMode, diffOriginal, readOnly, onCursor, onReviewStatsChange }: CodeEditorProps,
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const diffCompartment = useRef(new Compartment())
  const readOnlyCompartment = useRef(new Compartment())
  const baselineSnapshotsRef = useRef<string[]>([])

  // Latest-callback ref: the update listener is baked into the view for its
  // whole lifetime, but must always reach the current handler.
  const cursorRef = useRef(onCursor)
  cursorRef.current = onCursor

  const statsCallbackRef = useRef(onReviewStatsChange)
  statsCallbackRef.current = onReviewStatsChange

  const updateStats = (view: EditorView | null) => {
    if (!view || !statsCallbackRef.current) return
    const count = getChunks(view.state)?.chunks.length ?? 0
    let baseline = ''
    try {
      baseline = getOriginalDoc(view.state).toString()
    } catch {
      // originalDoc isn't part of the current config — the merge view is
      // disarmed (diffMode isn't 'ai-review' right now). The caller only
      // acts on this while it still believes the review is live.
    }
    statsCallbackRef.current({
      count,
      canUndo: baselineSnapshotsRef.current.length > 0,
      baseline,
      snapshots: baselineSnapshotsRef.current,
    })
  }

  const onBeforeAccept = () => {
    const view = viewRef.current
    if (!view) return
    try {
      const orig = getOriginalDoc(view.state).toString()
      baselineSnapshotsRef.current.push(orig)
    } catch {
      // Ignored if originalDoc field not yet attached
    }
  }

  const renderMergeControls = (type: 'reject' | 'accept', action: (e: MouseEvent) => void): HTMLElement => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = type === 'accept' ? 'dsh-review-accept' : 'dsh-review-reject'
    btn.textContent = type === 'accept' ? '✓ Giữ' : '✕ Bỏ'
    btn.title = type === 'accept' ? 'Chấp nhận thay đổi này (Giữ)' : 'Từ chối thay đổi này (Bỏ)'
    btn.addEventListener('click', (e) => {
      if (type === 'accept') {
        onBeforeAccept()
      }
      action(e)
    })
    return btn
  }

  useImperativeHandle(ref, () => ({
    dispatch: (spec) => { viewRef.current?.dispatch(spec) },
    focus: () => { viewRef.current?.focus() },
    applyExternalText: (text) => {
      const view = viewRef.current
      if (!view) return
      if (view.state.doc.toString() === text) return
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        annotations: Transaction.addToHistory.of(false),
      })
    },
    acceptAll: () => {
      const view = viewRef.current
      if (!view) return
      const chunks = getChunks(view.state)?.chunks ?? []
      if (chunks.length === 0) return
      onBeforeAccept()
      for (let i = chunks.length - 1; i >= 0; i--) {
        const chunk = chunks[i]
        if (chunk) acceptChunk(view, chunk.fromB)
      }
      updateStats(view)
    },
    rejectAll: () => {
      const view = viewRef.current
      if (!view) return
      const chunks = getChunks(view.state)?.chunks ?? []
      if (chunks.length === 0) return
      for (let i = chunks.length - 1; i >= 0; i--) {
        const chunk = chunks[i]
        if (chunk) rejectChunk(view, chunk.fromB)
      }
      updateStats(view)
    },
    undoReview: () => {
      const view = viewRef.current
      if (!view || baselineSnapshotsRef.current.length === 0) return false
      const prevBaseline = baselineSnapshotsRef.current.pop()!
      view.dispatch({
        effects: diffCompartment.current.reconfigure(
          buildDiffExtensions(prevBaseline, true)
        ),
      })
      updateStats(view)
      return true
    },
    nextChunk: () => {
      const view = viewRef.current
      if (!view) return false
      return goToNextChunk(view)
    },
    prevChunk: () => {
      const view = viewRef.current
      if (!view) return false
      return goToPreviousChunk(view)
    },
    getChunkCount: () => {
      const view = viewRef.current
      if (!view) return 0
      return getChunks(view.state)?.chunks.length ?? 0
    },
  }), [])

  // Resolve active baseline
  const activeBaseline: Text | string | undefined =
    diffMode?.kind === 'ai-review'
      ? diffMode.baseline
      : diffMode?.kind === 'unsaved'
        ? diffMode.baseline
        : diffOriginal

  const buildDiffExtensions = (baseline: Text | string | undefined, isAiReview: boolean) => {
    if (baseline === undefined) return []
    return [
      unifiedMergeView({
        original: baseline,
        mergeControls: isAiReview ? renderMergeControls : true,
      }),
      keymap.of([
        { key: 'Alt-ArrowDown', run: goToNextChunk },
        { key: 'Alt-ArrowUp', run: goToPreviousChunk },
      ]),
    ]
  }

  useEffect(() => {
    const host = hostRef.current
    const buffer = registry.status(path)
    if (host === null || buffer?.kind !== 'text') return

    // Stable per-path pair, not a fresh one per mount — see
    // BufferRegistry.mergeCompartments. A remount reassigns these refs to the
    // SAME objects a previous mount used, which is what makes reconfigure
    // (below, and in the effects further down) actually reach the live state
    // instead of being permanently shadowed by the first mount's compartment.
    const compartments = registry.mergeCompartments(path)
    if (compartments === undefined) return
    diffCompartment.current = compartments.diff
    readOnlyCompartment.current = compartments.readOnly

    if (diffMode?.kind === 'ai-review' && diffMode.snapshots) {
      baselineSnapshotsRef.current = [...diffMode.snapshots]
    } else if (diffMode?.kind !== 'ai-review') {
      baselineSnapshotsRef.current = []
    }

    const wantedDiff = buildDiffExtensions(activeBaseline, diffMode?.kind === 'ai-review')
    const wantedReadOnly = lockExtension(readOnly === true)
    // True for every mount after this path's very first one. Appending the
    // compartments again on a later mount is exactly the bug this fixes —
    // reconfigure the existing pair instead (right after construction, below).
    const alreadyArmed = registry.isMergeArmed(path)

    let initialState = buffer.state
    if (!alreadyArmed) {
      initialState = buffer.state.update({
        effects: StateEffect.appendConfig.of([
          compartments.diff.of(wantedDiff),
          compartments.readOnly.of(wantedReadOnly),
        ]),
      }).state
      registry.markMergeArmed(path)
    }

    const view = new EditorView({
      state: initialState,
      parent: host,
      dispatchTransactions: (transactions, instance) => {
        instance.update(transactions)
        registry.sync(path, instance.state)
        const head = instance.state.selection.main
        const line = instance.state.doc.lineAt(head.head)
        const selectedCount = Math.abs(head.to - head.from)
        cursorRef.current({
          line: line.number,
          column: head.head - line.from + 1,
          selected: selectedCount,
        })
        if (selectedCount > 0) {
          const from = Math.min(head.from, head.to)
          const to = Math.max(head.from, head.to)
          const startLine = instance.state.doc.lineAt(from).number
          const endLine = instance.state.doc.lineAt(to).number
          const rangeString = startLine === endLine ? `#L${startLine}` : `#L${startLine}-${endLine}`
          ;(window as any).__dsh_active_selection = {
            path,
            selectedText: instance.state.sliceDoc(from, to),
            startLine,
            endLine,
            rangeString,
          }
        } else {
          ;(window as any).__dsh_active_selection = null
        }

        // Notify review stats
        updateStats(instance)
      },
    })

    viewRef.current = view

    // A remount's state came from the registry as it was left by whichever
    // mount came before — reconfigure onto what THIS mount actually wants
    // (a different baseline, a disarmed review, a different readOnly flag).
    if (alreadyArmed) {
      view.dispatch({
        effects: [
          compartments.diff.reconfigure(wantedDiff),
          compartments.readOnly.reconfigure(wantedReadOnly),
        ],
      })
    }

    // Never pull focus out of the chat composer — a mount can be caused by an
    // agent-initiated background open just as easily as by the operator
    // clicking a tab, and this component cannot tell the two apart. Defense
    // in depth: the primary fix is that an agent-initiated open never
    // activates a tab at all (see Workbench's use of onOpenFileBackground).
    const activeElsewhere = typeof document !== 'undefined'
      && document.activeElement?.closest('[data-dsh-chat-panel="true"]') != null
    if (!activeElsewhere) view.focus()
    updateStats(view)

    return () => {
      registry.sync(path, view.state)
      view.destroy()
      viewRef.current = null
    }
  }, [path, registry])

  // Its own effect, not folded into the mount effect above: that one only
  // re-runs when `path`/`registry` change, so a second search hit landing on
  // an already-open file (same path, new `revealLine`) was silently ignored.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (revealLine === undefined || revealLine < 1 || revealLine > view.state.doc.lines) return
    const target = view.state.doc.line(revealLine)
    view.dispatch({
      selection: { anchor: target.from },
      effects: EditorView.scrollIntoView(target.from, { y: 'center' }),
    })
  }, [revealLine])

  // Dynamically reconfigure inline diff without tearing down view
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (diffMode?.kind === 'ai-review' && diffMode.snapshots) {
      baselineSnapshotsRef.current = [...diffMode.snapshots]
    } else if (diffMode?.kind !== 'ai-review') {
      baselineSnapshotsRef.current = []
    }

    view.dispatch({
      effects: diffCompartment.current.reconfigure(
        buildDiffExtensions(activeBaseline, diffMode?.kind === 'ai-review')
      ),
    })
    updateStats(view)
  }, [activeBaseline, diffMode?.kind])

  // Dynamic lock extension reconfigure
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: readOnlyCompartment.current.reconfigure(lockExtension(readOnly === true)),
    })
  }, [readOnly])

  return <div ref={hostRef} className={css.host} />
})

/**
 * The extensions that make a document read-only.
 */
function lockExtension(locked: boolean): Extension {
  return locked ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : []
}

