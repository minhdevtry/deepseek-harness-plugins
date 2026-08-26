/**
 * Dedicated floating action bubble for markdown links (Orca-grade polish).
 *
 * Appears when the caret sits inside a link or a link is selected, offering:
 * - Preview / direct open in browser
 * - Inline URL editing with confirm / cancel
 * - One-click URL copy with animated feedback
 * - Unlink action preserving text
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { clampPointPosition } from '../utils/positioning.ts'
import { resolveRelativePath } from '../utils/path.ts'
import { openInWorkbench } from '../fileOpener.ts'
import { IconButton, Tooltip } from '../ui/primitives/index.ts'
import css from './LinkBubble.module.css'

export interface LinkBubbleProps {
  editor: Editor
  currentPath?: string
}

export function LinkBubble({ editor, currentPath }: LinkBubbleProps) {
  const [visible, setVisible] = useState(false)
  const [href, setHref] = useState('')
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [isEditing, setIsEditing] = useState(false)
  const [editUrl, setEditUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const bubbleRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const isExternal = /^(https?:|mailto:|ftp:)/i.test(href)

  useLayoutEffect(() => {
    const update = () => {
      if (!editor.isFocused || !editor.isActive('link')) {
        setVisible(false)
        setIsEditing(false)
        return
      }

      const attrs = editor.getAttributes('link')
      const currentHref = (attrs.href as string) || ''
      setHref(currentHref)

      try {
        const { from } = editor.state.selection
        const pos = editor.view.coordsAtPos(from)
        const bubbleEl = bubbleRef.current
        const width = bubbleEl ? bubbleEl.offsetWidth : 280
        const height = bubbleEl ? bubbleEl.offsetHeight : 36

        const clamped = clampPointPosition({
          x: pos.left,
          y: pos.bottom,
          width,
          height,
          margin: 12,
        })

        setCoords(clamped)
        setVisible(true)
      } catch {
        setVisible(false)
      }
    }

    update()
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
    }
  }, [editor])

  useEffect(() => {
    if (isEditing) {
      setEditUrl(href)
      setTimeout(() => { inputRef.current?.focus() }, 30)
    }
  }, [isEditing, href])

  if (!visible) return null

  const handleOpen = () => {
    if (!href) return
    if (isExternal) {
      window.open(href, '_blank', 'noopener,noreferrer')
    } else {
      const targetPath = currentPath ? resolveRelativePath(currentPath, href) : href
      openInWorkbench(targetPath)
    }
  }

  const handleCopy = () => {
    if (!href) return
    void navigator.clipboard.writeText(href).then(() => {
      setCopied(true)
      setTimeout(() => { setCopied(false) }, 1500)
    })
  }

  const handleUnlink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setVisible(false)
  }

  const handleSaveEdit = () => {
    const trimmed = editUrl.trim()
    if (trimmed) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run()
      setHref(trimmed)
    }
    setIsEditing(false)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsEditing(false)
    }
  }

  return (
    <div
      ref={bubbleRef}
      className={css.bubble}
      style={{ top: coords.top, left: coords.left }}
      onMouseDown={e => { e.preventDefault() }}
    >
      {isEditing ? (
        <div className={css.editForm}>
          <input
            ref={inputRef}
            type="text"
            className={css.input}
            placeholder={isExternal ? 'https://...' : './document.md'}
            value={editUrl}
            onChange={e => { setEditUrl(e.target.value) }}
            onKeyDown={handleEditKeyDown}
          />
          <Tooltip content="Apply (Enter)">
            <IconButton size="xs" variant="default" onClick={handleSaveEdit} aria-label="Apply link edit">
              ✓
            </IconButton>
          </Tooltip>
          <Tooltip content="Cancel (Esc)">
            <IconButton size="xs" variant="ghost" onClick={() => { setIsEditing(false) }} aria-label="Cancel link edit">
              ✕
            </IconButton>
          </Tooltip>
        </div>
      ) : (
        <div className={css.viewBar}>
          <span className={css.urlText} title={href}>
            {isExternal ? '🌐 ' : '📄 '}
            {href || 'No URL'}
          </span>

          <Tooltip content={isExternal ? 'Open link in new browser tab' : 'Open document in Workbench tab'}>
            <IconButton size="xs" variant="ghost" onClick={handleOpen} aria-label="Open link">
              {isExternal ? (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 9v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4m3-2h4v4m-9 9L14 2" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h3.879a1.5 1.5 0 0 1 1.06.44l1.122 1.12A1.5 1.5 0 0 0 10.62 4H12.5A1.5 1.5 0 0 1 14 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9z" />
                </svg>
              )}
            </IconButton>
          </Tooltip>

          <Tooltip content="Edit link">
            <IconButton size="xs" variant="ghost" onClick={() => { setIsEditing(true) }} aria-label="Edit link">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M11 2l3 3L5 14H2v-3L11 2z" />
              </svg>
            </IconButton>
          </Tooltip>

          <Tooltip content={copied ? 'Copied!' : 'Copy URL'}>
            <IconButton size="xs" variant="ghost" onClick={handleCopy} aria-label="Copy URL">
              {copied ? (
                <span style={{ color: 'var(--dsw-alias-state-success-primary, #22c55e)', fontWeight: 'bold' }}>✓</span>
              ) : (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="5" y="5" width="8" height="8" rx="1.5" />
                  <path d="M3 11V3a1.5 1.5 0 0 1 1.5-1.5H11" />
                </svg>
              )}
            </IconButton>
          </Tooltip>

          <Tooltip content="Remove link">
            <IconButton size="xs" variant="ghost" onClick={handleUnlink} aria-label="Remove link">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 2l12 12M7 9a3 3 0 0 1 0-4.24l1.5-1.5a3 3 0 0 1 4.24 0M9 7a3 3 0 0 1 0 4.24l-1.5 1.5a3 3 0 0 1-4.24 0" />
              </svg>
            </IconButton>
          </Tooltip>
        </div>
      )}
    </div>
  )
}
