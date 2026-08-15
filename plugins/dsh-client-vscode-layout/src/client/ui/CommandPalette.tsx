/**
 * Command Palette Modal (Ctrl+Shift+P / F1).
 *
 * Provides quick keyboard access to all IDE and editor actions.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import css from './CommandPalette.module.css'

export interface CommandItem {
  id: string
  title: string
  category: string
  shortcut?: string
  action: () => void
}

export interface CommandPaletteProps {
  open: boolean
  commands: CommandItem[]
  onClose: () => void
}

export function CommandPalette({ open, commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => { inputRef.current?.focus() }, 30)
    }
  }, [open])

  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length === 0) return commands

    return commands.filter(cmd =>
      cmd.title.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      (cmd.shortcut && cmd.shortcut.toLowerCase().includes(q))
    )
  }, [commands, query])

  const executeSelection = (cmd: CommandItem) => {
    onClose()
    cmd.action()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filteredCommands.length > 0) {
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filteredCommands.length > 0) {
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = filteredCommands[selectedIndex]
      if (selected) executeSelection(selected)
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
      <div className={`${css.palette} vk_command_palette`} data-vk-cmdpalette="true">
        <div className={css.inputWrap}>
          <input
            ref={inputRef}
            type="text"
            className={`${css.input} vk_command_palette_input`}
            placeholder="Type a command or action name..."
            value={query}
            onChange={e => { setQuery(e.target.value) }}
            onKeyDown={handleKeyDown}
          />
          <span className={css.hint}>ESC to close</span>
        </div>

        <div className={css.list}>
          {filteredCommands.length === 0 ? (
            <div className={css.empty}>No matching commands</div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex
              return (
                <button
                  key={cmd.id}
                  type="button"
                  className={css.item}
                  data-selected={isSelected || undefined}
                  onClick={() => { executeSelection(cmd) }}
                  onMouseEnter={() => { setSelectedIndex(idx) }}
                >
                  <span className={css.category}>{cmd.category}</span>
                  <span className={css.title}>{cmd.title}</span>
                  {cmd.shortcut && <span className={css.shortcut}>{cmd.shortcut}</span>}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
