import { useState } from 'react'
import type { Editor } from '@tiptap/core'
import css from './HighlightPalette.module.css'

export interface HighlightPaletteProps {
  editor: Editor
  onClose?: () => void
}

const TEXT_COLORS = [
  { name: 'Default', color: null, preview: '#000000' },
  { name: 'Gray', color: '#787774', preview: '#787774' },
  { name: 'Brown', color: '#976d57', preview: '#976d57' },
  { name: 'Orange', color: '#cc7722', preview: '#cc7722' },
  { name: 'Yellow', color: '#c29210', preview: '#c29210' },
  { name: 'Green', color: '#448361', preview: '#448361' },
  { name: 'Blue', color: '#337ea9', preview: '#337ea9' },
  { name: 'Purple', color: '#9065b0', preview: '#9065b0' },
  { name: 'Pink', color: '#c14c8a', preview: '#c14c8a' },
  { name: 'Red', color: '#d44c47', preview: '#d44c47' },
]

const HIGHLIGHT_COLORS = [
  { name: 'Default', color: null, preview: '#ffffff' },
  { name: 'Gray', color: '#f1f1ef', preview: '#9ca3af' },
  { name: 'Brown', color: '#f4eeee', preview: '#b45309' },
  { name: 'Orange', color: '#faebd7', preview: '#f97316' },
  { name: 'Yellow', color: '#fef08a', preview: '#eab308' },
  { name: 'Green', color: '#bbf7d0', preview: '#22c55e' },
  { name: 'Blue', color: '#bfdbfe', preview: '#3b82f6' },
  { name: 'Purple', color: '#e9d5ff', preview: '#a855f7' },
  { name: 'Pink', color: '#fbcfe8', preview: '#ec4899' },
  { name: 'Red', color: '#fee2e2', preview: '#ef4444' },
]

export function HighlightPalette({ editor, onClose }: HighlightPaletteProps) {
  const [tab, setTab] = useState<'text' | 'highlight'>('text')

  const currentColor = editor.getAttributes('textStyle').color
  const currentHighlight = editor.getAttributes('highlight').color

  const handleSelectTextColor = (color: string | null) => {
    if (color === null) {
      editor.chain().focus().unsetColor().run()
    } else {
      editor.chain().focus().setColor(color).run()
    }
    if (onClose) onClose()
  }

  const handleSelectHighlightColor = (color: string | null) => {
    if (color === null) {
      editor.chain().focus().unsetHighlight().run()
    } else {
      editor.chain().focus().setHighlight({ color }).run()
    }
    if (onClose) onClose()
  }

  return (
    <div className={css.container} role="dialog" aria-label="Color Picker">
      <div className={css.tabs}>
        <button
          type="button"
          className={`${css.tab} ${tab === 'text' ? css.activeTab : ''}`}
          onClick={() => setTab('text')}
        >
          Text Color
        </button>
        <button
          type="button"
          className={`${css.tab} ${tab === 'highlight' ? css.activeTab : ''}`}
          onClick={() => setTab('highlight')}
        >
          Background
        </button>
      </div>

      <div className={css.list}>
        {tab === 'text'
          ? TEXT_COLORS.map((c) => {
              const isSelected = c.color === null ? !currentColor : currentColor === c.color
              return (
                <button
                  key={c.name}
                  type="button"
                  className={`${css.item} ${isSelected ? css.selectedItem : ''}`}
                  onClick={() => handleSelectTextColor(c.color)}
                >
                  <span
                    className={css.sample}
                    style={{ color: c.color ?? 'inherit', fontWeight: 600 }}
                  >
                    A
                  </span>
                  <span className={css.name}>{c.name}</span>
                  {isSelected && <span className={css.check}>✓</span>}
                </button>
              )
            })
          : HIGHLIGHT_COLORS.map((c) => {
              const isSelected =
                c.color === null ? !currentHighlight : currentHighlight === c.color
              return (
                <button
                  key={c.name}
                  type="button"
                  className={`${css.item} ${isSelected ? css.selectedItem : ''}`}
                  onClick={() => handleSelectHighlightColor(c.color)}
                >
                  <span
                    className={css.colorBox}
                    style={{ backgroundColor: c.color ?? 'transparent' }}
                  />
                  <span className={css.name}>{c.name}</span>
                  {isSelected && <span className={css.check}>✓</span>}
                </button>
              )
            })}
      </div>
    </div>
  )
}
