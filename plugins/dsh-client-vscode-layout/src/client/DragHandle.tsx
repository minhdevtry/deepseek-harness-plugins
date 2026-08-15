/**
 * One column drag handle: pointer capture plus rAF-throttled dx reports
 * against the drag-start origin. Reporting a *delta* (never an absolute x) is
 * what lets the frame freeze a drag base at gesture start, so grabbing a
 * concession-clamped column does not jump back to its stored preference.
 */
import { useCallback, useRef, useState } from 'react'
import css from './AppFrame.module.css'

/** Which column edge this handle drags; keys the hover-reveal CSS. */
export type HandleSide = 'sidebar' | 'right'

/** Drag handle props: placement plus the gesture lifecycle. */
export interface DragHandleProps {
  side: HandleSide
  /** Absolute x offset of the handle within the frame, in px. */
  left: number
  onStart: () => void
  /** Pointer travel since drag start, in px. */
  onDrag: (dx: number) => void
  onEnd: () => void
}

/** A draggable column edge (see module doc). */
export function DragHandle({ side, left, onStart, onDrag, onEnd }: DragHandleProps) {
  const [dragging, setDragging] = useState(false)
  const origin = useRef(0)
  const latest = useRef(0)
  const frame = useRef<number | null>(null)
  // Latest-callback ref: the pointer handlers stay identity-stable for the
  // whole gesture while still calling the current props.
  const callbacks = useRef({ onStart, onDrag, onEnd })
  callbacks.current = { onStart, onDrag, onEnd }

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    origin.current = e.clientX
    latest.current = e.clientX
    callbacks.current.onStart()
    setDragging(true)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    latest.current = e.clientX
    frame.current ??= requestAnimationFrame(() => {
      frame.current = null
      callbacks.current.onDrag(latest.current - origin.current)
    })
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    // Drop the pending frame and settle on the final position, or the column
    // would rest one rAF behind the pointer.
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null }
    callbacks.current.onDrag(latest.current - origin.current)
    setDragging(false)
    callbacks.current.onEnd()
  }, [])

  return (
    <div
      className={css.handle}
      style={{ left }}
      data-side={side}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  )
}
