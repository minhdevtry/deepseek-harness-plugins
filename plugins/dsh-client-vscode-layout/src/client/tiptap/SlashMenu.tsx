/**
 * Floating Slash-Command Menu popup for TipTap.
 *
 * Renders the ranked and grouped commands from `commands.ts`.
 * Anchored to the current caret coordinates and navigates via keyboard.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { matchCommands, groupMatches, type CommandId, type SlashCommand } from './commands.ts'
import css from './SlashMenu.module.css'

export interface SlashMenuProps {
  editor: Editor
  query: string
  range: { from: number; to: number }
  position: { top: number; left: number; bottom: number }
  onClose: () => void
  onOpenMediaModal: (type: 'image' | 'youtube' | 'table') => void
}

const ICONS: Record<CommandId, string> = {
  paragraph: 'T',
  heading1: 'H1',
  heading2: 'H2',
  heading3: 'H3',
  blockquote: '”',
  bulletList: '•',
  orderedList: '1.',
  taskList: '☑',
  image: '🖼️',
  youtube: '▶️',
  video: '🎬',
  table: '⊞',
  codeBlock: '</>',
  mermaid: '📊',
  mathBlock: '∑',
  callout: '💡',
  divider: '―',
}

const GROUP_TITLES: Record<string, string> = {
  basic: 'Basic Blocks',
  lists: 'Lists',
  media: 'Media & Embeds',
  advanced: 'Advanced & Visuals',
}

export function SlashMenu({
  editor,
  query,
  range,
  position,
  onClose,
  onOpenMediaModal,
}: SlashMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const matches = useMemo(() => matchCommands(query), [query])
  const flatCommands = useMemo(() => matches.map(m => m.command), [matches])
  const groups = useMemo(() => groupMatches(matches), [matches])

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Calculate clamped viewport position
  const [coords, setCoords] = useState({ top: position.bottom + 6, left: position.left })

  useLayoutEffect(() => {
    const el = menuRef.current
    if (el === null) return
    const rect = el.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth

    let top = position.bottom + 6
    let left = Math.min(position.left, viewportWidth - rect.width - 16)
    if (left < 16) left = 16

    // Flip up if near bottom edge
    if (top + rect.height > viewportHeight - 16) {
      top = Math.max(16, position.top - rect.height - 6)
    }

    setCoords({ top, left })
  }, [position, matches.length])

  // Scroll active item into view
  useEffect(() => {
    const el = menuRef.current
    if (el === null) return
    const activeBtn = el.querySelector<HTMLButtonElement>(`[data-index="${selectedIndex}"]`)
    if (activeBtn) {
      activeBtn.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const execute = (command: SlashCommand) => {
    // Delete the trigger text ("/query")
    editor.chain().focus().deleteRange(range).run()

    switch (command.id) {
      case 'paragraph':
        editor.chain().focus().setParagraph().run()
        break
      case 'heading1':
        editor.chain().focus().toggleHeading({ level: 1 }).run()
        break
      case 'heading2':
        editor.chain().focus().toggleHeading({ level: 2 }).run()
        break
      case 'heading3':
        editor.chain().focus().toggleHeading({ level: 3 }).run()
        break
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run()
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
      case 'codeBlock':
        editor.chain().focus().toggleCodeBlock().run()
        break
      case 'mermaid':
        (editor.commands as any).setMermaid?.()
        break
      case 'mathBlock':
        (editor.commands as any).setMathBlock?.()
        break
      case 'callout':
        editor.chain().focus().toggleCallout({ type: 'info' }).run()
        break
      case 'divider':
        editor.chain().focus().setHorizontalRule().run()
        break
      case 'image':
        onOpenMediaModal('image')
        break
      case 'youtube':
        onOpenMediaModal('youtube')
        break
      case 'video':
        onOpenMediaModal('youtube')
        break
      case 'table':
        onOpenMediaModal('table')
        break
    }
    onClose()
  }

  // Keyboard navigation attached to window / container
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (flatCommands.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex(prev => (prev + 1) % flatCommands.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex(prev => (prev - 1 + flatCommands.length) % flatCommands.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        const selected = flatCommands[selectedIndex]
        if (selected) execute(selected)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [flatCommands, selectedIndex, editor, range])

  if (flatCommands.length === 0) {
    return (
      <div
        ref={menuRef}
        className={css.menu}
        style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
      >
        <div className={css.empty}>No matching commands</div>
      </div>
    )
  }

  let itemCounter = 0

  return (
    <div
      ref={menuRef}
      className={css.menu}
      style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
    >
      {groups.map(group => (
        <div key={group.group} className={css.group}>
          <div className={css.groupTitle}>{GROUP_TITLES[group.group] ?? group.group}</div>
          {group.matches.map(match => {
            const index = itemCounter++
            const isSelected = index === selectedIndex
            return (
              <button
                key={match.command.id}
                type="button"
                className={css.item}
                data-selected={isSelected || undefined}
                data-index={index}
                onClick={() => { execute(match.command) }}
                onMouseEnter={() => { setSelectedIndex(index) }}
              >
                <div className={css.iconWrap}>{ICONS[match.command.id]}</div>
                <div className={css.textWrap}>
                  <span className={css.title}>{match.command.title}</span>
                  <span className={css.hint}>{match.command.hint}</span>
                </div>
                {match.command.shortcut !== undefined && (
                  <span className={css.shortcut}>{match.command.shortcut}</span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
