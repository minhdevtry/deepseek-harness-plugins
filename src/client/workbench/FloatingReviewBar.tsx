import { useEffect, type FC } from 'react'
import css from './FloatingReviewBar.module.css'

/** Position within a turn's multi-file review, when more than one file is under review together. */
export interface TurnStepper {
  fileName: string
  index: number
  total: number
  onPrevFile: () => void
  onNextFile: () => void
}

export interface FloatingReviewBarProps {
  chunkCount: number
  onAcceptAll: () => void
  onRejectAll: () => void
  onUndo: () => void
  onRedo: () => void
  onPrevChunk: () => void
  onNextChunk: () => void
  onClose: () => void
  turnStepper?: TurnStepper | undefined
}

export const FloatingReviewBar: FC<FloatingReviewBarProps> = ({
  chunkCount,
  onAcceptAll,
  onRejectAll,
  onUndo,
  onRedo,
  onPrevChunk,
  onNextChunk,
  onClose,
  turnStepper,
}) => {
  // Global keyboard shortcuts for review
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never steal the chat composer's own chords — Ctrl+Enter is its send
      // shortcut and Ctrl+Backspace is delete-word-backwards in any text
      // field; capturing them unconditionally at `window` breaks both while
      // a review happens to be open. Same guard as CodeEditor.tsx's focus check.
      if (document.activeElement?.closest('[data-dsh-chat-panel="true"]') != null) {
        return
      }

      // Ctrl+Enter or Cmd+Enter: Accept
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        onAcceptAll()
        return
      }

      // Ctrl+Backspace or Cmd+Backspace: Reject
      if ((e.ctrlKey || e.metaKey) && e.key === 'Backspace') {
        e.preventDefault()
        e.stopPropagation()
        onRejectAll()
        return
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z (or Ctrl+Y): Redo — checked before plain
      // Ctrl+Z below, since Shift is also down here.
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && (e.key === 'z' || e.key === 'Z')) || e.key === 'y')) {
        e.preventDefault()
        e.stopPropagation()
        onRedo()
        return
      }

      // Ctrl+Z or Cmd+Z: Undo — this is the review's own undo (accept-baseline
      // swap first, falling back to the editor's native undo for a reject),
      // not a separate "Hoàn tác" button; capturing it here at `window` in
      // the capture phase means it runs before the editor's own internal
      // undo keymap ever sees the keystroke, so this is the single owner of
      // Ctrl+Z while a review is open.
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        e.stopPropagation()
        onUndo()
        return
      }

      // Alt+K or Alt+Up: Previous Chunk
      if (e.altKey && (e.key === 'k' || e.key === 'ArrowUp' || e.key === 'K')) {
        e.preventDefault()
        e.stopPropagation()
        onPrevChunk()
        return
      }

      // Alt+J or Alt+Down: Next Chunk
      if (e.altKey && (e.key === 'j' || e.key === 'ArrowDown' || e.key === 'J')) {
        e.preventDefault()
        e.stopPropagation()
        onNextChunk()
        return
      }

    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [onAcceptAll, onRejectAll, onPrevChunk, onNextChunk, onUndo, onRedo])

  // At zero chunks there is nothing left to accept/reject/navigate — showing
  // those buttons anyway (merely inert) is exactly the "button doesn't turn
  // off" complaint. Swap to a terminal row: only Undo (if there's history to
  // pop) and Close remain live.
  const done = chunkCount === 0

  return (
    <div className={css.bar} role="group" aria-label="AI Review Bar">
      <div className={css.statusGroup}>
        <span className={css.badge}>🤖 Review</span>
        <span className={css.countText}>
          {done ? '✓ All reviewed' : `${chunkCount} change${chunkCount === 1 ? '' : 's'}`}
        </span>
        {turnStepper && (
          <>
            <div className={css.divider} />
            <button
              type="button"
              className={css.btnNav}
              onClick={turnStepper.onPrevFile}
              title="Previous file in this turn"
              aria-label="Previous file in this turn"
            >
              ⟨
            </button>
            <span className={css.countText} title={turnStepper.fileName}>
              {turnStepper.fileName} · {turnStepper.index + 1}/{turnStepper.total}
            </span>
            <button
              type="button"
              className={css.btnNav}
              onClick={turnStepper.onNextFile}
              title="Next file in this turn"
              aria-label="Next file in this turn"
            >
              ⟩
            </button>
          </>
        )}
      </div>

      <div className={css.divider} />

      {done
        ? (
          <div className={css.actionsGroup}>
            <button
              type="button"
              className={css.btnIcon}
              onClick={onClose}
              title="Close Review Bar (Esc)"
              aria-label="Close Review Bar"
            >
              ✕
            </button>
          </div>
        )
        : (
          <div className={css.actionsGroup}>
            <button
              type="button"
              className={css.btnPrimary}
              onClick={onAcceptAll}
              title="Accept all changes (Ctrl+Enter)"
            >
              <span>Accept Changes</span>
              <span className={css.kbd}>Ctrl+↵</span>
            </button>

            <button
              type="button"
              className={css.btnDanger}
              onClick={onRejectAll}
              title="Reject all changes (Ctrl+Backspace)"
            >
              <span>Reject</span>
              <span className={`${css.kbd} ${css.kbdSubtle}`}>Ctrl+⌫</span>
            </button>

            <div className={css.divider} />

            <button
              type="button"
              className={css.btnNavSubtle}
              onClick={onPrevChunk}
              title="Previous change (Alt+K or Alt+↑)"
              aria-label="Previous change"
            >
              <span>↑</span>
              <span className={css.kbdGhost}>Alt+K</span>
            </button>

            <button
              type="button"
              className={css.btnNavSubtle}
              onClick={onNextChunk}
              title="Next change (Alt+J or Alt+↓)"
              aria-label="Next change"
            >
              <span>↓</span>
              <span className={css.kbdGhost}>Alt+J</span>
            </button>

            <div className={css.divider} />

            <button
              type="button"
              className={css.btnIcon}
              onClick={onClose}
              title="Close Review Bar (Esc)"
              aria-label="Close Review Bar"
            >
              ✕
            </button>
          </div>
        )}
    </div>
  )
}
