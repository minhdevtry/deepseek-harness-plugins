/**
 * Line-range arithmetic for the mentions this plugin composes.
 *
 * Writing those mentions is not done here: see composer.ts, which goes through
 * the host's own `ctx.conversation.input` face. This file used to hold a DOM
 * writer that reached into the composer's textarea and faked `input` events;
 * it is gone.
 */

/**
 * Accurately calculate the line range (#Lstart-Lend) for selected text in a markdown document.
 */
export function getLineRangeForSelection(
  fullMarkdown: string,
  selectedText: string
): { startLine: number; endLine: number; rangeString: string } {
  const trimmed = selectedText.trim()
  if (!trimmed || !fullMarkdown) {
    return { startLine: 1, endLine: 1, rangeString: '' }
  }

  const lines = fullMarkdown.split('\n')
  const selLines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean)
  const firstSel = selLines[0] || trimmed
  const lastSel = selLines[selLines.length - 1] || trimmed

  let startLine = -1
  let endLine = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || ''
    if (startLine === -1 && line.includes(firstSel)) {
      startLine = i + 1
      if (selLines.length <= 1) {
        endLine = startLine
        break
      }
    } else if (startLine !== -1 && line.includes(lastSel)) {
      endLine = i + 1
      break
    }
  }

  if (startLine === -1) {
    const charIndex = fullMarkdown.indexOf(trimmed)
    if (charIndex !== -1) {
      const before = fullMarkdown.slice(0, charIndex)
      startLine = before.split('\n').length
      endLine = startLine + Math.max(0, selLines.length - 1)
    } else {
      startLine = 1
      endLine = 1
    }
  }

  if (endLine === -1 || endLine < startLine) {
    endLine = Math.min(lines.length, startLine + Math.max(0, selLines.length - 1))
  }

  const rangeString = startLine === endLine ? `#L${startLine}` : `#L${startLine}-L${endLine}`
  return { startLine, endLine, rangeString }
}
