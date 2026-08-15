/**
 * Pure tab-strip model: the ordered open list plus every way it changes.
 *
 * Kept apart from React because the interesting decisions here are not about
 * rendering. "Which tab becomes active when I close the active one" has a
 * right answer (VS Code picks the neighbour to the right, falling back to the
 * left), and "close to the right" has to agree with the *rendered* order after
 * a drag reorder, not the order the files were opened in. Both are checkable
 * as plain functions.
 *
 * Every operation returns a new array and never mutates its input, so a caller
 * can hand results straight to an immer draft or React state.
 */

/** The ordered open-tab list; entries are absolute, normalised paths. */
export type Tabs = readonly string[]

/**
 * Open a path, or reveal it if already open.
 * @returns the list unchanged when the path is already present — reopening a
 * file must not reorder the strip under the operator's cursor.
 */
export function open(tabs: Tabs, path: string): string[] {
  return tabs.includes(path) ? [...tabs] : [...tabs, path]
}

/** Close one tab. */
export function close(tabs: Tabs, path: string): string[] {
  return tabs.filter(tab => tab !== path)
}

/** Close everything except one tab. A path that is not open closes everything. */
export function closeOthers(tabs: Tabs, path: string): string[] {
  return tabs.filter(tab => tab === path)
}

/** Close every tab left of `path` in rendered order. */
export function closeToLeft(tabs: Tabs, path: string): string[] {
  const index = tabs.indexOf(path)
  return index < 0 ? [...tabs] : tabs.slice(index)
}

/** Close every tab right of `path` in rendered order. */
export function closeToRight(tabs: Tabs, path: string): string[] {
  const index = tabs.indexOf(path)
  return index < 0 ? [...tabs] : tabs.slice(0, index + 1)
}

/**
 * Move a tab to a new index — the drag-reorder operation.
 *
 * `to` is the destination index *in the list as it exists before the move*,
 * which is what a drop target reports. Out-of-range indices clamp rather than
 * throw: a drop past the last tab means "put it last".
 */
export function move(tabs: Tabs, from: number, to: number): string[] {
  const next = [...tabs]
  if (from < 0 || from >= next.length) return next
  const [moved] = next.splice(from, 1)
  if (moved === undefined) return next
  next.splice(Math.min(Math.max(to, 0), next.length), 0, moved)
  return next
}

/**
 * Which tab should be active after `closing` goes away.
 *
 * Closing a background tab leaves the active one alone. Closing the active tab
 * selects its right-hand neighbour, or the left-hand one when it was last —
 * the same rule VS Code uses, and the one that keeps a "close, close, close"
 * run moving in a single direction instead of jumping about.
 * @param tabs - the list *before* the close.
 * @param closing - the tab being closed.
 * @param active - the currently active tab.
 * @returns the next active path, or undefined when nothing is left.
 */
export function activeAfterClose(tabs: Tabs, closing: string, active: string | undefined): string | undefined {
  if (active !== closing) return tabs.includes(active ?? '') ? active : undefined
  const index = tabs.indexOf(closing)
  if (index < 0) return active
  return tabs[index + 1] ?? tabs[index - 1]
}

/**
 * Keep an active selection valid against a new list.
 *
 * Used after the bulk closes, where the survivor set is computed first and the
 * selection has to follow: an active tab that survived stays active, otherwise
 * the last remaining tab takes over.
 */
export function activeAfterBulk(remaining: Tabs, active: string | undefined): string | undefined {
  if (active !== undefined && remaining.includes(active)) return active
  return remaining[remaining.length - 1]
}
