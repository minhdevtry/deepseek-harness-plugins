import { useState, type FC } from 'react'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { basename } from '../utils/path.ts'
import { openInWorkbench } from '../fileOpener.ts'
import css from './TurnReviewCard.module.css'

export interface TurnReviewCardProps {
  owner: TurnTailOwnerProps
}

export function selectTurnModifiedFiles(owner: TurnTailOwnerProps): readonly string[] | null {
  const deliverables = (owner.turn.data as any)?.get?.('deliverables') as { produced: readonly { seq: number; path: string }[] } | undefined
  if (!deliverables || !Array.isArray(deliverables.produced)) return null

  const paths: string[] = []
  const seen = new Set<string>()
  for (const item of deliverables.produced) {
    if (item.seq <= owner.seq && !seen.has(item.path)) {
      seen.add(item.path)
      paths.push(item.path)
    }
  }

  return paths.length > 0 ? paths : null
}

export const TurnReviewCard: FC<{ matched: readonly string[]; openFile: (path: string) => void }> = ({
  matched: paths,
  openFile,
}) => {
  const [expanded, setExpanded] = useState(true)

  if (!paths || paths.length === 0) return null

  const handleOpen = (path: string) => {
    // Open through Workbench editor in review mode
    const opened = openInWorkbench(path)
    if (!opened) {
      openFile(path)
    }
  }

  const handleAcceptAll = () => {
    for (const path of paths) {
      ;(window as any).__dsh_stop_ai_review?.(path)
    }
  }

  const handleRevertAll = () => {
    for (const path of paths) {
      ;(window as any).__dsh_revert_turn_file?.(path)
    }
  }

  return (
    <div className={css.card} role="region" aria-label="AI Turn Review">
      <div className={css.topBar}>
        <div className={css.summaryText}>
          <span>{paths.length} {paths.length === 1 ? 'file changed' : 'files changed'}</span>
        </div>
        <button
          type="button"
          className={css.btnToggle}
          onClick={() => setExpanded(!expanded)}
          title={expanded ? 'Thu gọn danh sách file' : 'Mở rộng xem chi tiết các file'}
        >
          <span>👁️</span>
          <span>Review</span>
          <span>{expanded ? '▾' : '▸'}</span>
        </button>
      </div>

      {expanded && (
        <div className={css.filesList}>
          {paths.map((path) => {
            const fileName = basename(path) || path
            return (
              <button
                key={path}
                type="button"
                className={css.fileRow}
                onClick={() => handleOpen(path)}
                title={`Mở ${path} trong Editor để xem diff`}
              >
                <div className={css.fileStats}>
                  <span className={css.statAdd}>[+]</span>
                </div>
                <div className={css.fileDetails}>
                  <span className={css.fileName}>{fileName}</span>
                  <span className={css.filePath}>{path}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className={css.footerBar}>
        <div className={css.footerTitle}>
          <span>📁</span>
          <span>{paths.length} Files with Changes</span>
        </div>
        <div className={css.footerActions}>
          <button
            type="button"
            className={css.btnRejectAll}
            onClick={handleRevertAll}
            title="Hoàn tác thay đổi của các file trong lượt này"
          >
            Reject all
          </button>
          <button
            type="button"
            className={css.btnAcceptAll}
            onClick={handleAcceptAll}
            title="Chấp nhận toàn bộ thay đổi của các file trong lượt này"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  )
}
