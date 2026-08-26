import type { FC } from 'react'
import css from './ReviewHeader.module.css'

export interface ReviewHeaderProps {
  chunkCount: number
  canUndo: boolean
  onAcceptAll: () => void
  onRejectAll: () => void
  onUndo: () => void
  onPrevChunk: () => void
  onNextChunk: () => void
  onClose: () => void
}

export const ReviewHeader: FC<ReviewHeaderProps> = ({
  chunkCount,
  canUndo,
  onAcceptAll,
  onRejectAll,
  onUndo,
  onPrevChunk,
  onNextChunk,
  onClose,
}) => {
  return (
    <div className={css.reviewHeader} role="toolbar" aria-label="AI Review Controls">
      <div className={css.leftSection}>
        <span className={css.badge}>
          <span>🤖</span>
          <span>AI Review</span>
        </span>
        <span className={css.countText}>
          {chunkCount > 0
            ? `${chunkCount} thay đổi cần duyệt`
            : 'Đã duyệt xong tất cả thay đổi'}
        </span>
      </div>

      <div className={css.actionsSection}>
        <button
          type="button"
          className={`${css.btn} ${css.btnAcceptAll}`}
          onClick={onAcceptAll}
          disabled={chunkCount === 0}
          title="Chấp nhận tất cả thay đổi của AI"
        >
          ✓ Giữ tất cả
        </button>

        <button
          type="button"
          className={`${css.btn} ${css.btnRejectAll}`}
          onClick={onRejectAll}
          disabled={chunkCount === 0}
          title="Từ chối tất cả và hoàn tác về bản cũ"
        >
          ✕ Bỏ tất cả
        </button>

        <div className={css.divider} />

        <button
          type="button"
          className={css.btn}
          onClick={onUndo}
          disabled={!canUndo}
          title="Hoàn tác thao tác review gần nhất (Ctrl+Z)"
        >
          ↺ Hoàn tác
        </button>

        <div className={css.divider} />

        <button
          type="button"
          className={css.btn}
          onClick={onPrevChunk}
          disabled={chunkCount === 0}
          title="Nhảy tới thay đổi trước (Alt+↑)"
        >
          ↑ Trước
        </button>

        <button
          type="button"
          className={css.btn}
          onClick={onNextChunk}
          disabled={chunkCount === 0}
          title="Nhảy tới thay đổi sau (Alt+↓)"
        >
          ↓ Sau
        </button>

        <div className={css.divider} />

        <button
          type="button"
          className={`${css.btn} ${css.btnClose}`}
          onClick={onClose}
          title="Hoàn tất và đóng thanh Review"
        >
          ✕ Đóng
        </button>
      </div>
    </div>
  )
}
