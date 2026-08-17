/**
 * Pure concession-chain column solver for the VS Code three-column frame.
 *
 * Layout roles differ from the stock shell: left is the workbench explorer,
 * center is the multi-tab editor, right is the AI chat / trajectory column.
 * The chain order is fixed by contract — keep center >= CENTER_MIN by first
 * shrinking the right column, then auto-closing it (a derived zero width;
 * width *preferences* are never rewritten, so widening the window restores
 * them), then conceding the sidebar, and finally letting center absorb the
 * remaining deficit.
 *
 * Inputs are the layout store's plain width preferences (0 = closed). Unlike
 * the stock frame there is no collapsed icon rail: a closed sidebar resolves
 * to zero width and the editor takes the space. The solver itself is
 * breakpoint-free — AppFrame decides the effective sidebar preference before
 * solving.
 */

/** Resolved widths for one frame; center may drop below CENTER_MIN only at the final fallback. */
export interface Columns {
  sidebar: number
  center: number
  right: number
}

// Contract-frozen geometry: the three-column concession chain's fixed points.
/** Editor column floor; only the final fallback may go below it. */
export const CENTER_MIN = 300
/** Sidebar drag clamp floor. */
export const SIDEBAR_MIN = 100
/** Sidebar drag clamp ceiling. */
export const SIDEBAR_MAX = 500
/** Sidebar width before any user drag. */
export const SIDEBAR_DEFAULT = 280
/** Viewport width below which the sidebar auto-collapses; a manual toggle below it re-expands over the squeezed center. */
export const SIDEBAR_AUTO_COLLAPSE = 1024
/** Right (chat) column drag clamp floor. */
export const RIGHT_MIN = 280
/** Right column width before any user drag. */
export const RIGHT_DEFAULT = 440
/** Absolute floor for the right column's dynamic ceiling on narrow viewports. */
export const RIGHT_MAX_FLOOR = 480
/** Fraction of the viewport the right column may occupy — wide enough to use the chat as a full canvas. */
export const RIGHT_MAX_RATIO = 0.82

/**
 * Clamp a panel width into its contract range.
 * @param px - requested width.
 * @param min - range lower bound.
 * @param max - range upper bound.
 * @returns the clamped width, rounded to whole pixels.
 */
export function clampWidth(px: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(px)))
}

/**
 * The right column's ceiling for a given viewport. Ratio-based so the chat can
 * expand into a near-full-width canvas on wide screens, with an absolute floor
 * so narrow viewports still allow a usable panel.
 * @param viewport - frame width in px.
 * @returns the maximum right-column width in px.
 */
export function rightMax(viewport: number): number {
  return Math.max(RIGHT_MAX_FLOOR, Math.floor(viewport * RIGHT_MAX_RATIO))
}

/**
 * Solve the three column widths for one frame.
 * @param viewport - total frame width in px.
 * @param sidebar - sidebar width preference (0 = closed).
 * @param right - right column width preference (0 = closed).
 * @returns the resolved widths; they always sum to `viewport`.
 */
export function computeColumns(viewport: number, sidebar: number, right: number): Columns {
  const s = sidebar === 0 ? 0 : clampWidth(sidebar, SIDEBAR_MIN, SIDEBAR_MAX)
  const r = right === 0 ? 0 : clampWidth(right, RIGHT_MIN, rightMax(viewport))

  // 1. Everything fits at the preferred widths.
  if (s + r + CENTER_MIN <= viewport) return { sidebar: s, center: viewport - s - r, right: r }

  // 2. Shrink the right column down to its floor to protect the editor.
  const shrunkRight = r === 0 ? 0 : Math.max(RIGHT_MIN, viewport - s - CENTER_MIN)
  if (s + shrunkRight + CENTER_MIN <= viewport) {
    return { sidebar: s, center: viewport - s - shrunkRight, right: shrunkRight }
  }

  // 3. Auto-close the right column (derived, not a preference rewrite).
  if (s + CENTER_MIN <= viewport) return { sidebar: s, center: viewport - s, right: 0 }

  // 4. Last resort: the sidebar concedes and center absorbs the deficit.
  return { sidebar: 0, center: viewport, right: 0 }
}
