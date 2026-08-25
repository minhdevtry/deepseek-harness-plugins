import React, { forwardRef } from 'react'
import css from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
  loading?: boolean
  children?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'sm',
    icon,
    loading = false,
    disabled = false,
    children,
    className = '',
    ...props
  },
  ref
) {
  const classNames = [
    css.button,
    css[variant],
    css[size],
    loading ? css.loading : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      ref={ref}
      className={classNames}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className={css.spinner} aria-hidden="true" />
      ) : icon ? (
        <span className={css.icon}>{icon}</span>
      ) : null}
      {children && <span className={css.content}>{children}</span>}
    </button>
  )
})
