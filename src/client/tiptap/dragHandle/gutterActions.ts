import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'

/**
 * Executes adding a new paragraph below the specified node, focuses into it,
 * and immediately triggers the slash command menu by inserting '/'.
 * Conforms to Notion & OpenKnowledge gutter UX affordances.
 */
export function executeAddBlockBelow(
  editor: Editor,
  hoveredNodePos: number,
  hoveredNode: ProseMirrorNode,
): void {
  const { state, view } = editor
  const insertPos = hoveredNodePos + hoveredNode.nodeSize
  if (insertPos > state.doc.content.size) return

  const paragraph = state.schema.nodes.paragraph?.create()
  if (!paragraph) return

  const tr = state.tr.insert(insertPos, paragraph)
  const sel = TextSelection.near(tr.doc.resolve(insertPos + 1))
  tr.setSelection(sel).scrollIntoView()
  view.dispatch(tr)
  view.focus()

  // Pop slash command menu immediately
  editor.commands.insertContent('/')
}
