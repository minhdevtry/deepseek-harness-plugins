/**
 * Table of Contents (Outline) Drawer for TipTap documents.
 *
 * Scans the ProseMirror document for headings and provides click-to-scroll navigation.
 */
import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import css from './OutlineDrawer.module.css'

export interface OutlineItem {
  id: string
  level: number
  text: string
  pos: number
}

export interface OutlineDrawerProps {
  editor: Editor
  onClose: () => void
}

export function OutlineDrawer({ editor, onClose }: OutlineDrawerProps) {
  const [items, setItems] = useState<OutlineItem[]>([])

  useEffect(() => {
    const updateOutline = () => {
      const headings: OutlineItem[] = []
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = (node.attrs.level as number) || 1
          const text = node.textContent.trim()
          if (text.length > 0) {
            headings.push({
              id: `${pos}-${text}`,
              level,
              text,
              pos,
            })
          }
        }
      })
      setItems(headings)
    }

    updateOutline()
    editor.on('update', updateOutline)
    return () => {
      editor.off('update', updateOutline)
    }
  }, [editor])

  const scrollToHeading = (item: OutlineItem) => {
    editor.chain().focus().setTextSelection(item.pos + 1).scrollIntoView().run()
  }

  return (
    <div className={css.drawer}>
      <div className={css.header}>
        <span className={css.title}>📑 Outline</span>
        <button type="button" className={css.closeBtn} onClick={onClose} aria-label="Close outline">
          ✕
        </button>
      </div>

      <div className={css.list}>
        {items.length === 0 ? (
          <div className={css.empty}>No headings found in document.</div>
        ) : (
          items.map(item => (
            <button
              key={item.id}
              type="button"
              className={`${css.item} ${item.level === 1 ? css.h1 : item.level === 2 ? css.h2 : css.h3}`}
              onClick={() => { scrollToHeading(item) }}
              title={item.text}
            >
              {item.text}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
