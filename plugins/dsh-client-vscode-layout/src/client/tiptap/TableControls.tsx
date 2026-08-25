/**
 * Contextual Table Controls Toolbar for TipTap (Orca-grade polish).
 *
 * Renders at the top whenever the caret/selection is inside a table,
 * providing direct one-click operations on table rows, columns, and headers.
 */
import type { Editor } from '@tiptap/core'
import { Button, Tooltip } from '../ui/primitives/index.ts'
import css from './TableControls.module.css'

export interface TableControlsProps {
  editor: Editor
}

export function TableControls({ editor }: TableControlsProps) {
  if (!editor.isActive('table')) return null

  return (
    <div className={css.toolbar}>
      <span className={css.label}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="12" height="12" rx="1.5" />
          <path d="M2 7h12M7 2v12" />
        </svg>
        Table
      </span>

      <Tooltip content="Insert Row Above">
        <Button
          size="xs"
          variant="secondary"
          onClick={() => { editor.chain().focus().addRowBefore().run() }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="7" width="12" height="7" rx="1" />
            <path d="M8 1v4m-2-2h4" />
          </svg>
          + Row Above
        </Button>
      </Tooltip>

      <Tooltip content="Insert Row Below">
        <Button
          size="xs"
          variant="secondary"
          onClick={() => { editor.chain().focus().addRowAfter().run() }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="12" height="7" rx="1" />
            <path d="M8 11v4m-2-2h4" />
          </svg>
          + Row Below
        </Button>
      </Tooltip>

      <span className={css.divider} />

      <Tooltip content="Insert Column Left">
        <Button
          size="xs"
          variant="secondary"
          onClick={() => { editor.chain().focus().addColumnBefore().run() }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="7" y="2" width="7" height="12" rx="1" />
            <path d="M1 8h4m-2-2v4" />
          </svg>
          + Col Left
        </Button>
      </Tooltip>

      <Tooltip content="Insert Column Right">
        <Button
          size="xs"
          variant="secondary"
          onClick={() => { editor.chain().focus().addColumnAfter().run() }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="7" height="12" rx="1" />
            <path d="M11 8h4m-2-2v4" />
          </svg>
          + Col Right
        </Button>
      </Tooltip>

      <span className={css.divider} />

      <Tooltip content="Toggle Header Row">
        <Button
          size="xs"
          variant="secondary"
          onClick={() => { editor.chain().focus().toggleHeaderRow().run() }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="2" width="12" height="4" rx="1" />
            <rect x="2" y="7" width="12" height="7" rx="1" fillOpacity="0.3" />
          </svg>
          Header Row
        </Button>
      </Tooltip>

      <span className={css.divider} />

      <Tooltip content="Delete Current Row">
        <Button
          size="xs"
          variant="danger"
          onClick={() => { editor.chain().focus().deleteRow().run() }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="5" width="12" height="6" rx="1" />
            <path d="M5 8h6" />
          </svg>
          Del Row
        </Button>
      </Tooltip>

      <Tooltip content="Delete Current Column">
        <Button
          size="xs"
          variant="danger"
          onClick={() => { editor.chain().focus().deleteColumn().run() }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="5" y="2" width="6" height="12" rx="1" />
            <path d="M8 5v6" />
          </svg>
          Del Col
        </Button>
      </Tooltip>

      <Tooltip content="Delete Entire Table">
        <Button
          size="xs"
          variant="danger"
          onClick={() => { editor.chain().focus().deleteTable().run() }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="12" height="12" rx="1.5" />
            <path d="M5 5l6 6m0-6l-6 6" />
          </svg>
          Del Table
        </Button>
      </Tooltip>
    </div>
  )
}
