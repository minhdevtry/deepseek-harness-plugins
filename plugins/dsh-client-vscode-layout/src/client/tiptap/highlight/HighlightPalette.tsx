import type { Editor } from '@tiptap/core'
import css from './HighlightPalette.module.css'

export interface HighlightPaletteProps {
  editor: Editor
  onClose?: () => void
}

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', color: '#fef08a' },
  { name: 'Green', color: '#bbf7d0' },
  { name: 'Blue', color: '#bfdbfe' },
  { name: 'Purple', color: '#e9d5ff' },
  { name: 'Pink', color: '#fbcfe8' },
  { name: 'Orange', color: '#fed7aa' },
]

export function HighlightPalette({ editor, onClose }: HighlightPaletteProps) {
  const handleSelectColor = (color: string) => {
    editor.chain().focus().setHighlight({ color }).run()
    if (onClose) onClose()
  }

  const handleClear = () => {
    editor.chain().focus().unsetHighlight().run()
    if (onClose) onClose()
  }

  return (
    <div className={css.palette}>
      {HIGHLIGHT_COLORS.map((c) => (
        <button
          key={c.name}
          type="button"
          className={css.colorDot}
          style={{ backgroundColor: c.color }}
          title={c.name}
          onClick={() => handleSelectColor(c.color)}
        />
      ))}
      <button
        type="button"
        className={css.clearBtn}
        onClick={handleClear}
        title="Remove highlight"
      >
        Clear
      </button>
    </div>
  )
}
