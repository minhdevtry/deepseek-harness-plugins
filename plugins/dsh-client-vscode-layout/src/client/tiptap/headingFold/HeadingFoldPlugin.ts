import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

export const headingFoldPluginKey = new PluginKey<HeadingFoldState>('heading_fold_decorations')

/**
 * Which headings are collapsed, kept as real ProseMirror plugin state rather
 * than a module-level `Set`.
 *
 * A module-level `Set` is one object shared by every `Editor` built from
 * `documentExtensions()` — every open markdown tab, plus the headless
 * round-trip editors in markdown.ts. Two tabs whose first heading happens to
 * land at the same position (very common for short, similarly-shaped docs)
 * would collapse together, and closing a tab never removed its entries, so
 * fold state from long-closed files could resurface on an unrelated
 * document reusing the same position. Real plugin state is scoped to the
 * `EditorState` it belongs to (so per-tab, and freed when the editor is
 * destroyed) and — the second half of the same bug — gets run through
 * `tr.mapping` on every change, so a collapsed heading's position stays
 * correct as edits shift the document around it instead of silently going
 * stale (falling out of sync with the heading it was tracking).
 */
type HeadingFoldState = { collapsed: Set<number> }

const CHEVRON_RIGHT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`
const CHEVRON_DOWN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`

export function toggleHeadingFold(view: EditorView, headingPos: number): void {
  view.dispatch(view.state.tr.setMeta(headingFoldPluginKey, { toggled: headingPos }))
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
            // Keep every tracked position correct across the edit before
            // touching membership — otherwise an edit above a collapsed
            // heading silently detaches its fold from the heading it belongs to.
            let collapsed = value.collapsed
            if (tr.docChanged) {
              collapsed = new Set([...collapsed].map((pos) => tr.mapping.map(pos)))
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
        props: {
          handleClick(view, _pos, event) {
            const target = (event.target as HTMLElement).closest('[data-heading-fold-btn="true"], [data-heading-indicator="true"]')
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
            const collapsedHeadingPositions = headingFoldPluginKey.getState(state)?.collapsed ?? new Set<number>()

            doc.descendants((node, pos) => {
              if (node.type.name === 'heading') {
                headings.push({
                  pos,
                  level: (node.attrs.level as number) || 1,
                  nodeSize: node.nodeSize,
                })
              }
            })

            headings.forEach((h, index) => {
              const isCollapsed = collapsedHeadingPositions.has(h.pos)

              // Add fold toggle button widget inside heading
              const btn = document.createElement('span')
              btn.className = `tiptap-fold-btn ${isCollapsed ? 'is-collapsed' : ''}`
              btn.setAttribute('data-heading-fold-btn', 'true')
              btn.setAttribute('data-pos', String(h.pos))
              btn.setAttribute('title', isCollapsed ? 'Expand section' : 'Collapse section')
              btn.innerHTML = isCollapsed ? CHEVRON_RIGHT : CHEVRON_DOWN

              decos.push(Decoration.widget(h.pos + 1, btn, { side: -1 }))

              if (isCollapsed) {
                // Find where this folded section ends (next heading with level <= current level)
                let foldEnd = doc.content.size
                for (let i = index + 1; i < headings.length; i++) {
                  const item = headings[i]
                  if (item && item.level <= h.level) {
                    foldEnd = item.pos
                    break
                  }
                }

                const foldStart = h.pos + h.nodeSize
                if (foldEnd > foldStart) {
                  // Add indicator tag badge
                  const indicator = document.createElement('span')
                  indicator.className = 'tiptap-folded-indicator'
                  indicator.setAttribute('data-heading-indicator', 'true')
                  indicator.setAttribute('data-pos', String(h.pos))
                  indicator.textContent = '… (folded)'
                  decos.push(Decoration.widget(h.pos + h.nodeSize - 1, indicator, { side: 1 }))

                  // Hide nodes in the folded range
                  doc.nodesBetween(foldStart, foldEnd, (childNode, childPos) => {
                    if (childNode.isBlock && childPos >= foldStart && childPos < foldEnd) {
                      decos.push(
                        Decoration.node(childPos, childPos + childNode.nodeSize, {
                          class: 'tiptap-folded-node',
                        }),
                      )
                    }
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
