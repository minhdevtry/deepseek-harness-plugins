/**
 * Utility to insert a mention (@file #L123) into the DeepSeek Harness Chat Composer.
 * Strictly scoped to the Chat column and explicitly forbidden from touching the editor.
 */
export function insertMentionIntoChat(mention: string): boolean {
  const tryInsert = () => {
    // 1. Strictly locate the Chat Panel in the Right Column
    const chatPanel = document.querySelector('[data-dsh-chat-panel="true"]')
    if (!chatPanel) return false

    // 2. Query only inside the Chat Panel
    const selectors = [
      'textarea',
      'div[contenteditable="true"]',
      '[role="textbox"]',
      'input[type="text"]',
    ]

    const elements = chatPanel.querySelectorAll<HTMLTextAreaElement | HTMLInputElement | HTMLDivElement>(
      selectors.join(', ')
    )

    let target: HTMLTextAreaElement | HTMLInputElement | HTMLDivElement | null = null
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]
      if (el && el.offsetParent !== null) {
        target = el
        break
      }
    }

    if (!target) return false

    // 3. Absolute safety check: Never touch TipTap or CodeMirror editors
    if (
      !chatPanel.contains(target) ||
      target.closest('.ProseMirror') ||
      target.closest('.cm-editor') ||
      target.closest('[data-shell-workbench]')
    ) {
      return false
    }

    target.focus()

    const formatted = mention.endsWith(' ') ? mention : `${mention} `

    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      const currentVal = target.value || ''
      const start = target.selectionStart ?? currentVal.length
      const end = target.selectionEnd ?? currentVal.length
      const newVal = currentVal.slice(0, start) + formatted + currentVal.slice(end)

      const proto = target instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype

      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
      if (setter) {
        setter.call(target, newVal)
      } else {
        target.value = newVal
      }

      target.dispatchEvent(new Event('input', { bubbles: true }))
      target.dispatchEvent(new Event('change', { bubbles: true }))

      const newPos = start + formatted.length
      target.setSelectionRange(newPos, newPos)
      return true
    } else if (target.isContentEditable) {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0 && target.contains(selection.anchorNode)) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        const textNode = document.createTextNode(formatted)
        range.insertNode(textNode)
        range.setStartAfter(textNode)
        range.setEndAfter(textNode)
        selection.removeAllRanges()
        selection.addRange(range)
      } else {
        target.textContent = (target.textContent || '') + formatted
      }
      target.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }

    return false
  }

  // Attempt immediately and retry with delays to accommodate panel opening transitions
  if (!tryInsert()) {
    setTimeout(tryInsert, 40)
    setTimeout(tryInsert, 120)
    setTimeout(tryInsert, 250)
  }

  return true
}

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
