import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const calloutPluginKey = new PluginKey('callout_decorations')

const CALLOUT_TITLES: Record<string, string> = {
  note: 'NOTE',
  info: 'NOTE',
  tip: 'TIP',
  warning: 'WARNING',
  caution: 'CAUTION',
  danger: 'CAUTION',
  important: 'IMPORTANT',
  success: 'SUCCESS',
}

export const CalloutDecorations = Extension.create({
  name: 'calloutDecorations',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: calloutPluginKey,
        props: {
          handleKeyDown(view, event) {
            if (event.key === 'Backspace') {
              const { state } = view
              const { selection } = state
              if (selection.empty) {
                const { from } = selection
                const $pos = state.doc.resolve(from)
                if ($pos.parent.type.name === 'paragraph') {
                  const pText = $pos.parent.textContent || ''
                  const match = pText.match(/^\\?\[!(NOTE|INFO|TIP|WARNING|CAUTION|DANGER|SUCCESS|IMPORTANT)\\?\]/i)
                  if (match) {
                    const tagLen = match[0].length
                    const tagEndPos = $pos.start() + tagLen
                    if (from === tagEndPos || from === tagEndPos + 1) {
                      event.preventDefault()
                      const deleteEnd = from === tagEndPos + 1 ? tagEndPos + 1 : tagEndPos
                      const tr = state.tr.delete($pos.start(), deleteEnd)
                      view.dispatch(tr)
                      return true
                    }
                  }
                }
              }
            }
            return false
          },
          decorations(state) {
            const decos: Decoration[] = []

            state.doc.descendants((node, pos) => {
              if (node.type.name === 'blockquote') {
                const firstChild = node.firstChild
                if (firstChild && firstChild.type.name === 'paragraph') {
                  const text = firstChild.textContent || ''
                  const match = text.match(/^\\?\[!(NOTE|INFO|TIP|WARNING|CAUTION|DANGER|SUCCESS|IMPORTANT)\\?\]/i)
                  if (match && match[1]) {
                    const rawType = match[1].toLowerCase()
                    const type = rawType === 'info' ? 'note' : rawType === 'danger' ? 'caution' : rawType
                    const title = CALLOUT_TITLES[rawType] || rawType.toUpperCase()

                    decos.push(
                      Decoration.node(pos, pos + node.nodeSize, {
                        class: `callout callout-${type}`,
                      }),
                    )

                    const tagLen = match[0].length
                    decos.push(
                      Decoration.inline(pos + 2, pos + 2 + tagLen, {
                        class: `callout-badge-tag callout-badge-tag-${type}`,
                        'data-title': title,
                      }),
                    )
                  }
                }
              }
            })

            return DecorationSet.create(state.doc, decos)
          },
        },
      }),
    ]
  },
})
