/**
 * Platform detection and keyboard shortcut formatting utilities.
 */

export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/**
 * Formats a modifier key combination for display.
 * @param key The primary key character (e.g. 'k', 'f', 'z', 'p')
 * @param options Additional modifiers
 * @returns Standardized shortcut label e.g. "⌘K" on Mac or "Ctrl+K" on Windows/Linux
 */
export function formatModShortcut(
  key: string,
  options?: { shift?: boolean; alt?: boolean },
): string {
  const upper = key.toUpperCase()
  const hasShift = options?.shift ?? false
  const hasAlt = options?.alt ?? false

  if (isMac) {
    let result = ''
    if (hasAlt) result += '⌥'
    if (hasShift) result += '⇧'
    result += `⌘${upper}`
    return result
  }

  const parts: string[] = ['Ctrl']
  if (hasAlt) parts.push('Alt')
  if (hasShift) parts.push('Shift')
  parts.push(upper)
  return parts.join('+')
}

/**
 * Standard Redo shortcut string for the current platform.
 * ProseMirror uses Mod-y on Windows/Linux and Mod-Shift-z on macOS.
 */
export function formatRedoShortcut(): string {
  return isMac ? '⇧⌘Z' : 'Ctrl+Y'
}
