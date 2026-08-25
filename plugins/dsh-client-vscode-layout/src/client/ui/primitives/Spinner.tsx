import React from 'react'
import css from './Spinner.module.css'

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg'

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: SpinnerSize | number
  className?: string
}

export function Spinner({ size = 'sm', className = '', ...props }: SpinnerProps) {
  const pixelSize =
    typeof size === 'number' ? size
    : size === 'xs' ? 12
    : size === 'sm' ? 16
    : size === 'md' ? 24
    : 32

  return (
    <svg
      className={`${css.spinner} ${className}`}
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle
        className={css.track}
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <circle
        className={css.head}
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="60"
        strokeDashoffset="45"
        strokeLinecap="round"
      />
    </svg>
  )
}
