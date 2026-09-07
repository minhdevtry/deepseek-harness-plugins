import type { Editor } from '@tiptap/core'
import { useState, useEffect, useRef, useCallback } from 'react'
import { handleAnchorCellPos, selectTableAxis, type TableAxis } from './tableReorder.ts'
import { useTableDragReorder } from './useTableDragReorder.ts'
import css from './TableCellHandles.module.css'

interface ActiveCell {
  columnAnchor: HTMLTableCellElement
  rowAnchor: HTMLTableCellElement
  isFirstColumn: boolean
  isFirstRow: boolean
}

function computeActiveCell(editor: Editor): ActiveCell | null {
  if (!editor.isEditable) return null

  const { state, view } = editor
  let cellPos = handleAnchorCellPos(state.selection) ?? -1
  if (cellPos < 0) {
    const $from = state.selection.$from
    for (let depth = $from.depth; depth > 0; depth--) {
      const role = $from.node(depth).type.spec.tableRole
      if (role === 'cell' || role === 'header_cell') {
        cellPos = $from.before(depth)
        break
      }
    }
  }
  if (cellPos < 0) return null

  try {
    const cellDOM = view.nodeDOM(cellPos)
    if (!(cellDOM instanceof HTMLTableCellElement)) return null
    const table = cellDOM.closest('table')
    const tr = cellDOM.closest('tr')
    const inEditor = cellDOM.closest('.ProseMirror')
    if (!table || !tr || !inEditor) return null

    const rowIndex = Array.prototype.indexOf.call(table.rows, tr)
    const colIndex = cellDOM.cellIndex
    const columnAnchor = table.rows[0]?.cells[colIndex]
    const rowAnchor = table.rows[rowIndex]?.cells[0]
    if (!columnAnchor || !rowAnchor) return null

    return {
      columnAnchor,
      rowAnchor,
      isFirstColumn: colIndex === 0,
      isFirstRow: rowIndex === 0,
    }
  } catch {
    return null
  }
}

interface CellHandleProps {
  editor: Editor
  anchor: HTMLTableCellElement
  axis: TableAxis
  isFirst: boolean
}

function CellHandle({ editor, anchor, axis, isFirst }: CellHandleProps) {
  const [coords, setCoords] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const updatePosition = useCallback(() => {
    if (!anchor || !anchor.isConnected) return
    const rect = anchor.getBoundingClientRect()
    if (axis === 'column') {
      setCoords({
        left: rect.left + rect.width / 2,
        top: Math.max(8, rect.top - 16),
      })
    } else {
      setCoords({
        left: Math.max(8, rect.left - 16),
        top: rect.top + rect.height / 2,
      })
    }
  }, [anchor, axis])

  useEffect(() => {
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [updatePosition])

  const drag = useTableDragReorder({
    editor,
    axis,
    anchor,
    onClickGesture: () => {
      selectTableAxis(editor, anchor, axis)
      setMenuOpen((prev) => !prev)
    },
  })

  useEffect(() => {
    if (!menuOpen) return
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [menuOpen])

  return (
    <>
      <button
        type="button"
        className={`${css.handleButton} ${axis === 'column' ? css.columnHandle : css.rowHandle}`}
        style={{ left: coords.left, top: coords.top }}
        title={axis === 'column' ? 'Column options (drag to reorder)' : 'Row options (drag to reorder)'}
        onPointerDown={drag.onPointerDown}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          {axis === 'column' ? (
            <>
              <circle cx="3" cy="8" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="13" cy="8" r="1.5" />
            </>
          ) : (
            <>
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </>
          )}
        </svg>
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          className={css.menuPopover}
          style={{
            left: axis === 'column' ? coords.left - 20 : coords.left + 20,
            top: axis === 'column' ? coords.top + 20 : coords.top - 20,
          }}
        >
          {axis === 'column' ? (
            <>
              {isFirst && (
                <button
                  type="button"
                  className={css.menuItem}
                  onClick={() => {
                    editor.chain().focus().toggleHeaderColumn().run()
                    setMenuOpen(false)
                  }}
                >
                  Toggle Header Column
                </button>
              )}
              <button
                type="button"
                className={css.menuItem}
                onClick={() => {
                  editor.chain().focus().addColumnBefore().run()
                  setMenuOpen(false)
                }}
              >
                Insert Column Left
              </button>
              <button
                type="button"
                className={css.menuItem}
                onClick={() => {
                  editor.chain().focus().addColumnAfter().run()
                  setMenuOpen(false)
                }}
              >
                Insert Column Right
              </button>
              <div className={css.menuDivider} />
              <button
                type="button"
                className={`${css.menuItem} ${css.menuItemDanger}`}
                onClick={() => {
                  editor.chain().focus().deleteColumn().run()
                  setMenuOpen(false)
                }}
              >
                Delete Column
              </button>
              <button
                type="button"
                className={`${css.menuItem} ${css.menuItemDanger}`}
                onClick={() => {
                  editor.chain().focus().deleteTable().run()
                  setMenuOpen(false)
                }}
              >
                Delete Table
              </button>
            </>
          ) : (
            <>
              {isFirst && (
                <button
                  type="button"
                  className={css.menuItem}
                  onClick={() => {
                    editor.chain().focus().toggleHeaderRow().run()
                    setMenuOpen(false)
                  }}
                >
                  Toggle Header Row
                </button>
              )}
              <button
                type="button"
                className={css.menuItem}
                onClick={() => {
                  editor.chain().focus().addRowBefore().run()
                  setMenuOpen(false)
                }}
              >
                Insert Row Above
              </button>
              <button
                type="button"
                className={css.menuItem}
                onClick={() => {
                  editor.chain().focus().addRowAfter().run()
                  setMenuOpen(false)
                }}
              >
                Insert Row Below
              </button>
              <div className={css.menuDivider} />
              <button
                type="button"
                className={`${css.menuItem} ${css.menuItemDanger}`}
                onClick={() => {
                  editor.chain().focus().deleteRow().run()
                  setMenuOpen(false)
                }}
              >
                Delete Row
              </button>
              <button
                type="button"
                className={`${css.menuItem} ${css.menuItemDanger}`}
                onClick={() => {
                  editor.chain().focus().deleteTable().run()
                  setMenuOpen(false)
                }}
              >
                Delete Table
              </button>
            </>
          )}
        </div>
      )}

      {drag.indicator && (
        <div
          aria-hidden
          className={css.dragIndicator}
          style={{
            left: drag.indicator.rect.left,
            top: drag.indicator.rect.top,
            width: drag.indicator.rect.width,
            height: drag.indicator.rect.height,
          }}
        />
      )}
    </>
  )
}

export function TableCellHandles({ editor }: { editor: Editor }) {
  const [active, setActive] = useState<ActiveCell | null>(null)

  useEffect(() => {
    const update = () => {
      setActive((prev) => {
        const next = computeActiveCell(editor)
        if (
          prev &&
          next &&
          prev.columnAnchor === next.columnAnchor &&
          prev.rowAnchor === next.rowAnchor
        ) {
          return prev
        }
        return next
      })
    }

    update()
    editor.on('selectionUpdate', update)
    editor.on('update', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('update', update)
    }
  }, [editor])

  if (!active) return null

  return (
    <div className={css.handleLayer}>
      <CellHandle
        editor={editor}
        anchor={active.columnAnchor}
        axis="column"
        isFirst={active.isFirstColumn}
      />
      <CellHandle
        editor={editor}
        anchor={active.rowAnchor}
        axis="row"
        isFirst={active.isFirstRow}
      />
    </div>
  )
}
