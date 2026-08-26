import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

export const headingFoldPluginKey = new PluginKey<HeadingFoldState>('heading_fold_decorations')

type HeadingFoldState = { collapsed: Set<number> }

const CHEVRON_RIGHT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`
const CHEVRON_DOWN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`
const STOP_EVENT = () => true

export function toggleHeadingFold(view: EditorView, headingPos: number): void {
  view.dispatch(view.state.tr.setMeta(headingFoldPluginKey, { toggled: headingPos }))
}

/**
 * Where a heading's folded section ends: the next heading at the same or a
 * shallower level, or the end of the document — but never past the last
 * block, so there is always somewhere to click and keep writing.
 */
export function foldRangeFor(
  doc: ProseMirrorNode,
  headingPos: number,
): { start: number; end: number } | null {
  const headingNode = doc.nodeAt(headingPos)
  if (!headingNode || headingNode.type.name !== 'heading') return null
  const currentLevel = (headingNode.attrs.level as number) || 1
  const foldStart = headingPos + headingNode.nodeSize

  let foldEnd = doc.content.size
  let found = false
  doc.forEach((node, offset) => {
    if (offset > headingPos) {
      if (!found && node.type.name === 'heading') {
        const level = (node.attrs.level as number) || 1
        if (level <= currentLevel) {
          foldEnd = offset
          found = true
        }
      }
    }
  })

  // Never hide the last block if it is a paragraph, so there's always space to write
  const lastChild = doc.lastChild
  const lastStart = lastChild ? doc.content.size - lastChild.nodeSize : doc.content.size
  if (foldEnd >= doc.content.size && lastChild?.type.name === 'paragraph') {
    foldEnd = lastStart
  }

  if (foldEnd <= foldStart) return null
  return { start: foldStart, end: foldEnd }
}

export const HeadingFoldExtension = Extension.create({
  name: 'headingFold',

  addProseMirrorPlugins() {
    return [
      new Plugin<HeadingFoldState>({
        key: headingFoldPluginKey,
        state: {
          init: () => ({ collapsed: new Set<number>() }),
          apply(tr, value) {
            let collapsed = value.collapsed
            if (tr.docChanged) {
              const mapped = new Set<number>()
              for (const pos of collapsed) {
                const result = tr.mapping.mapResult(pos)
                // If heading was deleted, don't keep orphan fold position
                if (result.deleted) continue
                const node = tr.doc.nodeAt(result.pos)
                if (node?.type.name !== 'heading') continue
                mapped.add(result.pos)
              }
              const changed =
                mapped.size !== collapsed.size || [...mapped].some((p) => !collapsed.has(p))
              collapsed = changed ? mapped : collapsed
            }
            const meta = tr.getMeta(headingFoldPluginKey) as { toggled?: number } | undefined
            if (meta?.toggled === undefined) {
              return collapsed === value.collapsed ? value : { collapsed }
            }
            collapsed = new Set(collapsed)
            if (collapsed.has(meta.toggled)) collapsed.delete(meta.toggled)
            else collapsed.add(meta.toggled)
            return { collapsed }
          },
        },
        appendTransaction(transactions, _oldState, newState) {
          const value = headingFoldPluginKey.getState(newState)
          if (!value || value.collapsed.size === 0) return null
          if (!transactions.some((tr) => tr.selectionSet || tr.docChanged)) return null

          const { from } = newState.selection
          for (const headingPos of value.collapsed) {
            const node = newState.doc.nodeAt(headingPos)
            if (!node || node.type.name !== 'heading') continue
            const range = foldRangeFor(newState.doc, headingPos)
            if (range && from > range.start && from < range.end) {
              // The caret landed inside content this fold is hiding. Unfold rather
              // than leave the operator typing into an invisible node.
              return newState.tr.setMeta(headingFoldPluginKey, { toggled: headingPos })
            }
          }
          return null
        },
        props: {
          handleClick(view, _pos, event) {
            const target = (event.target as HTMLElement).closest(
              '[data-heading-fold-btn="true"], [data-heading-indicator="true"]',
            )
            if (!target) return false

            const posAttr = target.getAttribute('data-pos')
            if (posAttr) {
              const headingPos = parseInt(posAttr, 10)
              if (!isNaN(headingPos)) {
                toggleHeadingFold(view, headingPos)
                event.preventDefault()
                event.stopPropagation()
                return true
              }
            }
            return false
          },
          decorations(state) {
            const decos: Decoration[] = []
            const doc = state.doc
            const headings: Array<{ pos: number; level: number; nodeSize: number }> = []
            const collapsedHeadingPositions =
              headingFoldPluginKey.getState(state)?.collapsed ?? new Set<number>()

            // Only top-level headings own a foldable section
            doc.forEach((node, offset) => {
              if (node.type.name === 'heading') {
                headings.push({
                  pos: offset,
                  level: (node.attrs.level as number) || 1,
                  nodeSize: node.nodeSize,
                })
              }
            })

            headings.forEach((h) => {
              const isCollapsed = collapsedHeadingPositions.has(h.pos)
              const foldKey = `fold:${h.pos}:${isCollapsed ? 'c' : 'e'}`

              decos.push(
                Decoration.widget(
                  h.pos + 1,
                  () => {
                    const btn = document.createElement('span')
                    btn.className = `tiptap-fold-btn ${isCollapsed ? 'is-collapsed' : ''}`
                    btn.setAttribute('data-heading-fold-btn', 'true')
                    btn.setAttribute('data-pos', String(h.pos))
                    btn.setAttribute('title', isCollapsed ? 'Expand section' : 'Collapse section')
                    btn.contentEditable = 'false'
                    btn.innerHTML = isCollapsed ? CHEVRON_RIGHT : CHEVRON_DOWN
                    return btn
                  },
                  { side: -1, stopEvent: STOP_EVENT, ignoreSelection: true, key: foldKey },
                ),
              )

              if (isCollapsed) {
                const range = foldRangeFor(doc, h.pos)
                if (range) {
                  const indicatorKey = `foldmark:${h.pos}`
                  decos.push(
                    Decoration.widget(
                      h.pos + h.nodeSize - 1,
                      () => {
                        const indicator = document.createElement('span')
                        indicator.className = 'tiptap-folded-indicator'
                        indicator.setAttribute('data-heading-indicator', 'true')
                        indicator.setAttribute('data-pos', String(h.pos))
                        indicator.textContent = '… (folded)'
                        indicator.contentEditable = 'false'
                        return indicator
                      },
                      { side: 1, stopEvent: STOP_EVENT, ignoreSelection: true, key: indicatorKey },
                    ),
                  )

                  doc.nodesBetween(range.start, range.end, (childNode, childPos) => {
                    if (childNode.isBlock && childPos >= range.start && childPos < range.end) {
                      decos.push(
                        Decoration.node(childPos, childPos + childNode.nodeSize, {
                          class: 'tiptap-folded-node',
                        }),
                      )
                      return false // don't recurse into child nodes
                    }
                    return true
                  })
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
