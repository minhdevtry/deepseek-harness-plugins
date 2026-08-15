/**
 * Contextual Table Controls Toolbar for TipTap.
 *
 * Renders at the top or inline whenever the caret/selection is inside a table,
 * providing direct one-click operations on table rows, columns, and headers.
 */
import type { Editor } from '@tiptap/core'
import css from './TableControls.module.css'

export interface TableControlsProps {
  editor: Editor
}

export function TableControls({ editor }: TableControlsProps) {
  if (!editor.isActive('table')) return null

  return (
    <div className={css.toolbar}>
      <span className={css.label}>⊞ Table</span>

      <button
        type="button"
        className={css.btn}
        onClick={() => { editor.chain().focus().addRowBefore().run() }}
        title="Insert Row Above"
      >
        + Row Above
      </button>
      <button
        type="button"
        className={css.btn}
        onClick={() => { editor.chain().focus().addRowAfter().run() }}
        title="Insert Row Below"
      >
        + Row Below
      </button>

      <span className={css.divider} />

      <button
        type="button"
        className={css.btn}
        onClick={() => { editor.chain().focus().addColumnBefore().run() }}
        title="Insert Column Left"
      >
        + Col Left
      </button>
      <button
        type="button"
        className={css.btn}
        onClick={() => { editor.chain().focus().addColumnAfter().run() }}
        title="Insert Column Right"
      >
        + Col Right
      </button>

      <span className={css.divider} />

      <button
        type="button"
        className={css.btn}
        onClick={() => { editor.chain().focus().toggleHeaderRow().run() }}
        title="Toggle Header Row"
      >
        Header Row
      </button>

      <span className={css.divider} />

      <button
        type="button"
        className={`${css.btn} ${css.btnDanger}`}
        onClick={() => { editor.chain().focus().deleteRow().run() }}
        title="Delete Current Row"
      >
        Del Row
      </button>
      <button
        type="button"
        className={`${css.btn} ${css.btnDanger}`}
        onClick={() => { editor.chain().focus().deleteColumn().run() }}
        title="Delete Current Column"
      >
        Del Col
      </button>
      <button
        type="button"
        className={`${css.btn} ${css.btnDanger}`}
        onClick={() => { editor.chain().focus().deleteTable().run() }}
        title="Delete Table"
      >
        Del Table
      </button>
    </div>
  )
}
