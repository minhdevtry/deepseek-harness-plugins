import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { DOMSerializer, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Editor } from '@tiptap/core'
import { getBlocks, diffBlockArrays, parseMarkdownToBlocks, type BlockHunk } from './blockMap.ts'
import { documentExtensions } from './extensions.ts'
import { encodeRawHtmlLines } from './html/rawHtmlLine.ts'
import { splitFrontmatter } from './frontmatter/splitFrontmatter.ts'

export interface ReviewPluginState {
  baselineMarkdown: string | null
  baselineBlocks: string[]
  baseNodes: ProseMirrorNode[]
  hunks: BlockHunk[]
  snapshots: string[]
}

export const reviewPluginKey = new PluginKey<ReviewPluginState>('dsh-tiptap-review')

export function createTipTapReviewPlugin(options?: {
  onStatsChange?: (stats: { count: number; activeIndex: number }) => void
}): Plugin<ReviewPluginState> {
  return new Plugin<ReviewPluginState>({
    key: reviewPluginKey,
    state: {
      init: () => ({
        baselineMarkdown: null,
        baselineBlocks: [],
        baseNodes: [],
        hunks: [],
        snapshots: [],
      }),
      apply: (tr, value, _oldState, newState) => {
        const meta = tr.getMeta(reviewPluginKey)
        let nextValue = value

        if (meta !== undefined) {
          if (meta.type === 'SET_BASELINE') {
            const baselineMarkdown = meta.baseline as string | null
            if (!baselineMarkdown) {
              nextValue = {
                baselineMarkdown: null,
                baselineBlocks: [],
                baseNodes: [],
                hunks: [],
                snapshots: [],
              }
            } else {
              const { blocks, nodes } = parseMarkdownToBlocks(baselineMarkdown)
              nextValue = {
                baselineMarkdown,
                baselineBlocks: blocks,
                baseNodes: nodes,
                hunks: [],
                snapshots: meta.snapshots ?? value.snapshots,
              }
            }
          } else if (meta.type === 'SET_BASELINE_BLOCKS') {
            nextValue = {
              ...value,
              baselineBlocks: meta.baselineBlocks,
              hunks: [],
            }
          } else if (meta.type === 'PUSH_SNAPSHOT') {
            nextValue = {
              ...value,
              snapshots: [...value.snapshots, meta.snapshot],
            }
          } else if (meta.type === 'POP_SNAPSHOT') {
            const snaps = [...value.snapshots]
            const prev = snaps.pop()
            if (prev !== undefined) {
              const { blocks, nodes } = parseMarkdownToBlocks(prev)
              nextValue = {
                ...value,
                baselineMarkdown: prev,
                baselineBlocks: blocks,
                baseNodes: nodes,
                snapshots: snaps,
              }
            }
          }
        }

        // Recompute hunks against current doc
        if (nextValue.baselineMarkdown !== null) {
          const currentBlocks = getBlocks(newState.doc)
          const hunks = diffBlockArrays(
            nextValue.baselineBlocks,
            currentBlocks,
            newState.doc.content.size,
            nextValue.baseNodes
          )
          nextValue = { ...nextValue, hunks }
        }

        if (options?.onStatsChange && nextValue.hunks !== value.hunks) {
          options.onStatsChange({
            count: nextValue.hunks.length,
            activeIndex: nextValue.hunks.length > 0 ? 1 : 0,
          })
        }

        return nextValue
      },
    },
    props: {
      decorations: (state) => {
        const pluginState = reviewPluginKey.getState(state)
        if (!pluginState || pluginState.baselineMarkdown === null || pluginState.hunks.length === 0) {
          return DecorationSet.empty
        }

        const decos: Decoration[] = []
        const currentBlocks = getBlocks(state.doc)

        for (const hunk of pluginState.hunks) {
          // 1. Highlight added/modified blocks
          if (hunk.toB > hunk.fromB) {
            for (let bIdx = hunk.fromB; bIdx < hunk.toB; bIdx++) {
              const block = currentBlocks[bIdx]
              if (block) {
                decos.push(
                  Decoration.node(block.pos, block.pos + block.size, {
                    class: 'dsh-notion-block-added',
                  })
                )
              }
            }
          }

          // 2. Insert phantom widget for deleted blocks or review toolbar
          const widgetPos = hunk.fromPos
          decos.push(
            Decoration.widget(
              widgetPos,
              (view) => renderHunkWidget(hunk, view, pluginState),
              { side: -1, key: hunk.id }
            )
          )
        }

        return DecorationSet.create(state.doc, decos)
      },
    },
  })
}

/**
 * Render deleted block preview & Notion action buttons [✓ Giữ] [✕ Bỏ].
 */
function renderHunkWidget(
  hunk: BlockHunk,
  view: any,
  pluginState: ReviewPluginState
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'dsh-notion-deleted-widget'

  const toolbar = document.createElement('div')
  toolbar.className = 'dsh-notion-review-toolbar'

  const badge = document.createElement('span')
  if (hunk.type === 'add') {
    badge.className = 'dsh-notion-badge-added'
    badge.textContent = '✨ MỚI'
  } else if (hunk.type === 'delete') {
    badge.className = 'dsh-notion-badge-deleted'
    badge.textContent = '✕ BẢN CŨ ĐÃ XOÁ'
  } else {
    badge.className = 'dsh-notion-badge-deleted'
    badge.textContent = '⚡ THAY ĐỔI'
  }
  toolbar.appendChild(badge)

  const actionsGroup = document.createElement('div')
  actionsGroup.style.display = 'flex'
  actionsGroup.style.alignItems = 'center'
  actionsGroup.style.gap = '6px'
  actionsGroup.style.marginLeft = 'auto'

  // [✓ Giữ] Accept Button
  const btnAccept = document.createElement('button')
  btnAccept.className = 'dsh-notion-btn-action dsh-notion-btn-accept'
  btnAccept.innerHTML = '✓ Giữ bản mới'
  btnAccept.title = 'Giữ thay đổi này của AI'
  btnAccept.onclick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    acceptSingleHunk(view, hunk, pluginState)
  }
  actionsGroup.appendChild(btnAccept)

  // [✕ Bỏ] Reject Button
  const btnReject = document.createElement('button')
  btnReject.className = 'dsh-notion-btn-action dsh-notion-btn-reject'
  btnReject.innerHTML = '↺ Khôi phục bản cũ'
  btnReject.title = 'Khôi phục lại nội dung gốc ban đầu'
  btnReject.onclick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    rejectSingleHunk(view, hunk, pluginState)
  }
  actionsGroup.appendChild(btnReject)

  toolbar.appendChild(actionsGroup)
  container.appendChild(toolbar)

  // Render deleted original blocks using actual DOMSerializer
  if (hunk.baseNodes && hunk.baseNodes.length > 0) {
    const preview = document.createElement('div')
    preview.className = 'dsh-notion-deleted-preview'
    try {
      const serializer = DOMSerializer.fromSchema(view.state.schema)
      for (const node of hunk.baseNodes) {
        try {
          const liveNode = view.state.schema.nodeFromJSON(node.toJSON())
          const dom = serializer.serializeNode(liveNode)
          preview.appendChild(dom)
        } catch {
          const p = document.createElement('p')
          p.textContent = node.textContent
          preview.appendChild(p)
        }
      }
    } catch {
      preview.textContent = hunk.baseBlocks.map((b) => b.split(':').slice(2).join(':')).join('\n')
    }
    container.appendChild(preview)
  } else if (hunk.baseBlocks.length > 0) {
    const preview = document.createElement('div')
    preview.className = 'dsh-notion-deleted-preview'
    preview.textContent = hunk.baseBlocks.map((b) => b.split(':').slice(2).join(':')).join('\n')
    container.appendChild(preview)
  }

  return container
}

/**
 * Accept a single hunk: update baseline to match current working document.
 */
export function acceptSingleHunk(view: any, hunk: BlockHunk, pluginState: ReviewPluginState): void {
  // Push current baseline to snapshot stack for undo
  const currentBaseline = pluginState.baselineMarkdown
  if (currentBaseline) {
    view.dispatch(
      view.state.tr.setMeta(reviewPluginKey, {
        type: 'PUSH_SNAPSHOT',
        snapshot: currentBaseline,
      })
    )
  }

  // Update baselineBlocks in place by replacing the hunk range
  const nextBaselineBlocks = [...pluginState.baselineBlocks]
  nextBaselineBlocks.splice(hunk.fromA, hunk.toA - hunk.fromA, ...hunk.currentBlocks)

  view.dispatch(
    view.state.tr.setMeta(reviewPluginKey, {
      type: 'SET_BASELINE_BLOCKS',
      baselineBlocks: nextBaselineBlocks,
    })
  )
}

/**
 * Reject a single hunk: revert blocks at hunk position to baseline content.
 */
export function rejectSingleHunk(view: any, hunk: BlockHunk, pluginState: ReviewPluginState): void {
  const currentBaseline = pluginState.baselineMarkdown
  if (!currentBaseline) return

  const { body } = splitFrontmatter(currentBaseline)
  const throwaway = new Editor({
    element: typeof document !== 'undefined' ? document.createElement('div') : null,
    extensions: documentExtensions(),
    content: encodeRawHtmlLines(body),
    contentType: 'markdown',
  })

  try {
    const baseDoc = throwaway.state.doc
    const baseBlocks = getBlocks(baseDoc)

    // Collect baseline replacement nodes for [hunk.fromA, hunk.toA)
    const replacementNodes: any[] = []
    for (let i = hunk.fromA; i < hunk.toA; i++) {
      const block = baseBlocks[i]
      if (block) {
        // Rebuild in live editor's schema
        const liveNode = view.state.schema.nodeFromJSON(block.node.toJSON())
        replacementNodes.push(liveNode)
      }
    }

    const tr = view.state.tr.replaceWith(hunk.fromPos, hunk.toPos, replacementNodes)
    view.dispatch(tr)
  } finally {
    throwaway.destroy()
  }
}
