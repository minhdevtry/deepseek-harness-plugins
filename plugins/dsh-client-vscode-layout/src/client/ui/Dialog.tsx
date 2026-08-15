/**
 * In-app modal dialog — the replacement for `window.confirm`, which blocks the
 * event loop, cannot be styled, and reads as a browser warning rather than
 * part of the workbench.
 *
 * Takes an *ordered list* of actions rather than a fixed confirm/cancel pair,
 * because the workbench's real question has three answers: closing a dirty tab
 * offers Save, Don't Save, and Cancel. Collapsing that into two would force the
 * operator to guess which one discards their work.
 *
 * Fixed-positioned so it escapes any column's clipping. Focus moves to the
 * default action on mount and Escape runs the cancelling action, so the
 * keyboard path is complete without a focus-trap library.
 */
import { useEffect, useRef } from 'react'
import css from './Dialog.module.css'

/** One dialog button. */
export interface DialogAction {
  label: string
  /** Painted as the primary affordance and focused on mount. */
  primary?: boolean
  /** Painted destructively. */
  danger?: boolean
  /**
   * Marks the way out. Escape and a backdrop click run this action, and it is
   * the only one that stays enabled while another is in flight.
   */
  cancel?: boolean
  onSelect: () => void
}

/** Dialog props: the question, the answers, and the in-flight state. */
export interface DialogProps {
  title: string
  /** The consequence, spelled out — the operator should not have to infer it. */
  message: string
  actions: DialogAction[]
  /** True while an action is in flight; non-cancel actions disable. */
  busy?: boolean
  /** Failure text from the last attempt, shown inline so the dialog stays open. */
  error?: string | undefined
}

/** A modal dialog (see module doc). */
export function Dialog({ title, message, actions, busy, error }: DialogProps) {
  const primaryRef = useRef<HTMLButtonElement | null>(null)
  // Latest-value ref: the Escape listener is installed once, but must always
  // run the current cancel action.
  const escape = useRef<(() => void) | undefined>(undefined)
  escape.current = busy === true ? undefined : actions.find(action => action.cancel === true)?.onSelect

  useEffect(() => { primaryRef.current?.focus() }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Stop here: the workbench also listens for Escape, and dismissing the
      // dialog should not additionally close a palette behind it.
      event.stopPropagation()
      escape.current?.()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => { document.removeEventListener('keydown', onKeyDown, true) }
  }, [])

  return (
    <div className={css.backdrop} onPointerDown={() => { escape.current?.() }}>
      {/* The card swallows pointer-downs so a click inside never reaches the
          backdrop's dismiss handler. */}
      <div
        className={css.card}
        role="alertdialog"
        aria-modal
        aria-label={title}
        onPointerDown={(event) => { event.stopPropagation() }}
      >
        <h2 className={css.title}>{title}</h2>
        <p className={css.message}>{message}</p>
        {error !== undefined && <p className={css.error}>{error}</p>}
        <div className={css.actions}>
          {actions.map(action => (
            <button
              key={action.label}
              ref={action.primary === true ? primaryRef : undefined}
              type="button"
              className={action.primary === true ? css.primary : css.secondary}
              data-danger={action.danger === true || undefined}
              // The way out stays available even mid-flight, or a hung save
              // would trap the operator in the dialog.
              disabled={busy === true && action.cancel !== true}
              onClick={action.onSelect}
            >
              {busy === true && action.primary === true ? 'Working…' : action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
