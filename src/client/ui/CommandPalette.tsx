/**
 * Keyboard-driven command launcher.
 *
 * Actions dismiss the modal *before* invoking their callbacks so focus returns
 * to the underlying surface rather than trapping key events inside an unmounted
 * input. Delayed focus on mount ensures the browser finishes transitioning the
 * backdrop before assigning caret focus.
 */
import { useEffect, useMemo, useState } from 'react'
import { usePickerNavigation } from '../utils/usePickerNavigation.ts'
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

  useEffect(() => {
    if (open) {
      setQuery('')
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

  const { selectedIndex, setSelectedIndex, inputRef, handleKeyDown } = usePickerNavigation({
    open,
    itemCount: filteredCommands.length,
    onSelect: idx => {
      const selected = filteredCommands[idx]
      if (selected) executeSelection(selected)
    },
    onClose,
  })

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query, setSelectedIndex])

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
