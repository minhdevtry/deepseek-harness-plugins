/**
 * Contextual inline formatting toolbar for TipTap selections.
 *
 * Automatically suppresses itself inside code blocks where rich marks are
 * invalid syntax, and debounces editor blur events with a short delay so
 * clicks on toolbar actions (link mode, color palette, mention) execute
 * before the menu unmounts.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { HighlightPalette } from './highlight/HighlightPalette.tsx'
import { getLineRangeForSelection } from '../utils/chatComposer.ts'
import { appendToComposer, focusComposer } from '../composer.ts'
import { clampBubblePosition } from '../utils/positioning.ts'
import { basename } from '../utils/path.ts'
import css from './BubbleMenu.module.css'

export interface BubbleMenuProps {
  editor: Editor
  path?: string
  /**
   * The document's markdown, resolved on demand.
   *
   * A thunk rather than a string: it is needed only when Mention is clicked,
   * and serialising the document on every render of a menu that follows the
   * caret would be exactly the cost this editor was restructured to avoid.
   */
  markdown?: () => string
}

export function BubbleMenu({ editor, path, markdown }: BubbleMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [linkMode, setLinkMode] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [showPalette, setShowPalette] = useState(false)

  // Update bubble visibility & position on editor state change
  useLayoutEffect(() => {
    const updatePosition = () => {
      const { selection } = editor.state
      const { empty, from, to } = selection

      if (empty || !editor.isFocused) {
        setVisible(false)
        setLinkMode(false)
        return
      }

      // Check if we are inside a code block - skip bubble menu there
      if (editor.isActive('codeBlock')) {
        setVisible(false)
        return
      }

      try {
        const start = editor.view.coordsAtPos(from)
        const end = editor.view.coordsAtPos(to)
        const menuEl = menuRef.current
        const menuWidth = menuEl ? menuEl.offsetWidth : 300
        const menuHeight = menuEl ? menuEl.offsetHeight : 36

        const pos = clampBubblePosition({
          startTop: start.top,
          startLeft: start.left,
          endLeft: end.left,
          width: menuWidth,
          height: menuHeight,
          margin: 12,
          gap: 8,
        })

        setCoords(pos)
        setVisible(true)
      } catch {
        setVisible(false)
      }
    }

    const handleBlur = () => {
      // Small timeout to allow button clicks inside bubble menu
      setTimeout(() => {
        if (!menuRef.current?.contains(document.activeElement)) {
          setVisible(false)
          setLinkMode(false)
        }
      }, 150)
    }

    updatePosition()
    editor.on('selectionUpdate', updatePosition)
    editor.on('blur', handleBlur)

    return () => {
      editor.off('selectionUpdate', updatePosition)
      editor.off('blur', handleBlur)
    }
  }, [editor])

  const openLinkMode = () => {
    const previousUrl = (editor.getAttributes('link').href as string) || ''
    setLinkUrl(previousUrl)
    setLinkMode(true)
  }

  const applyLink = () => {
    if (linkUrl.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      let url = linkUrl.trim()
      if (!/^https?:\/\//i.test(url) && !url.startsWith('/') && !url.startsWith('#') && !url.startsWith('mailto:')) {
        url = `https://${url}`
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
    setLinkMode(false)
  }

  const unlink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setLinkMode(false)
  }

  const currentBlockType = () => {
    if (editor.isActive('heading', { level: 1 })) return 'h1'
    if (editor.isActive('heading', { level: 2 })) return 'h2'
    if (editor.isActive('heading', { level: 3 })) return 'h3'
    if (editor.isActive('bulletList')) return 'bulletList'
    if (editor.isActive('orderedList')) return 'orderedList'
    if (editor.isActive('taskList')) return 'taskList'
    if (editor.isActive('blockquote')) return 'blockquote'
    if (editor.isActive('callout')) return 'callout'
    return 'paragraph'
  }

  const setBlockType = (type: string) => {
    switch (type) {
      case 'paragraph':
        editor.chain().focus().setParagraph().run()
        break
      case 'h1':
        editor.chain().focus().toggleHeading({ level: 1 }).run()
        break
      case 'h2':
        editor.chain().focus().toggleHeading({ level: 2 }).run()
        break
      case 'h3':
        editor.chain().focus().toggleHeading({ level: 3 }).run()
        break
      case 'bulletList':
        editor.chain().focus().toggleBulletList().run()
        break
      case 'orderedList':
        editor.chain().focus().toggleOrderedList().run()
        break
      case 'taskList':
        editor.chain().focus().toggleTaskList().run()
        break
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run()
        break
      case 'callout':
        editor.chain().focus().toggleCallout({ type: 'info' }).run()
        break
    }
  }

  if (!visible) return null

  return (
    <div
      ref={menuRef}
      className={css.bubble}
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        transform: 'translate(-50%, 0)',
      }}
      onMouseDown={e => {
        // Prevent losing selection on click
        e.preventDefault()
      }}
    >
      {linkMode ? (
        <div className={css.linkPopover}>
          <input
            type="text"
            className={css.linkInput}
            placeholder="Paste or type URL..."
            value={linkUrl}
            onChange={e => { setLinkUrl(e.target.value) }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyLink()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setLinkMode(false)
              }
            }}
            autoFocus
          />
          <button type="button" className={css.linkApply} onClick={applyLink}>
            Apply
          </button>
          {editor.isActive('link') && (
            <button type="button" className={css.linkUnlink} onClick={unlink}>
              Unlink
            </button>
          )}
        </div>
      ) : (
        <>
          <select
            className={css.select}
            value={currentBlockType()}
            onChange={e => { setBlockType(e.target.value) }}
          >
            <option value="paragraph">Text</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="bulletList">Bullet List</option>
            <option value="orderedList">Numbered List</option>
            <option value="taskList">To-do List</option>
            <option value="blockquote">Quote</option>
            <option value="callout">Callout</option>
          </select>

          <span className={css.divider} />

          <button
            type="button"
            className={`${css.btn} ${css.btnBold}`}
            data-active={editor.isActive('bold') || undefined}
            onClick={() => { editor.chain().focus().toggleBold().run() }}
            title="Bold (Ctrl+B)"
          >
            B
          </button>
          <button
            type="button"
            className={`${css.btn} ${css.btnItalic}`}
            data-active={editor.isActive('italic') || undefined}
            onClick={() => { editor.chain().focus().toggleItalic().run() }}
            title="Italic (Ctrl+I)"
          >
            I
          </button>
          <button
            type="button"
            className={`${css.btn} ${css.btnUnderline}`}
            data-active={editor.isActive('underline') || undefined}
            onClick={() => { editor.chain().focus().toggleUnderline().run() }}
            title="Underline (Ctrl+U)"
          >
            U
          </button>
          <button
            type="button"
            className={`${css.btn} ${css.btnStrike}`}
            data-active={editor.isActive('strike') || undefined}
            onClick={() => { editor.chain().focus().toggleStrike().run() }}
            title="Strikethrough"
          >
            S
          </button>
          <button
            type="button"
            className={`${css.btn} ${css.btnCode}`}
            data-active={editor.isActive('code') || undefined}
            onClick={() => { editor.chain().focus().toggleCode().run() }}
            title="Inline Code"
          >
            {'</>'}
          </button>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <button
              type="button"
              className={css.btn}
              data-active={editor.isActive('highlight') || undefined}
              onClick={() => setShowPalette((prev) => !prev)}
              title="Highlight Color"
            >
              🎨
            </button>
            {showPalette && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100 }}>
                <HighlightPalette editor={editor} onClose={() => setShowPalette(false)} />
              </div>
            )}
          </div>
          <button
            type="button"
            className={css.btn}
            data-active={editor.isActive('link') || undefined}
            onClick={openLinkMode}
            title="Link (Ctrl+K)"
          >
            🔗
          </button>

          <span className={css.divider} />

          <button
            type="button"
            className={css.btn}
            data-active={editor.isActive({ textAlign: 'left' }) || undefined}
            onClick={() => { editor.chain().focus().setTextAlign('left').run() }}
            title="Align Left"
          >
            ⇤
          </button>
          <button
            type="button"
            className={css.btn}
            data-active={editor.isActive({ textAlign: 'center' }) || undefined}
            onClick={() => { editor.chain().focus().setTextAlign('center').run() }}
            title="Align Center"
          >
            ≡
          </button>
          <button
            type="button"
            className={css.btn}
            data-active={editor.isActive({ textAlign: 'right' }) || undefined}
            onClick={() => { editor.chain().focus().setTextAlign('right').run() }}
            title="Align Right"
          >
            ⇥
          </button>
          <button
            type="button"
            className={css.btn}
            data-active={editor.isActive({ textAlign: 'justify' }) || undefined}
            onClick={() => { editor.chain().focus().setTextAlign('justify').run() }}
            title="Align Justify"
          >
            ⇿
          </button>

          {path && (
            <>
              <span className={css.divider} />
              <button
                type="button"
                className={css.btn}
                style={{
                  color: 'var(--dsw-alias-state-business-primary, #2563eb)',
                  fontWeight: 600,
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px'
                }}
                onClick={() => {
                  const { from, to } = editor.state.selection
                  const selectedText = editor.state.doc.textBetween(from, to, '\n')
                  const fullText = markdown ? markdown() : ''
                  const textBefore = editor.state.doc.textBetween(0, from, '\n')
                  const fromOffset = textBefore.length
                  const { rangeString } = getLineRangeForSelection(fullText, selectedText, {
                    from: fromOffset,
                    to: fromOffset + selectedText.length,
                  })
                  const filename = basename(path) || path
                  if (appendToComposer(`@${filename} ${rangeString}`)) focusComposer()
                }}
                title="Mention Selection in Chat (Ctrl+L)"
              >
                💬 Mention
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
