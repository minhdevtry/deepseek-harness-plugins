import React from 'react'
import css from './Skeleton.module.css'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number
  height?: string | number
  rounded?: 'xs' | 'sm' | 'md' | 'lg' | 'full'
  className?: string
}

export function Skeleton({
  width,
  height,
  rounded = 'md',
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const customStyle: React.CSSProperties = {
    ...style,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  }

  return (
    <div
      className={`${css.skeleton} ${css[rounded]} ${className}`}
      style={customStyle}
      aria-hidden="true"
      {...props}
    />
  )
}
