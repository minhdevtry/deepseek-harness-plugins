import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { DOMSerializer, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import { getBlocks, diffBlockArrays, parseMarkdownToBlocks, type BlockHunk } from './blockMap.ts'

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
            // `=== null`, not a falsy check: a genuine create's baseline is
            // the empty string, which must still arm the review (as "the
            // whole file is new") — treating it as falsy disarms instead.
            if (baselineMarkdown === null) {
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
              // baseNodes must move together with baselineBlocks — reject
              // reads baseNodes directly (see rejectSingleHunk), and any
              // accept whose replacement block count differs from the
              // replaced count desyncs a later hunk's fromA/toA against a
              // baseNodes array that never advanced, which silently deletes
              // content instead of restoring it.
              baseNodes: meta.baseNodes ?? value.baseNodes,
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
              (view) => renderHunkWidget(hunk, view),
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
 *
 * `prosemirror-view` keys this widget's decoration on `hunk.id`, which
 * encodes block INDICES only (see `blockMap.ts`) — a keystroke inside the
 * changed block leaves the id unchanged, so the DOM node (and whatever this
 * call closed over) is reused verbatim rather than redrawn. The button
 * handlers below must therefore never close over `hunk`/`pluginState`
 * themselves: only `hunk.id` is captured, and each click re-reads the
 * CURRENT plugin state and looks the hunk up fresh, so a click always acts
 * on what is actually on screen right now rather than a stale snapshot from
 * whenever this widget was first drawn — which is also why this function no
 * longer takes a `pluginState` parameter: reading one at render time would
 * only invite closing over it by mistake.
 */
function renderHunkWidget(
  hunk: BlockHunk,
  view: any,
): HTMLElement {
  const hunkId = hunk.id
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
    const state = reviewPluginKey.getState(view.state)
    const current = state?.hunks.find((h) => h.id === hunkId)
    // The reused-DOM hunk may have already been resolved (or shifted to a
    // different ordinal) since this widget was drawn — bail quietly rather
    // than act on data that no longer describes anything real.
    if (!state || !current) return
    acceptSingleHunk(view, current, state)
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
    const state = reviewPluginKey.getState(view.state)
    const current = state?.hunks.find((h) => h.id === hunkId)
    if (!state || !current) return
    rejectSingleHunk(view, current, state)
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
 *
 * Advances `baselineBlocks` AND `baseNodes` together, from the LIVE
 * document — accept never changes the document (baseline-only, per the
 * measured invariant), so the blocks at `[hunk.fromB, hunk.toB)` right now
 * ARE the accepted content. The two arrays must move together: a later
 * `rejectSingleHunk` indexes `baseNodes` with `fromA`/`toA`, and if only
 * `baselineBlocks` advanced, a hunk whose replacement block count differed
 * from what it replaced would index the wrong (or absent) nodes — see
 * `rejectSingleHunk`'s doc.
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

  // The accepted content, read from the CURRENT live document — not from
  // `hunk.currentBlocks`, which is text only and cannot rebuild real nodes.
  const liveBlocks = getBlocks(view.state.doc)
  const acceptedNodes = liveBlocks.slice(hunk.fromB, hunk.toB).map((b) => b.node)

  const nextBaselineBlocks = [...pluginState.baselineBlocks]
  nextBaselineBlocks.splice(hunk.fromA, hunk.toA - hunk.fromA, ...hunk.currentBlocks)

  const nextBaseNodes = [...pluginState.baseNodes]
  nextBaseNodes.splice(hunk.fromA, hunk.toA - hunk.fromA, ...acceptedNodes)

  view.dispatch(
    view.state.tr.setMeta(reviewPluginKey, {
      type: 'SET_BASELINE_BLOCKS',
      baselineBlocks: nextBaselineBlocks,
      baseNodes: nextBaseNodes,
    })
  )
}

/**
 * Reject a single hunk: revert blocks at hunk position to baseline content.
 *
 * Reads `pluginState.baseNodes` directly rather than re-parsing
 * `baselineMarkdown` through a throwaway editor: `baselineMarkdown` is not
 * updated by `acceptSingleHunk` (only `baselineBlocks`/`baseNodes` are, see
 * its doc), so re-parsing it here after any prior accept in the same review
 * would index a document that no longer matches `hunk.fromA`/`toA` — the
 * exact mechanism that made a reject silently delete content instead of
 * restoring it. `baseNodes` is kept in sync by every writer of the plugin
 * state, so it is always the correct source for what a hunk's range looked
 * like before its own change.
 */
/**
 * Rebuild a hunk's replacement nodes from `baseNodes`, in the given schema.
 * Pure — no dispatch — so both a single reject and a batched Reject All can
 * share the exact same rebuild-and-refuse logic.
 * @returns the replacement nodes, or `null` if the hunk must be refused
 * (an empty replacement for anything but a legitimate `add` hunk).
 */
function buildRejectReplacement(schema: any, hunk: BlockHunk, pluginState: ReviewPluginState): ProseMirrorNode[] | null {
  const baseSlice = pluginState.baseNodes.slice(hunk.fromA, hunk.toA)
  const replacementNodes = baseSlice
    .map((node) => {
      // A fragment parsed in (or advanced from) a different schema instance
      // splices in as empty, silently — rebuild in the live editor's schema.
      try {
        return schema.nodeFromJSON(node.toJSON())
      } catch {
        return null
      }
    })
    .filter((node): node is ProseMirrorNode => node !== null)

  // An `add` hunk has fromA === toA and legitimately rejects to nothing —
  // that is a real, intentional delete. Anything else with an empty
  // replacement means baseNodes desynced from this hunk's range somewhere;
  // refusing beats silently deleting live content.
  if (replacementNodes.length === 0 && hunk.type !== 'add') {
    console.warn(`[dsh-tiptap-review] reject: no baseline content for hunk ${hunk.id}; refusing to delete`)
    return null
  }
  return replacementNodes
}

export function rejectSingleHunk(view: any, hunk: BlockHunk, pluginState: ReviewPluginState): void {
  const replacementNodes = buildRejectReplacement(view.state.schema, hunk, pluginState)
  if (replacementNodes === null) return
  const tr = view.state.tr.replaceWith(hunk.fromPos, hunk.toPos, replacementNodes)
  view.dispatch(tr)
}

/**
 * Reject every given hunk in ONE transaction instead of one dispatch per
 * hunk — previously Reject All was N separate dispatches (still correct,
 * since processing highest-position-first means an earlier dispatch's edit
 * never shifts a not-yet-processed hunk's position — but N undo steps for
 * one user action, and an accidental Ctrl+Z only undid the last of them).
 * Same reverse-order trick, just accumulated onto one `tr` before a single
 * dispatch: `tr.replaceWith` only shifts positions *after* its own range, so
 * as long as hunks are applied highest-position-first, every hunk still to
 * come reads a position `tr` has not touched yet.
 */
export function rejectHunksBatch(view: any, hunks: readonly BlockHunk[], pluginState: ReviewPluginState): void {
  const ordered = [...hunks].sort((a, b) => b.fromPos - a.fromPos)
  const schema = view.state.schema
  let tr = view.state.tr
  for (const hunk of ordered) {
    const replacementNodes = buildRejectReplacement(schema, hunk, pluginState)
    if (replacementNodes === null) continue
    tr = tr.replaceWith(hunk.fromPos, hunk.toPos, replacementNodes)
  }
  if (tr.docChanged) view.dispatch(tr)
}
