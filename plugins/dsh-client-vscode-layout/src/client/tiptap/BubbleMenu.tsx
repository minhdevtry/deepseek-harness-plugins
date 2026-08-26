/**
 * Notion-Style Unified Text Action & AI Menu for TipTap selections.
 *
 * True 1:1 Notion design with exact vector SVGs, sleek typography,
 * Block Switcher Submenu, 2-row formatting grid, elegant Skills list,
 * and inline AI prompt input.
 * Fully adaptive to Light / Dark themes via CSS design tokens.
 */
import { useLayoutEffect, useRef, useState, type ReactNode, type KeyboardEvent } from 'react'
import type { Editor } from '@tiptap/core'
import { HighlightPalette } from './highlight/HighlightPalette.tsx'
import { getLineRangeForSelection } from '../utils/chatComposer.ts'
import { appendMentionToComposer, focusComposer } from '../composer.ts'
import { clampBubblePosition } from '../utils/positioning.ts'
import { basename } from '../utils/path.ts'
import type { AIActionId } from './ai/types.ts'
import {
  NotionIconTextNormal,
  NotionIconChevronRight,
  NotionIconBold,
  NotionIconItalic,
  NotionIconUnderline,
  NotionIconClearFormat,
  NotionIconLink,
  NotionIconStrikethrough,
  NotionIconCode,
  NotionIconAlignLeft,
  NotionIconAlignCenter,
  NotionIconAlignRight,
  NotionIconAlignJustify,
  NotionIconComment,
  NotionIconSliders,
  NotionIconPencil,
  NotionIconHeading,
  NotionIconBulletList,
  NotionIconNumberedList,
  NotionIconTodoList,
  NotionIconQuote,
  NotionIconCallout,
  NotionIconToggle,
} from './ui/TipTapIcons.tsx'
import css from './BubbleMenu.module.css'

export interface BubbleMenuProps {
  editor: Editor
  path?: string
  markdown?: () => string
  onOpenAI?: (customInitialPrompt?: string, actionId?: AIActionId, executeNow?: boolean) => void
}

interface BlockTypeOption {
  id: string
  label: string
  icon: ReactNode
  desc: string
}

const BLOCK_TYPES: BlockTypeOption[] = [
  { id: 'paragraph', label: 'Normal Text', icon: <NotionIconTextNormal size={16} />, desc: 'Plain text paragraph' },
  { id: 'h1', label: 'Heading 1', icon: <NotionIconHeading level={1} size={16} />, desc: 'Large section heading' },
  { id: 'h2', label: 'Heading 2', icon: <NotionIconHeading level={2} size={16} />, desc: 'Medium section heading' },
  { id: 'h3', label: 'Heading 3', icon: <NotionIconHeading level={3} size={16} />, desc: 'Small section heading' },
  { id: 'bulletList', label: 'Bulleted list', icon: <NotionIconBulletList size={16} />, desc: 'Simple bulleted list' },
  { id: 'orderedList', label: 'Numbered list', icon: <NotionIconNumberedList size={16} />, desc: 'Ordered numbered list' },
  { id: 'taskList', label: 'To-do list', icon: <NotionIconTodoList size={16} />, desc: 'Track tasks with checkboxes' },
  { id: 'blockquote', label: 'Quote', icon: <NotionIconQuote size={16} />, desc: 'Capture a quote' },
  { id: 'callout', label: 'Callout', icon: <NotionIconCallout size={16} />, desc: 'Highlighted alert block' },
  { id: 'details', label: 'Toggle list', icon: <NotionIconToggle size={16} />, desc: 'Collapsible toggle block' },
  { id: 'codeBlock', label: 'Code block', icon: <NotionIconCode size={16} />, desc: 'Syntax-highlighted code' },
]

interface AISkillOption {
  id: AIActionId
  label: string
  hint: string
}

const AI_SKILLS: AISkillOption[] = [
  { id: 'improve', label: 'Improve writing', hint: 'Trau chuốt văn phong' },
  { id: 'fix_grammar', label: 'Proofread', hint: 'Sửa lỗi chính tả & ngữ pháp' },
  { id: 'continue', label: 'Explain', hint: 'Giải thích nội dung' },
  { id: 'shorten', label: 'Make shorter', hint: 'Rút gọn' },
  { id: 'lengthen', label: 'Make longer', hint: 'Mở rộng chi tiết' },
  { id: 'summarize', label: 'Summarize', hint: 'Tóm tắt ý chính' },
  { id: 'tasks', label: 'Action items', hint: 'Trích xuất việc cần làm' },
  { id: 'table', label: 'Convert to table', hint: 'Chuyển thành bảng' },
]

export function BubbleMenu({ editor, path, markdown, onOpenAI }: BubbleMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [linkMode, setLinkMode] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [showPalette, setShowPalette] = useState(false)
  const [showBlockSubmenu, setShowBlockSubmenu] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMouseDownRef = useRef(false)

  // Update bubble visibility & position on editor selection change with Notion-like smooth delay (calculated after mouseup)
  useLayoutEffect(() => {
    const updatePosition = () => {
      const { selection } = editor.state
      const { empty, from, to } = selection

      if (empty || !editor.isFocused) {
        if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
        setRevealed(false)
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
        hideTimerRef.current = setTimeout(() => {
          setMounted(false)
          setLinkMode(false)
          setShowPalette(false)
          setShowBlockSubmenu(false)
        }, 120)
        return
      }

      // Suppress inside code block
      if (editor.isActive('codeBlock')) {
        setRevealed(false)
        setMounted(false)
        return
      }

      // If user is actively holding down the mouse and dragging selection, DO NOT show yet
      if (isMouseDownRef.current) {
        if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
        setRevealed(false)
        return
      }

      try {
        const start = editor.view.coordsAtPos(from)
        const end = editor.view.coordsAtPos(to)
        const menuEl = menuRef.current
        const menuWidth = menuEl ? menuEl.offsetWidth : 192
        const menuHeight = menuEl ? menuEl.offsetHeight : 280

        const pos = clampBubblePosition({
          startTop: start.top,
          startBottom: start.bottom,
          startLeft: start.left,
          endLeft: end.left,
          width: menuWidth,
          height: menuHeight,
          margin: 12,
          gap: 8,
        })

        if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
        setCoords(pos)
        setMounted(true)

        // Notion-like smooth delay (60ms) starting from when mouse is released
        if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
        revealTimerRef.current = setTimeout(() => {
          setRevealed(true)
        }, 60)
      } catch {
        setRevealed(false)
        setMounted(false)
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (menuRef.current && menuRef.current.contains(target)) {
        return
      }
      isMouseDownRef.current = true
    }

    const handleMouseUp = () => {
      if (isMouseDownRef.current) {
        isMouseDownRef.current = false
        // Trigger smooth reveal right from mouse release
        updatePosition()
      }
    }

    const handleBlur = () => {
      setTimeout(() => {
        if (!menuRef.current?.contains(document.activeElement)) {
          setRevealed(false)
          setMounted(false)
          setLinkMode(false)
          setShowPalette(false)
          setShowBlockSubmenu(false)
        }
      }, 150)
    }

    updatePosition()
    editor.on('selectionUpdate', updatePosition)
    editor.on('update', updatePosition)
    editor.on('blur', handleBlur)
    window.addEventListener('mousedown', handleMouseDown, true)
    window.addEventListener('mouseup', handleMouseUp, true)

    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      editor.off('selectionUpdate', updatePosition)
      editor.off('update', updatePosition)
      editor.off('blur', handleBlur)
      window.removeEventListener('mousedown', handleMouseDown, true)
      window.removeEventListener('mouseup', handleMouseUp, true)
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

  const getCurrentBlock = (): BlockTypeOption => {
    let id = 'paragraph'
    if (editor.isActive('heading', { level: 1 })) id = 'h1'
    else if (editor.isActive('heading', { level: 2 })) id = 'h2'
    else if (editor.isActive('heading', { level: 3 })) id = 'h3'
    else if (editor.isActive('bulletList')) id = 'bulletList'
    else if (editor.isActive('orderedList')) id = 'orderedList'
    else if (editor.isActive('taskList')) id = 'taskList'
    else if (editor.isActive('blockquote')) id = 'blockquote'
    else if (editor.isActive('callout')) id = 'callout'
    else if (editor.isActive('details')) id = 'details'
    else if (editor.isActive('codeBlock')) id = 'codeBlock'

    return BLOCK_TYPES.find(b => b.id === id) || BLOCK_TYPES[0]!
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
      case 'details':
        editor.chain().focus().setDetails().run()
        break
      case 'codeBlock':
        editor.chain().focus().toggleCodeBlock().run()
        break
    }
    setShowBlockSubmenu(false)
  }

  const handleClearFormat = () => {
    editor.chain().focus().unsetAllMarks().clearNodes().run()
  }

  const handleCycleAlign = () => {
    if (editor.isActive({ textAlign: 'left' })) {
      editor.chain().focus().setTextAlign('center').run()
    } else if (editor.isActive({ textAlign: 'center' })) {
      editor.chain().focus().setTextAlign('right').run()
    } else if (editor.isActive({ textAlign: 'right' })) {
      editor.chain().focus().setTextAlign('justify').run()
    } else if (editor.isActive({ textAlign: 'justify' })) {
      editor.chain().focus().setTextAlign('left').run()
    } else {
      editor.chain().focus().setTextAlign('center').run()
    }
  }

  const renderAlignIcon = () => {
    if (editor.isActive({ textAlign: 'center' })) return <NotionIconAlignCenter size={16} />
    if (editor.isActive({ textAlign: 'right' })) return <NotionIconAlignRight size={16} />
    if (editor.isActive({ textAlign: 'justify' })) return <NotionIconAlignJustify size={16} />
    return <NotionIconAlignLeft size={16} />
  }

  const handleRunSkill = (skill: AISkillOption) => {
    onOpenAI?.(skill.label, skill.id, true)
    setRevealed(false)
    setMounted(false)
  }

  const handleAiInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const prompt = aiInput.trim()
      if (prompt) {
        onOpenAI?.(prompt, 'custom', true)
        setAiInput('')
        setRevealed(false)
        setMounted(false)
      }
    }
  }

  const currentBlock = getCurrentBlock()
  const hasColorApplied = editor.isActive('textStyle') || editor.isActive('highlight')
  const textColor = (editor.getAttributes('textStyle').color as string) || null
  const highlightColor = (editor.getAttributes('highlight').color as string) || null

  if (!mounted) return null

  return (
    <div
      ref={menuRef}
      className={`${css.bubbleWrapper} ${revealed ? css.visible : ''}`}
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
      }}
      onMouseDown={e => {
        // Prevent losing selection on click
        e.preventDefault()
      }}
    >
      <div className={css.actionCard}>
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
            <button type="button" className={css.linkApplyBtn} onClick={applyLink}>
              Apply
            </button>
            {editor.isActive('link') && (
              <button type="button" className={css.linkUnlinkBtn} onClick={unlink}>
                Unlink
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Row 1: Block Type Switcher & Submenu */}
            <div className={css.blockSwitcherWrapper}>
              <button
                type="button"
                className={css.blockTypeBtn}
                onClick={() => {
                  setShowBlockSubmenu(prev => !prev)
                  setShowPalette(false)
                }}
                aria-haspopup="menu"
                aria-expanded={showBlockSubmenu}
              >
                <div className={css.blockTypeInfo}>
                  <span className={css.blockTypeIcon}>{currentBlock.icon}</span>
                  <span className={css.blockTypeLabel}>{currentBlock.label}</span>
                </div>
                <NotionIconChevronRight size={12} className={css.chevron} />
              </button>

              {/* Submenu Dropdown */}
              {showBlockSubmenu && (
                <div className={css.submenu} role="menu">
                  {BLOCK_TYPES.map(bt => {
                    const isActive = bt.id === currentBlock.id
                    return (
                      <button
                        key={bt.id}
                        type="button"
                        className={`${css.submenuItem} ${isActive ? css.submenuItemActive : ''}`}
                        onClick={() => setBlockType(bt.id)}
                      >
                        <span className={css.submenuIcon}>{bt.icon}</span>
                        <div className={css.submenuText}>
                          <span className={css.submenuLabel}>{bt.label}</span>
                          <span className={css.submenuDesc}>{bt.desc}</span>
                        </div>
                        {isActive && <span className={css.checkMark}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className={css.divider} />

            {/* Row 2: Formatting Toolbar Grid (5x2 layout) */}
            <div className={css.formatGrid}>
              {/* Row 2.1: Color, Bold, Italic, Underline, Clear */}
              <div className={css.formatRow}>
                {/* Text / Highlight Color Button */}
                <div className={css.colorPickerWrapper}>
                  <button
                    type="button"
                    className={`${css.formatBtn} ${hasColorApplied ? css.formatBtnActive : ''}`}
                    onClick={() => {
                      setShowPalette(prev => !prev)
                      setShowBlockSubmenu(false)
                    }}
                    title="Text & background color"
                    aria-label="Color & Highlight"
                  >
                    <div
                      className={css.colorSampleA}
                      style={{
                        color: textColor || 'var(--dsw-alias-label-primary)',
                        backgroundColor: highlightColor || 'transparent',
                      }}
                    >
                      A
                    </div>
                  </button>
                  {showPalette && (
                    <div className={css.palettePopover}>
                      <HighlightPalette editor={editor} onClose={() => setShowPalette(false)} />
                    </div>
                  )}
                </div>

                {/* Bold */}
                <button
                  type="button"
                  className={`${css.formatBtn} ${editor.isActive('bold') ? css.formatBtnActive : ''}`}
                  onClick={() => { editor.chain().focus().toggleBold().run() }}
                  title="Bold (Ctrl+B)"
                  aria-pressed={editor.isActive('bold')}
                >
                  <NotionIconBold size={16} />
                </button>

                {/* Italic */}
                <button
                  type="button"
                  className={`${css.formatBtn} ${editor.isActive('italic') ? css.formatBtnActive : ''}`}
                  onClick={() => { editor.chain().focus().toggleItalic().run() }}
                  title="Italic (Ctrl+I)"
                  aria-pressed={editor.isActive('italic')}
                >
                  <NotionIconItalic size={16} />
                </button>

                {/* Underline */}
                <button
                  type="button"
                  className={`${css.formatBtn} ${editor.isActive('underline') ? css.formatBtnActive : ''}`}
                  onClick={() => { editor.chain().focus().toggleUnderline().run() }}
                  title="Underline (Ctrl+U)"
                  aria-pressed={editor.isActive('underline')}
                >
                  <NotionIconUnderline size={16} />
                </button>

                {/* Clear Formatting */}
                <button
                  type="button"
                  className={css.formatBtn}
                  onClick={handleClearFormat}
                  title="Clear format"
                  aria-label="Clear format"
                >
                  <NotionIconClearFormat size={16} />
                </button>
              </div>

              {/* Row 2.2: Link, Strikethrough, Code, Mention/Chat, More */}
              <div className={css.formatRow}>
                {/* Link */}
                <button
                  type="button"
                  className={`${css.formatBtn} ${editor.isActive('link') ? css.formatBtnActive : ''}`}
                  onClick={openLinkMode}
                  title="Link (Ctrl+K)"
                  aria-pressed={editor.isActive('link')}
                >
                  <NotionIconLink size={16} />
                </button>

                {/* Strikethrough */}
                <button
                  type="button"
                  className={`${css.formatBtn} ${editor.isActive('strike') ? css.formatBtnActive : ''}`}
                  onClick={() => { editor.chain().focus().toggleStrike().run() }}
                  title="Strikethrough"
                  aria-pressed={editor.isActive('strike')}
                >
                  <NotionIconStrikethrough size={16} />
                </button>

                {/* Inline Code */}
                <button
                  type="button"
                  className={`${css.formatBtn} ${editor.isActive('code') ? css.formatBtnActive : ''}`}
                  onClick={() => { editor.chain().focus().toggleCode().run() }}
                  title="Inline code"
                  aria-pressed={editor.isActive('code')}
                >
                  <NotionIconCode size={16} />
                </button>

                {/* Text Alignment (Left / Center / Right / Justify) */}
                <button
                  type="button"
                  className={`${css.formatBtn} ${
                    editor.isActive({ textAlign: 'center' }) ||
                    editor.isActive({ textAlign: 'right' }) ||
                    editor.isActive({ textAlign: 'justify' })
                      ? css.formatBtnActive
                      : ''
                  }`}
                  onClick={handleCycleAlign}
                  title="Align text (Left / Center / Right / Justify)"
                  aria-label="Align text"
                >
                  {renderAlignIcon()}
                </button>

                {/* Mention in Chat */}
                <button
                  type="button"
                  className={css.formatBtn}
                  onClick={() => {
                    if (path) {
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
                      appendMentionToComposer(filename, rangeString)
                      focusComposer()
                    }
                  }}
                  title="Mention selection in Chat"
                  aria-label="Mention in Chat"
                >
                  <NotionIconComment size={16} />
                </button>
              </div>
            </div>

            <div className={css.divider} />

            {/* Row 3: AI Skills Section (Scrollable with Fade Mask) */}
            <div className={css.skillsSection}>
              <div className={css.skillsHeader}>
                <span>Skills</span>
                <NotionIconSliders size={14} className={css.slidersIcon} />
              </div>

              <div className={css.skillsList}>
                {AI_SKILLS.map(skill => (
                  <button
                    key={skill.id}
                    type="button"
                    className={css.skillItem}
                    onClick={() => handleRunSkill(skill)}
                    title={skill.hint}
                  >
                    <span className={css.skillLabel}>{skill.label}</span>
                    <span className={css.skillPencil}>
                      <NotionIconPencil size={13} />
                    </span>
                  </button>
                ))}
              </div>
              <div className={css.fadeMask} />
            </div>

            <div className={css.divider} style={{ marginBlock: '2px 4px' }} />

            {/* Row 4: Inline AI Prompt Input */}
            <div className={css.aiInputWrapper}>
              <input
                type="text"
                className={css.aiInput}
                placeholder="Edit with AI"
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={handleAiInputKeyDown}
              />
              <span className={css.shortcutBadge}>Alt+⇧+E</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
