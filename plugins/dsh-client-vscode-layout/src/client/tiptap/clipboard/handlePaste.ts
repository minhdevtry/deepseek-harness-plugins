import type { Editor } from '@tiptap/core'
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { detectLoneTrustedUrl } from './loneUrl.ts'

export const clipboardPluginKey = new PluginKey('dsh_clipboard_router')

const LANG_IDENT = /^[A-Za-z0-9_+-]+$/

/**
 * Checks if the selection or cursor is currently inside a codeBlock node.
 */
export function isCursorInCodeBlock(view: EditorView): boolean {
  const { $from } = view.state.selection
  for (let depth = $from.depth; depth >= 0; depth--) {
    if ($from.node(depth).type.name === 'codeBlock') return true
  }
  return false
}

/**
 * Wraps a non-empty text selection into a link mark without replacing the text.
 */
export function linkifySelection(view: EditorView, href: string): boolean {
  try {
    const { state } = view
    const selection = state.selection
    if (!(selection instanceof TextSelection) || selection.empty) return false
    if (!selection.$from.sameParent(selection.$to)) return false

    const linkType = state.schema.marks.link
    if (!linkType) return false

    // Skip if selection is inside an inline code span
    const codeType = state.schema.marks.code
    if (codeType && state.doc.rangeHasMark(selection.from, selection.to, codeType)) {
      return false
    }

    view.dispatch(
      state.tr.addMark(selection.from, selection.to, linkType.create({ href })),
    )
    return true
  } catch {
    return false
  }
}

/**
 * Branch A: Parses VS Code editor clipboard metadata and creates a formatted code block.
 */
export function insertVsCodeCodeBlock(
  view: EditorView,
  vscodeData: string,
  text: string,
): boolean {
  try {
    const meta = JSON.parse(vscodeData) as { mode?: string }
    const rawLang = typeof meta.mode === 'string' ? meta.mode : ''
    const lang = LANG_IDENT.test(rawLang) ? rawLang : ''
    const codeBlockType = view.state.schema.nodes.codeBlock
    if (!codeBlockType) return false

    const codeNode = codeBlockType.create(
      { language: lang },
      text ? view.state.schema.text(text) : null,
    )

    view.dispatch(
      view.state.tr.replaceSelectionWith(codeNode).scrollIntoView(),
    )
    return true
  } catch {
    return false
  }
}

/**
 * Heuristic to detect if plain text is shaped like markdown prose or structure.
 */
export function isMarkdownShaped(text: string): boolean {
  const lines = text.split('\n')
  return lines.some((line) => {
    const trimmed = line.trim()
    return (
      /^#{1,6}\s+/.test(trimmed) ||
      /^[-*+]\s+\[[ xX]\]\s+/.test(trimmed) ||
      /^[-*+]\s+/.test(trimmed) ||
      /^\d+\.\s+/.test(trimmed) ||
      /^>\s+/.test(trimmed) ||
      /^```/.test(trimmed) ||
      /^\|.+\|$/.test(trimmed) ||
      /^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)
    )
  })
}

/**
 * List-aware sibling splice: avoids breaking or orphan nesting when pasting list items inside a list item.
 */
export function tryListSiblingSplice(
  view: EditorView,
  pastedDoc: ProseMirrorNode,
): boolean {
  const { state } = view
  const { selection } = state
  if (!selection.empty) return false

  const pastedItems: ProseMirrorNode[] = []
  let allLists = pastedDoc.content.childCount > 0
  pastedDoc.content.forEach((child) => {
    if (child.type.name !== 'bulletList' && child.type.name !== 'orderedList' && child.type.name !== 'taskList') {
      allLists = false
      return
    }
    child.forEach((item) => {
      if (item.type.name === 'listItem' || item.type.name === 'taskItem') {
        pastedItems.push(item)
      }
    })
  })

  if (!allLists || pastedItems.length === 0) return false

  const { $from } = selection
  let itemDepth = -1
  for (let depth = $from.depth; depth > 0; depth--) {
    const name = $from.node(depth).type.name
    if (name === 'listItem' || name === 'taskItem') {
      itemDepth = depth
      break
    }
  }
  if (itemDepth < 0) return false

  const targetItem = $from.node(itemDepth)
  const itemStart = $from.before(itemDepth)
  const itemEnd = $from.after(itemDepth)
  const caretOffset = $from.pos - $from.start(itemDepth)

  const beforeItem = targetItem.cut(0, caretOffset)
  const afterItem = targetItem.cut(caretOffset)

  const replacement: ProseMirrorNode[] = []
  if (beforeItem.textContent.length > 0) replacement.push(beforeItem)
  replacement.push(...pastedItems)
  if (afterItem.textContent.length > 0) replacement.push(afterItem)

  const tr = state.tr.replaceWith(itemStart, itemEnd, Fragment.fromArray(replacement))
  view.dispatch(tr.scrollIntoView())
  return true
}

/**
 * Creates the 5-branch clipboard router ProseMirror plugin.
 */
export function createClipboardPastePlugin(editor: Editor): Plugin {
  return new Plugin({
    key: clipboardPluginKey,
    props: {
      handlePaste(view: EditorView, event: ClipboardEvent): boolean {
        const dt = event.clipboardData
        if (!dt || dt.types.length === 0) return false

        const plain = dt.getData('text/plain')
        const html = dt.getData('text/html')

        // Priority 1: Shift held or cursor inside codeBlock -> plain text verbatim
        if (isCursorInCodeBlock(view)) {
          if (plain) {
            view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.text(plain)).scrollIntoView())
            return true
          }
        }

        // Priority 2: Standalone URL over non-empty text selection -> linkify selection
        if (plain && !view.state.selection.empty) {
          const href = detectLoneTrustedUrl(plain)
          if (href && linkifySelection(view, href)) {
            return true
          }
        }

        // Branch A: VS Code editor data
        const vscodeData = dt.getData('vscode-editor-data')
        if (vscodeData && plain && insertVsCodeCodeBlock(view, vscodeData, plain)) {
          return true
        }

        // Branch B: text/x-gfm or markdown-shaped plain text
        const gfm = dt.getData('text/x-gfm')
        if (gfm) {
          editor.commands.insertContent(gfm)
          return true
        }
        if (plain && html && isMarkdownShaped(plain)) {
          editor.commands.insertContent(plain)
          return true
        }

        // Branch C: ProseMirror internal slice -> defer to PM native handler
        if (html && /data-pm-slice/i.test(html)) {
          return false
        }

        // Branch D: generic HTML with markdown fallback
        if (html) {
          // Let ProseMirror parse HTML with standard sanitize or markdown
          return false
        }

        // Branch E: plain text
        if (plain && isMarkdownShaped(plain)) {
          editor.commands.insertContent(plain)
          return true
        }

        return false
      },
    },
  })
}
