/**
 * Toast Notification System.
 *
 * Provides non-intrusive, transient feedback messages for operations like
 * file saves, copy path, git actions, and errors.
 */
import { useEffect } from 'react'
import css from './Toast.module.css'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
}

export interface ToastProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

const ICONS: Record<ToastType, string> = {
  info: 'ℹ️',
  success: '✓',
  warning: '⚠️',
  error: '✕',
}

export function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null

  return (
    <div className={css.container} role="status" aria-live="polite">
      {toasts.map(toast => (
        <ToastRow key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastRow({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id)
    }, 3200)
    return () => { clearTimeout(timer) }
  }, [toast.id, onDismiss])

  const typeClass =
    toast.type === 'success'
      ? css.toastSuccess
      : toast.type === 'warning'
        ? css.toastWarning
        : toast.type === 'error'
          ? css.toastError
          : ''

  return (
    <div className={`${css.toast} ${typeClass}`}>
      <span className={css.icon}>{ICONS[toast.type]}</span>
      <span className={css.message}>{toast.message}</span>
      <button
        type="button"
        className={css.closeBtn}
        onClick={() => { onDismiss(toast.id) }}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  )
}
