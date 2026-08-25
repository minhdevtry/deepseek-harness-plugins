/**
 * Anchored context menu.
 *
 * Positioned `fixed` so it escapes the sidebar column's `overflow: hidden`
 * without the frame having to host it, and flipped back inside the viewport
 * when the anchor sits near an edge. Dismisses on outside pointer-down,
 * Escape, scroll, and window resize — every way the anchor can go stale.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import css from './ContextMenu.module.css'

/** One menu row; a separator carries no label. */
export type MenuItem =
  | { kind: 'separator' }
  | {
    kind: 'item'
    label: string
    /** Right-aligned shortcut hint, e.g. `F2`. */
    hint?: string
    /** Renders in the destructive colour. */
    danger?: boolean
    onSelect: () => void
  }

/** Context menu props: where to anchor, what to show, how to close. */
export interface ContextMenuProps {
  /** Viewport coordinates of the originating pointer event. */
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

import { clampPointPosition } from '../utils/positioning.ts'

/** An anchored context menu (see module doc). */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  // Measure after mount, then flip: the menu's size depends on its items, so
  // the corrected position cannot be computed before it has rendered once.
  useLayoutEffect(() => {
    const el = ref.current
    if (el === null) return
    const { width, height } = el.getBoundingClientRect()
    setPosition(clampPointPosition({ x, y, width, height, margin: 8 }))
  }, [x, y])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      // A pointer-down inside the menu is a selection, not a dismissal.
      if (ref.current?.contains(event.target as Node) === true) return
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose() }
    }
    // Capture phase: a scroll container between the anchor and the document
    // would not bubble its scroll event to the window.
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  return (
    <div ref={ref} className={css.menu} style={position} role="menu">
      {items.map((item, index) => (
        item.kind === 'separator'
          // Index keys are stable here: the item list is rebuilt per open and
          // never reordered while mounted.
          ? <div key={`sep-${index}`} className={css.separator} role="separator" />
          : (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={css.item}
              data-danger={item.danger === true || undefined}
              onClick={() => { onClose(); item.onSelect() }}
            >
              <span className={css.label}>{item.label}</span>
              {item.hint !== undefined && <span className={css.hint}>{item.hint}</span>}
            </button>
          )
      ))}
    </div>
  )
}
