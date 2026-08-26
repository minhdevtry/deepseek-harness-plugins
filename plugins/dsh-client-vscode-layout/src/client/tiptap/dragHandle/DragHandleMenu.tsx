import { useState, useRef, useEffect } from 'react'
import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import { Tooltip } from '../../ui/primitives/index.ts'
import css from './DragHandleMenu.module.css'

export interface DragHandleMenuProps {
  editor: Editor
}

interface BlockOption {
  label: string
  icon: string
  action: () => void
}

export function isEditorMounted(editor: Editor | null | undefined): editor is Editor {
  if (!editor || editor.isDestroyed) return false
  try {
    return Boolean(editor.view && editor.view.dom)
  } catch {
    return false
  }
}

export function DragHandleMenu({ editor }: DragHandleMenuProps) {
  const [currentNode, setCurrentNode] = useState<ProseMirrorNode | null>(null)
  const [currentPos, setCurrentPos] = useState<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const handleRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Close menu on outside click or escape
  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as globalThis.Node
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        handleRef.current &&
        !handleRef.current.contains(target)
      ) {
        setMenuOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const handleAddBelow = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (currentPos === null || currentNode === null) return

    const insertPos = currentPos + currentNode.nodeSize
    editor
      .chain()
      .focus()
      .insertContentAt(insertPos, { type: 'paragraph' })
      .setTextSelection(insertPos + 1)
      .run()
  }

  const handleOpenMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    setMenuCoords({
      top: rect.bottom + 4,
      left: rect.left,
    })
    setMenuOpen((prev) => !prev)
  }

  const handleTurnInto = (callback: () => void) => {
    if (currentPos === null) return
    // Focus node position before executing command
    editor.chain().focus().setTextSelection(currentPos + 1).run()
    callback()
    setMenuOpen(false)
  }

  const handleDuplicate = () => {
    if (currentPos === null || currentNode === null) return
    const json = currentNode.toJSON()
    const insertPos = currentPos + currentNode.nodeSize
    editor.chain().focus().insertContentAt(insertPos, json).run()
    setMenuOpen(false)
  }

  const handleDelete = () => {
    if (currentPos === null || currentNode === null) return
    editor
      .chain()
      .focus()
      .deleteRange({ from: currentPos, to: currentPos + currentNode.nodeSize })
      .run()
    setMenuOpen(false)
  }

  const turnIntoOptions: BlockOption[] = [
    {
      label: 'Text',
      icon: 'T',
      action: () => editor.chain().focus().setParagraph().run(),
    },
    {
      label: 'Heading 1',
      icon: 'H1',
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: 'Heading 2',
      icon: 'H2',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'Heading 3',
      icon: 'H3',
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: 'Bulleted list',
      icon: '•',
      action: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Numbered list',
      icon: '1.',
      action: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'To-do list',
      icon: '☑',
      action: () => editor.chain().focus().toggleTaskList().run(),
    },
    {
      label: 'Code block',
      icon: '</>',
      action: () => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      label: 'Quote',
      icon: '”',
      action: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: 'Callout',
      icon: '💡',
      action: () => editor.chain().focus().toggleCallout({ type: 'info' }).run(),
    },
    {
      label: 'Toggle list',
      icon: '▶',
      action: () => editor.chain().focus().setDetails().run(),
    },
  ]

  if (!isEditorMounted(editor)) return null

  return (
    <>
      <DragHandle
        editor={editor}
        nested={true}
        className={css.handleGutter || 'tiptap-drag-handle'}
        onNodeChange={({ node, pos }) => {
          setCurrentNode(node)
          setCurrentPos(pos)
        }}
      >
        <div ref={handleRef} className={css.handleButtonGroup}>
          <Tooltip content="Click to add a block below" placement="top">
            <button
              type="button"
              className={css.plusBtn}
              onClick={handleAddBelow}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label="Add block below"
            >
              +
            </button>
          </Tooltip>

          <Tooltip content="Drag to move, click for menu" placement="top">
            <button
              type="button"
              className={css.dragBtn}
              onClick={handleOpenMenu}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label="Block options"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="8" cy="4" r="2.5" />
                <circle cx="16" cy="4" r="2.5" />
                <circle cx="8" cy="12" r="2.5" />
                <circle cx="16" cy="12" r="2.5" />
                <circle cx="8" cy="20" r="2.5" />
                <circle cx="16" cy="20" r="2.5" />
              </svg>
            </button>
          </Tooltip>
        </div>
      </DragHandle>

      {menuOpen && (
        <div
          ref={menuRef}
          className={css.menuPopover}
          style={{ top: `${menuCoords.top}px`, left: `${menuCoords.left}px` }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className={css.menuHeader}>
            <span className={css.menuTitle}>Actions</span>
          </div>

          <button type="button" className={css.menuItem} onClick={handleDuplicate}>
            <span className={css.itemIcon}>📋</span>
            <span className={css.itemLabel}>Duplicate</span>
          </button>

          <button
            type="button"
            className={`${css.menuItem} ${css.dangerItem}`}
            onClick={handleDelete}
          >
            <span className={css.itemIcon}>🗑️</span>
            <span className={css.itemLabel}>Delete</span>
          </button>

          <div className={css.menuDivider} />

          <div className={css.menuHeader}>
            <span className={css.menuTitle}>Turn into</span>
          </div>

          <div className={css.turnIntoList}>
            {turnIntoOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                className={css.menuItem}
                onClick={() => handleTurnInto(opt.action)}
              >
                <span className={css.itemIcon}>{opt.icon}</span>
                <span className={css.itemLabel}>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
