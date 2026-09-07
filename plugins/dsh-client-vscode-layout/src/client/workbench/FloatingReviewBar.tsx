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
  canUndo: boolean
  onAcceptAll: () => void
  onRejectAll: () => void
  onUndo: () => void
  onPrevChunk: () => void
  onNextChunk: () => void
  onClose: () => void
  turnStepper?: TurnStepper | undefined
}

export const FloatingReviewBar: FC<FloatingReviewBarProps> = ({
  chunkCount,
  canUndo,
  onAcceptAll,
  onRejectAll,
  onUndo,
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
  }, [onAcceptAll, onRejectAll, onPrevChunk, onNextChunk, onUndo, canUndo])

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
          {done ? '✓ Đã duyệt xong' : `${chunkCount} thay đổi`}
        </span>
        {turnStepper && (
          <>
            <div className={css.divider} />
            <button
              type="button"
              className={css.btnNav}
              onClick={turnStepper.onPrevFile}
              title="File trước trong lượt này"
              aria-label="File trước trong lượt này"
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
              title="File sau trong lượt này"
              aria-label="File sau trong lượt này"
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
            {canUndo && (
              <button
                type="button"
                className={css.btnNav}
                onClick={onUndo}
                title="Hoàn tác thao tác review vừa làm (Ctrl+Z)"
              >
                <span>↺</span>
                <span>Hoàn tác</span>
              </button>
            )}

            <button
              type="button"
              className={css.btnIcon}
              onClick={onClose}
              title="Đóng thanh Review (Esc)"
              aria-label="Đóng thanh Review"
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
              title="Chấp nhận tất cả thay đổi (Ctrl+Enter)"
            >
              <span>Giữ tất cả trong file</span>
              <span className={css.kbd}>Ctrl+↵</span>
            </button>

            <button
              type="button"
              className={css.btnDanger}
              onClick={onRejectAll}
              title="Từ chối tất cả thay đổi (Ctrl+Backspace)"
            >
              <span>Bỏ tất cả trong file</span>
              <span className={`${css.kbd} ${css.kbdSubtle}`}>Ctrl+⌫</span>
            </button>

            {canUndo && (
              <button
                type="button"
                className={css.btnNav}
                onClick={onUndo}
                title="Hoàn tác thao tác review vừa làm (Ctrl+Z)"
              >
                <span>↺</span>
                <span>Hoàn tác</span>
              </button>
            )}

            <div className={css.divider} />

            <button
              type="button"
              className={css.btnNav}
              onClick={onPrevChunk}
              title="Nhảy tới thay đổi trước (Alt+K hoặc Alt+↑)"
              aria-label="Nhảy tới thay đổi trước"
            >
              <span>↑</span>
              <span className={`${css.kbd} ${css.kbdSubtle}`}>Alt+K</span>
            </button>

            <button
              type="button"
              className={css.btnNav}
              onClick={onNextChunk}
              title="Nhảy tới thay đổi sau (Alt+J hoặc Alt+↓)"
              aria-label="Nhảy tới thay đổi sau"
            >
              <span>↓</span>
              <span className={`${css.kbd} ${css.kbdSubtle}`}>Alt+J</span>
            </button>

            <div className={css.divider} />

            <button
              type="button"
              className={css.btnIcon}
              onClick={onClose}
              title="Đóng thanh Review (Esc)"
              aria-label="Đóng thanh Review"
            >
              ✕
            </button>
          </div>
        )}
    </div>
  )
}
