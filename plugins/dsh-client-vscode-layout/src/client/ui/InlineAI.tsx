/**
 * Inline AI Assist Modal (Ctrl+K).
 *
 * Provides inline code generation, transformation, and refactoring on the active buffer.
 */
import { useEffect, useRef, useState } from 'react'
import css from './InlineAI.module.css'

export interface InlineAIProps {
  open: boolean
  selectionText?: string | undefined
  /** Absolute path of the active file, shown as context in the header. */
  path?: string | undefined
  onClose: () => void
  onSubmit: (prompt: string, contextSnippet?: string) => void
}

export function InlineAI({ open, selectionText, path, onClose, onSubmit }: InlineAIProps) {
  const [prompt, setPrompt] = useState('')
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (open) {
      setPrompt('')
      setTimeout(() => { inputRef.current?.focus() }, 30)
    }
  }, [open])

  const handleSubmit = () => {
    const trimmed = prompt.trim()
    if (trimmed.length === 0) return
    onSubmit(trimmed, selectionText)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!open) return null

  return (
    <div
      className={css.backdrop}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`${css.widget} vk_inline_ai_widget`} data-vk-inline-ai="true">
        <div className={css.header}>
          <span>🤖 Inline AI Assist</span>
          {path && <span style={{ opacity: 0.7, marginLeft: 'auto', fontSize: 11 }}>{path.split('/').pop()}</span>}
        </div>

        {selectionText && selectionText.length > 0 && (
          <div className={css.selectionPreview} title="Selected context snippet">
            {selectionText.length > 250 ? `${selectionText.slice(0, 250)}...` : selectionText}
          </div>
        )}

        <div className={css.inputWrap}>
          <textarea
            ref={inputRef}
            className={`${css.input} vk_inline_ai_input`}
            placeholder="Ask AI to edit, refactor, or explain this code... (Enter to submit)"
            value={prompt}
            onChange={e => { setPrompt(e.target.value) }}
            onKeyDown={handleKeyDown}
          />

          <div className={css.actions}>
            <button type="button" className={css.cancelBtn} onClick={onClose}>
              Cancel (Esc)
            </button>
            <button type="button" className={css.submitBtn} onClick={handleSubmit}>
              ✨ Generate / Edit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
