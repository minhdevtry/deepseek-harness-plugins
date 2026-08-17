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
import { EditorView } from '@codemirror/view'
import { Compartment, StateEffect, type Text, type TransactionSpec } from '@codemirror/state'
import { unifiedMergeView } from '@codemirror/merge'
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

/** Editor props. */
export interface CodeEditorProps {
  /** Absolute path of the buffer to show; changing it remounts via `key`. */
  path: string
  registry: BufferRegistry
  /** 1-based line to reveal once on open — a search hit's target. */
  revealLine?: number | undefined
  /** Original disk document when inline per-hunk diff is active. */
  diffOriginal?: Text | undefined
  onCursor: (info: CursorInfo) => void
}

/**
 * Commands the column issues to the live view.
 *
 * A ref, not a DOM lookup: reaching the editor with `querySelector` is exactly
 * how the previous implementation lost track of its own state.
 */
export interface CodeEditorHandle {
  /** Apply a transaction — the revert path, which stays undoable this way. */
  dispatch: (spec: TransactionSpec) => void
  focus: () => void
}

/** The editing surface (see module doc). */
export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { path, registry, revealLine, diffOriginal, onCursor }: CodeEditorProps,
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const diffCompartment = useRef(new Compartment())

  useImperativeHandle(ref, () => ({
    dispatch: (spec) => { viewRef.current?.dispatch(spec) },
    focus: () => { viewRef.current?.focus() },
  }), [])
  // Latest-callback ref: the update listener is baked into the view for its
  // whole lifetime, but must always reach the current handler.
  const cursorRef = useRef(onCursor)
  cursorRef.current = onCursor

  useEffect(() => {
    const host = hostRef.current
    const buffer = registry.status(path)
    if (host === null || buffer?.kind !== 'text') return

    const initialDiff = diffOriginal !== undefined
      ? unifiedMergeView({ original: diffOriginal, mergeControls: true })
      : []

    const view = new EditorView({
      state: buffer.state.update({
        effects: StateEffect.appendConfig.of(diffCompartment.current.of(initialDiff)),
      }).state,
      parent: host,
      // `dispatchTransactions`, not the legacy `dispatch`: the older hook
      // forces transactions to be applied one at a time, which breaks
      // extensions that rely on dispatching a group together.
      dispatchTransactions: (transactions, instance) => {
        instance.update(transactions)
        // Every transaction, not just document changes: a selection move has
        // to reach the status bar too.
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
          const rangeString = startLine === endLine ? `#L${startLine}` : `#L${startLine}-L${endLine}`
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
      },
    })

    viewRef.current = view

    if (revealLine !== undefined && revealLine >= 1 && revealLine <= view.state.doc.lines) {
      const target = view.state.doc.line(revealLine)
      view.dispatch({
        selection: { anchor: target.from },
        // 'center' rather than the default nearest: a hit revealed flush
        // against the top or bottom edge shows none of its context.
        effects: EditorView.scrollIntoView(target.from, { y: 'center' }),
      })
    }
    view.focus()

    return () => {
      // Hand the final state back before tearing the view down — this is the
      // tab's undo history and cursor.
      registry.sync(path, view.state)
      view.destroy()
      viewRef.current = null
    }
    // Deliberately keyed to the buffer identity alone. revealLine is read once
    // at open: re-running on it would rebuild the view and throw away the
    // operator's scroll position and undo history every time a search hit
    // changed.
  }, [path, registry])

  // Dynamically reconfigure inline diff without tearing down the view or losing state
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: diffCompartment.current.reconfigure(
        diffOriginal !== undefined
          ? unifiedMergeView({ original: diffOriginal, mergeControls: true })
          : []
      ),
    })
  }, [diffOriginal])

  return <div ref={hostRef} className={css.host} />
})
