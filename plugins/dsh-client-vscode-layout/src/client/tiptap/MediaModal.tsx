/**
 * Media and Block Insert Modal Dialog.
 *
 * Supports inserting Images (URL + alt), YouTube videos (URL), and Custom Tables.
 */
import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import css from './MediaModal.module.css'

export type MediaModalType = 'image' | 'youtube' | 'table'

export interface MediaModalProps {
  type: MediaModalType
  editor: Editor
  onClose: () => void
}

export function MediaModal({ type, editor, onClose }: MediaModalProps) {
  const [url, setUrl] = useState('')
  const [alt, setAlt] = useState('')
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [withHeader, setWithHeader] = useState(true)

  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (type === 'image') {
      const trimmed = url.trim()
      if (trimmed !== '') {
        const altText = alt.trim()
        if (altText) {
          editor.chain().focus().setImage({ src: trimmed, alt: altText }).run()
        } else {
          editor.chain().focus().setImage({ src: trimmed }).run()
        }
      }
    } else if (type === 'youtube') {
      const trimmed = url.trim()
      if (trimmed !== '') {
        editor.chain().focus().setYoutubeVideo({ src: trimmed }).run()
      }
    } else if (type === 'table') {
      const r = Math.max(1, Math.min(20, rows))
      const c = Math.max(1, Math.min(20, cols))
      editor.chain().focus().insertTable({ rows: r, cols: c, withHeaderRow: withHeader }).run()
    }

    onClose()
  }

  const title = type === 'image' ? 'Insert Image' : type === 'youtube' ? 'Embed YouTube Video' : 'Insert Table'

  return (
    <div
      className={css.backdrop}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={css.modal} role="dialog" aria-modal="true">
        <div className={css.header}>
          <span className={css.title}>{title}</span>
          <button type="button" className={css.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={css.body}>
            {type === 'image' && (
              <>
                <div className={css.field}>
                  <label className={css.label}>Image URL</label>
                  <input
                    ref={inputRef}
                    type="url"
                    className={css.input}
                    placeholder="https://example.com/image.png"
                    value={url}
                    onChange={e => { setUrl(e.target.value) }}
                    required
                  />
                </div>
                <div className={css.field}>
                  <label className={css.label}>Alt Text (Optional)</label>
                  <input
                    type="text"
                    className={css.input}
                    placeholder="Description of the image"
                    value={alt}
                    onChange={e => { setAlt(e.target.value) }}
                  />
                </div>
              </>
            )}

            {type === 'youtube' && (
              <div className={css.field}>
                <label className={css.label}>YouTube URL</label>
                <input
                  ref={inputRef}
                  type="url"
                  className={css.input}
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={url}
                  onChange={e => { setUrl(e.target.value) }}
                  required
                />
              </div>
            )}

            {type === 'table' && (
              <>
                <div className={css.row}>
                  <div className={css.field} style={{ flex: 1 }}>
                    <label className={css.label}>Rows</label>
                    <input
                      ref={inputRef}
                      type="number"
                      min="1"
                      max="20"
                      className={css.input}
                      value={rows}
                      onChange={e => { setRows(parseInt(e.target.value, 10) || 1) }}
                    />
                  </div>
                  <div className={css.field} style={{ flex: 1 }}>
                    <label className={css.label}>Columns</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      className={css.input}
                      value={cols}
                      onChange={e => { setCols(parseInt(e.target.value, 10) || 1) }}
                    />
                  </div>
                </div>
                <label className={css.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={withHeader}
                    onChange={e => { setWithHeader(e.target.checked) }}
                  />
                  <span>Include Header Row</span>
                </label>
              </>
            )}
          </div>

          <div className={css.footer}>
            <button type="button" className={`${css.btn} ${css.btnCancel}`} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={`${css.btn} ${css.btnPrimary}`}>
              {type === 'table' ? 'Insert Table' : 'Embed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
