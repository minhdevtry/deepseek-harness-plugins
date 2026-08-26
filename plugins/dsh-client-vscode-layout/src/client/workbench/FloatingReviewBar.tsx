import { useEffect, type FC } from 'react'
import css from './FloatingReviewBar.module.css'

export interface FloatingReviewBarProps {
  chunkCount: number
  canUndo: boolean
  onAcceptAll: () => void
  onRejectAll: () => void
  onUndo: () => void
  onPrevChunk: () => void
  onNextChunk: () => void
  onClose: () => void
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
}) => {
  // Global keyboard shortcuts for review
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

      // Ctrl+Z during review: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && canUndo && !e.shiftKey) {
        // Handled natively by editor if focused, fallback here if toolbar has focus
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [onAcceptAll, onRejectAll, onPrevChunk, onNextChunk, onUndo, canUndo])

  return (
    <div className={css.floatingBar} role="toolbar" aria-label="AI Review Floating Bar">
      <div className={css.statusGroup}>
        <span className={css.badge}>🤖 Review</span>
        <span className={css.countText}>
          {chunkCount > 0 ? `${chunkCount} thay đổi` : 'Đã duyệt xong'}
        </span>
      </div>

      <div className={css.divider} />

      <div className={css.actionsGroup}>
        <button
          type="button"
          className={css.btnPrimary}
          onClick={onAcceptAll}
          title="Chấp nhận tất cả thay đổi (Ctrl+Enter)"
        >
          <span>Accept Changes</span>
          <span className={css.kbd}>Ctrl+↵</span>
        </button>

        <button
          type="button"
          className={css.btnDanger}
          onClick={onRejectAll}
          title="Từ chối tất cả thay đổi (Ctrl+Backspace)"
        >
          <span>Reject</span>
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
            <span>Undo</span>
          </button>
        )}

        <div className={css.divider} />

        <button
          type="button"
          className={css.btnNav}
          onClick={onPrevChunk}
          disabled={chunkCount === 0}
          title="Nhảy tới thay đổi trước (Alt+K hoặc Alt+↑)"
        >
          <span>↑</span>
          <span className={`${css.kbd} ${css.kbdSubtle}`}>Alt+K</span>
        </button>

        <button
          type="button"
          className={css.btnNav}
          onClick={onNextChunk}
          disabled={chunkCount === 0}
          title="Nhảy tới thay đổi sau (Alt+J hoặc Alt+↓)"
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
        >
          ✕
        </button>
      </div>
    </div>
  )
}
