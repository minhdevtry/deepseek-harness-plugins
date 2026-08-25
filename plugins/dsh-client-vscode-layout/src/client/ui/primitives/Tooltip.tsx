import React, { useState, useRef, useEffect, isValidElement } from 'react'
import css from './Tooltip.module.css'

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipProps {
  content: React.ReactNode
  shortcut?: string | undefined
  placement?: TooltipPlacement
  delayDuration?: number
  disabled?: boolean
  children: React.ReactElement
}

export function Tooltip({
  content,
  shortcut,
  placement = 'top',
  delayDuration = 150,
  disabled = false,
  children,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handleMouseEnter = () => {
    if (disabled || !content) return
    clearTimer()
    timerRef.current = setTimeout(() => {
      setOpen(true)
    }, delayDuration)
  }

  const handleMouseLeave = () => {
    clearTimer()
    setOpen(false)
  }

  const handleClick = () => {
    clearTimer()
    setOpen(false)
  }

  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [])

  if (!isValidElement(children)) {
    return children
  }

  return (
    <div
      className={css.wrapper}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}
      {open && !disabled && content && (
        <div
          role="tooltip"
          className={`${css.tooltip} ${css[placement]}`}
          aria-hidden="true"
        >
          <span className={css.content}>{content}</span>
          {shortcut && <span className={css.shortcut}>{shortcut}</span>}
        </div>
      )}
    </div>
  )
}
