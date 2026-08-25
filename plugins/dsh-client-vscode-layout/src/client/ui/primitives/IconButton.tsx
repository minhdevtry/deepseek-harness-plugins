import React, { forwardRef } from 'react'
import css from './IconButton.module.css'

export type IconButtonVariant = 'default' | 'ghost' | 'danger'
export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant
  size?: IconButtonSize
  active?: boolean
  children: React.ReactNode
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    variant = 'ghost',
    size = 'sm',
    active = false,
    disabled = false,
    children,
    className = '',
    ...props
  },
  ref
) {
  const classNames = [
    css.iconButton,
    css[variant],
    css[size],
    active ? css.active : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      ref={ref}
      className={classNames}
      disabled={disabled}
      data-active={active || undefined}
      {...props}
    >
      {children}
    </button>
  )
})
