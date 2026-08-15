/**
 * Sandboxed HTML Live Preview component.
 *
 * Provides a responsive preview pane for HTML files with reload and raw source toggle.
 */
import { useState } from 'react'
import css from './HtmlPreview.module.css'

export interface HtmlPreviewProps {
  content: string
  title?: string | undefined
  onToggleRaw: () => void
}

export function HtmlPreview({ content, title, onToggleRaw }: HtmlPreviewProps) {
  const [key, setKey] = useState(0)

  const handleReload = () => {
    setKey(k => k + 1)
  }

  return (
    <div className={css.wrap}>
      <div className={css.toolbar}>
        <span className={css.title}>
          🌐 HTML Live Preview {title ? `(${title})` : ''}
        </span>
        <button type="button" className={css.reloadBtn} onClick={handleReload} title="Reload Preview">
          🔄 Reload
        </button>
        <button type="button" className={css.toggleBtn} onClick={onToggleRaw}>
          💻 View Raw HTML
        </button>
      </div>

      <div className={css.frameWrap}>
        <iframe
          key={key}
          srcDoc={content}
          title={title || 'HTML Preview'}
          sandbox="allow-scripts allow-modals"
          className={css.iframe}
        />
      </div>
    </div>
  )
}
