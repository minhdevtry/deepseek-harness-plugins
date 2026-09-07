/**
 * In-chat per-turn AI review card.
 *
 * Sourced from `workbench/reviewCommands.ts` — the capture pipeline
 * (`index.ts`) registers a review the moment a settled diff card arrives, so
 * this card needs no dependency on `@deepseek-ai/dsh-client-ui-deliverables`
 * (a separate, undeclared plugin the previous version silently went blank
 * without if it was ever composed out of the host profile). Its "Accept
 * all"/"Reject all" call the same real verbs the floating review bar uses —
 * not "hide the chrome" (the old `__dsh_stop_ai_review`) and not "revert to
 * a stale disk snapshot that predates the AI's own write" (the old
 * `__dsh_revert_turn_file`).
 */
import { useState, useSyncExternalStore, type FC } from 'react'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-chat/client'
import { basename } from '../utils/path.ts'
import { reviewCommands, subscribeReviewCommands, getReviewCommandsVersion } from '../workbench/reviewCommands.ts'
import css from './TurnReviewCard.module.css'

export interface TurnReviewCardProps {
  owner: TurnTailOwnerProps
}

/**
 * Always matches. The alternative — declining unless a review is already
 * registered — risks a permanently-missed card: `__dsh_start_ai_review`
 * awaits a disk read before registering anything, so by the time it lands,
 * whatever caused this chain to re-evaluate `select` for this turn may never
 * fire again for it. This component decides its own visibility instead, via
 * `reviewCommands()` + a live subscription — correctness over the minor cost
 * of mounting (and, ordinarily, rendering nothing for) every closed turn.
 */
export function selectTurnId(owner: TurnTailOwnerProps): string {
  return String(owner.turn.turn)
}

export const TurnReviewCard: FC<{ matched: string; openFile: (path: string) => void }> = ({
  matched: turnId,
  openFile,
}) => {
  // Re-renders whenever ANY review command changes, anywhere — reviewCommands()
  // is called fresh below rather than trusting this hook's own return value.
  useSyncExternalStore(subscribeReviewCommands, getReviewCommandsVersion)
  const commands = reviewCommands()
  const files = commands.summaryForTurn(turnId)

  const [expanded, setExpanded] = useState(true)

  if (files.length === 0) return null

  const totals = files.reduce(
    (acc, f) => ({ added: acc.added + f.added, removed: acc.removed + f.removed }),
    { added: 0, removed: 0 },
  )

  const handleAcceptAll = () => {
    for (const f of files) commands.acceptAll(f.path)
  }

  const handleRejectAll = () => {
    void Promise.all(files.map(f => commands.rejectAll(f.path)))
  }

  return (
    <div className={css.card} role="region" aria-label="AI Turn Review">
      <div className={css.topBar}>
        <div className={css.summaryText}>
          <span>{files.length} file có thay đổi</span>
          <span className={css.statsPill}>
            <span className={css.statAdd}>+{totals.added}</span>
            <span className={css.statDel}>-{totals.removed}</span>
          </span>
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
          {files.map(({ path, added, removed }) => {
            const fileName = basename(path) || path
            return (
              <button
                key={path}
                type="button"
                className={css.fileRow}
                onClick={() => { openFile(path) }}
                title={`Mở ${path} trong Editor để xem diff`}
              >
                <div className={css.fileStats}>
                  <span className={css.statAdd}>+{added}</span>
                  <span className={css.statDel}>-{removed}</span>
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
          <span>{files.length} file có thay đổi</span>
        </div>
        <div className={css.footerActions}>
          <button
            type="button"
            className={css.btnRejectAll}
            onClick={handleRejectAll}
            title="Hoàn tác thay đổi của các file trong lượt này và ghi lại vào đĩa"
          >
            Hoàn tác lượt này
          </button>
          <button
            type="button"
            className={css.btnAcceptAll}
            onClick={handleAcceptAll}
            title="Chấp nhận toàn bộ thay đổi của các file trong lượt này"
          >
            Giữ toàn bộ lượt
          </button>
        </div>
      </div>
    </div>
  )
}

