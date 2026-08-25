/**
 * Isolated live HTML preview pane.
 *
 * Runs inside a sandboxed iframe (`sandbox="allow-scripts allow-modals"`) to
 * prevent preview scripts from accessing the host workbench DOM, cookies, or
 * local storage. Manual reloads increment an explicit React key to force the
 * browser to destroy and recreate the frame instance, wiping in-memory JS state.
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
