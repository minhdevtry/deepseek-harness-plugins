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
import { Compartment, EditorState, StateEffect, type Extension, type Text, type TransactionSpec } from '@codemirror/state'
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
  /** AI review: the pre-AI text vs current buffer, with baseline undo stack. */
  | { kind: 'ai-review'; baseline: Text | string; snapshots?: string[] }

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
  /** Notified when review chunk count or undo availability changes. */
  onReviewStatsChange?: (chunkCount: number, canUndo: boolean) => void
}

/**
 * Commands the column issues to the live view.
 */
export interface CodeEditorHandle {
  /** Apply a transaction — the revert path, which stays undoable this way. */
  dispatch: (spec: TransactionSpec) => void
  focus: () => void
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
    statsCallbackRef.current(count, baselineSnapshotsRef.current.length > 0)
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

    if (diffMode?.kind === 'ai-review' && diffMode.snapshots) {
      baselineSnapshotsRef.current = [...diffMode.snapshots]
    } else if (diffMode?.kind !== 'ai-review') {
      baselineSnapshotsRef.current = []
    }

    const initialDiff = buildDiffExtensions(activeBaseline, diffMode?.kind === 'ai-review')

    const view = new EditorView({
      state: buffer.state.update({
        effects: StateEffect.appendConfig.of([
          diffCompartment.current.of(initialDiff),
          readOnlyCompartment.current.of(lockExtension(readOnly === true)),
        ]),
      }).state,
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

    if (revealLine !== undefined && revealLine >= 1 && revealLine <= view.state.doc.lines) {
      const target = view.state.doc.line(revealLine)
      view.dispatch({
        selection: { anchor: target.from },
        effects: EditorView.scrollIntoView(target.from, { y: 'center' }),
      })
    }
    view.focus()
    updateStats(view)

    return () => {
      registry.sync(path, view.state)
      view.destroy()
      viewRef.current = null
    }
  }, [path, registry])

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

