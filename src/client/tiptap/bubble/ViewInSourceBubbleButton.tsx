import type { Editor } from '@tiptap/core'
import { Tooltip } from '../../ui/primitives/index.ts'

export interface ViewInSourceBubbleButtonProps {
  editor: Editor
  onViewInSource?: (() => void) | undefined
}

export function ViewInSourceBubbleButton({
  onViewInSource,
}: ViewInSourceBubbleButtonProps) {
  if (!onViewInSource) return null

  return (
    <Tooltip content="View in Source Markdown" placement="top">
      <button
        type="button"
        data-testid="view-in-source-bubble-button"
        aria-label="View in source markdown"
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onViewInSource()
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 6px',
          background: 'transparent',
          border: 'none',
          borderRadius: '4px',
          color: 'var(--dsw-alias-label-secondary, #64748b)',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="currentColor"
          style={{ marginRight: 3 }}
        >
          <path d="M14.5 2h-13A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2zM1 3.5a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-9z" />
          <path d="M2.5 10V6h1.25l1.25 2 1.25-2H7.5v4H6.25V7.8L5 9.8 3.75 7.8V10H2.5zm8 0V7.5h1.25V10h1.25L11.5 12l-1.5-2h.5z" />
        </svg>
        MD
      </button>
    </Tooltip>
  )
}
