/**
 * Viewport-aware popup positioning and clamping utilities.
 *
 * Prevents floating menus (context menus, slash command palette, bubble selection toolbars)
 * from rendering offscreen or overflowing past window edges.
 */

export interface PointPositionOptions {
  x: number
  y: number
  width: number
  height: number
  margin?: number
}

/**
 * Calculates clamped viewport coordinates for a point-anchored popup (e.g. context menu).
 * Flips leftward/upward when colliding with right/bottom viewport boundaries.
 */
export function clampPointPosition({
  x,
  y,
  width,
  height,
  margin = 8,
}: PointPositionOptions): { left: number; top: number } {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768

  const left = x + width + margin > viewportWidth
    ? Math.max(margin, x - width)
    : x
  const top = y + height + margin > viewportHeight
    ? Math.max(margin, y - height)
    : y

  return { left, top }
}

export interface CaretPositionOptions {
  top: number
  left: number
  bottom: number
  width: number
  height: number
  margin?: number
  gap?: number
}

/**
 * Calculates clamped viewport coordinates for a caret-anchored popup (e.g. slash command palette).
 * Positions below the caret by default and flips above when overflowing the viewport bottom.
 */
export function clampCaretPosition({
  top: caretTop,
  left: caretLeft,
  bottom: caretBottom,
  width,
  height,
  margin = 16,
  gap = 6,
}: CaretPositionOptions): { left: number; top: number } {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768

  let left = Math.min(caretLeft, viewportWidth - width - margin)
  if (left < margin) left = margin

  let top = caretBottom + gap
  if (top + height > viewportHeight - margin) {
    top = Math.max(margin, caretTop - height - gap)
  }

  return { left, top }
}

export interface BubblePositionOptions {
  startTop: number
  startLeft: number
  endLeft: number
  width: number
  height: number
  margin?: number
  gap?: number
}

/**
 * Calculates clamped viewport coordinates for a selection bubble toolbar.
 * Centered horizontally across the selection range and placed above the selection.
 */
export function clampBubblePosition({
  startTop,
  startLeft,
  endLeft,
  width,
  height,
  margin = 12,
  gap = 8,
}: BubblePositionOptions): { left: number; top: number } {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024

  const top = Math.max(margin, startTop - height - gap)
  let left = (startLeft + endLeft) / 2

  if (left - width / 2 < margin) {
    left = margin + width / 2
  } else if (left + width / 2 > viewportWidth - margin) {
    left = viewportWidth - margin - width / 2
  }

  return { left, top }
}
