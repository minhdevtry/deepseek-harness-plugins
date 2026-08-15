/**
 * The right column: a two-tab host for the AI chat and the tool trajectory.
 *
 * The stock shell gives each of these its own column; this frame gives the
 * center to the editor, so they share one column and switch by tab. Both
 * subtrees stay mounted at all times — the chat holds scroll position, an
 * in-flight composer draft and a streaming response, none of which survive an
 * unmount. Hiding is `display: none`, never a conditional render.
 *
 * Pure presentation: the tab state and the slot children arrive as props.
 */
import type { ReactNode } from 'react'
import type { RightTab } from './stores.ts'
import css from './RightColumn.module.css'

/** Right column props: tab state plus the two rendered slot subtrees. */
export interface RightColumnProps {
  /** True when the column is solved to zero width (still mounted). */
  collapsed: boolean
  tab: RightTab
  /** False while no real session is current — the details tab has nothing to show. */
  hasDetails: boolean
  onTab: (tab: RightTab) => void
  onClose: () => void
  chat: ReactNode
  details: ReactNode
}

/** The chat / trajectory column (see module doc). */
export function RightColumn({ collapsed, tab, hasDetails, onTab, onClose, chat, details }: RightColumnProps) {
  // A details tab that loses its session falls back to chat rather than
  // rendering an empty panel.
  const active: RightTab = tab === 'details' && !hasDetails ? 'chat' : tab

  return (
    <div className={css.column} data-collapsed={collapsed || undefined}>
      {/* aria-hidden while collapsed: a zero-width column keeps its DOM, and
          without this the whole chat stays in the accessibility tree. */}
      <div className={css.inner} aria-hidden={collapsed || undefined}>
        <div className={css.tabBar} role="tablist">
          <button
            type="button"
            role="tab"
            className={css.tab}
            aria-selected={active === 'chat'}
            data-active={active === 'chat' || undefined}
            onClick={() => onTab('chat')}
          >
            Chat
          </button>
          {hasDetails && (
            <button
              type="button"
              role="tab"
              className={css.tab}
              aria-selected={active === 'details'}
              data-active={active === 'details' || undefined}
              onClick={() => onTab('details')}
            >
              Trajectory
            </button>
          )}
          <span className={css.spacer} />
          <button type="button" className={css.close} title="Close panel (Ctrl+L)" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={css.panel} hidden={active !== 'chat'}>{chat}</div>
        <div className={css.panel} hidden={active !== 'details'}>{details}</div>
      </div>
    </div>
  )
}
