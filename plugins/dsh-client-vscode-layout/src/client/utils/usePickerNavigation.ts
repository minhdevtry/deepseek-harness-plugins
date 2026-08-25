/**
 * Shared modal-picker keyboard navigation and auto-focus hook.
 *
 * Encapsulates input auto-focus on open, selectedIndex resetting,
 * wraparound arrow-key cycling (ArrowUp/ArrowDown), Enter execution,
 * and Escape dismissal across CommandPalette, QuickOpen, and SlashMenu.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'

export interface UsePickerNavigationOptions {
  open?: boolean
  itemCount: number
  onSelect?: (index: number) => void
  onClose?: () => void
  autoFocusDelay?: number
}

export interface UsePickerNavigationReturn {
  selectedIndex: number
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>
  inputRef: RefObject<HTMLInputElement>
  handleKeyDown: (e: React.KeyboardEvent | KeyboardEvent) => void
}

export function usePickerNavigation({
  open = true,
  itemCount,
  onSelect,
  onClose,
  autoFocusDelay = 30,
}: UsePickerNavigationOptions): UsePickerNavigationReturn {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setSelectedIndex(0)
      if (autoFocusDelay >= 0) {
        const timer = setTimeout(() => { inputRef.current?.focus() }, autoFocusDelay)
        return () => { clearTimeout(timer) }
      }
    }
  }, [open, autoFocusDelay])

  const handleKeyDown = (e: React.KeyboardEvent | KeyboardEvent) => {
    if (itemCount === 0 && e.key !== 'Escape') return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (e.stopPropagation) e.stopPropagation()
      if (itemCount > 0) {
        setSelectedIndex(prev => (prev + 1) % itemCount)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (e.stopPropagation) e.stopPropagation()
      if (itemCount > 0) {
        setSelectedIndex(prev => (prev - 1 + itemCount) % itemCount)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (e.stopPropagation) e.stopPropagation()
      if (itemCount > 0 && onSelect) {
        onSelect(selectedIndex)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (e.stopPropagation) e.stopPropagation()
      onClose?.()
    }
  }

  return {
    selectedIndex,
    setSelectedIndex,
    inputRef,
    handleKeyDown,
  }
}
