/**
 * Notion-style independent Toggle / Details block extension.
 *
 * Implements collapsible `<details>` and `<summary>` blocks with full markdown
 * round-tripping, Notion-like chevron animations, and smart keyboard navigation.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    details: {
      /** Wrap or insert a Toggle / Details block */
      setDetails: (attributes?: { open?: boolean }) => ReturnType
      /** Insert an empty Toggle block with summary */
      insertDetails: (options?: { summary?: string; open?: boolean }) => ReturnType
      /** Toggle open / closed state */
      toggleDetailsState: () => ReturnType
      /** Lift out of details block */
      unsetDetails: () => ReturnType
    }
  }
}

export const DetailsSummary = Node.create({
  name: 'detailsSummary',
  group: 'block',
  content: 'inline*',
  defining: true,
  isolating: true,

  parseHTML() {
    return [
      { tag: 'summary' },
      { tag: 'div[data-type="details-summary"]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'summary',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'details-summary',
        class: 'tiptap-details-summary',
      }),
      0,
    ]
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state, view } = this.editor
        const { $from } = state.selection

        // If inside detailsSummary, pressing Enter should move focus into detailsContent
        if ($from.parent.type.name === this.name) {
          const detailsNode = $from.node(-1)
          if (detailsNode && detailsNode.type.name === 'details') {
            const detailsContentPos = $from.after()
            view.dispatch(
              state.tr
                .setSelection(TextSelection.near(state.doc.resolve(detailsContentPos + 1)))
                .scrollIntoView(),
            )
            return true
          }
        }
        return false
      },
      Backspace: () => {
        const { state } = this.editor
        const { $from, empty } = state.selection

        // If at start of empty detailsSummary, lift/convert to normal paragraph
        if (empty && $from.parent.type.name === this.name && $from.parent.content.size === 0) {
          return this.editor.commands.unsetDetails()
        }
        return false
      },
    }
  },
})

export const DetailsContent = Node.create({
  name: 'detailsContent',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [
      { tag: 'div.tiptap-details-content' },
      { tag: 'div[data-type="details-content"]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'details-content',
        class: 'tiptap-details-content',
      }),
      0,
    ]
  },
})

const DETAILS_BLOCK_START = /^ {0,3}<details(?:\s+open)?>/i

export const Details = Node.create({
  name: 'details',
  group: 'block',
  content: 'detailsSummary detailsContent',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: element => element.hasAttribute('open') || element.getAttribute('data-open') === 'true',
        renderHTML: attributes => (attributes.open ? { open: '', 'data-open': 'true' } : { 'data-open': 'false' }),
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'details' },
      { tag: 'div[data-type="details"]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'details',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'details',
        class: 'tiptap-details',
      }),
      0,
    ]
  },

  markdownTokenName: 'detailsBlock',

  markdownTokenizer: {
    name: 'detailsBlock',
    level: 'block',
    start(src) {
      const match = DETAILS_BLOCK_START.exec(src)
      return match ? match.index : -1
    },
    tokenize(src, _tokens, helper) {
      const match = /^ {0,3}<details(\s+open)?\s*>([\s\S]*?)<\/details>/i.exec(src)
      if (!match) return undefined

      const raw = match[0]
      const isOpen = Boolean(match[1])
      const inner = match[2] || ''

      const summaryMatch = /<summary>([\s\S]*?)<\/summary>/i.exec(inner)
      const summaryText = summaryMatch ? summaryMatch[1]?.trim() || 'Toggle' : 'Toggle'
      const bodyText = summaryMatch ? inner.replace(summaryMatch[0], '').trim() : inner.trim()

      return {
        type: 'detailsBlock',
        raw,
        isOpen,
        summaryText,
        tokens: bodyText ? helper.blockTokens(bodyText) : [],
      }
    },
  },

  parseMarkdown: (token, helpers) => {
    const summaryNode = helpers.createNode('detailsSummary', {}, [
      helpers.createNode('text', { text: token.summaryText || 'Toggle' }),
    ])
    const bodyChildren = token.tokens?.length && helpers.parseBlockChildren
      ? helpers.parseBlockChildren(token.tokens)
      : [{ type: 'paragraph' }]
    const contentNode = helpers.createNode('detailsContent', {}, bodyChildren)

    return helpers.createNode('details', { open: token.isOpen !== false }, [summaryNode, contentNode])
  },

  renderMarkdown: (node, helpers) => {
    const summaryChild = node.child(0)
    const contentChild = node.child(1)

    const summaryMd = summaryChild ? helpers.renderChildren(summaryChild.content ?? []) : 'Toggle'
    const contentMd = contentChild ? helpers.renderChildren(contentChild.content ?? []) : ''

    const openAttr = node.attrs?.open ? ' open' : ''
    return `<details${openAttr}>\n<summary>${summaryMd.trim()}</summary>\n\n${contentMd.trim()}\n</details>`
  },

  addCommands() {
    return {
      setDetails:
        (attributes = {}) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: { open: attributes.open ?? true },
              content: [
                {
                  type: 'detailsSummary',
                  content: [{ type: 'text', text: 'Toggle title' }],
                },
                {
                  type: 'detailsContent',
                  content: [{ type: 'paragraph' }],
                },
              ],
            })
            .run()
        },
      insertDetails:
        (options = {}) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: { open: options.open ?? true },
              content: [
                {
                  type: 'detailsSummary',
                  content: [{ type: 'text', text: options.summary || 'Toggle title' }],
                },
                {
                  type: 'detailsContent',
                  content: [{ type: 'paragraph' }],
                },
              ],
            })
            .run()
        },
      toggleDetailsState:
        () =>
        ({ state, commands }) => {
          const { $from } = state.selection
          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d)
            if (node.type.name === this.name) {
              return commands.updateAttributes(this.name, { open: !node.attrs.open })
            }
          }
          return false
        },
      unsetDetails:
        () =>
        ({ state, chain }) => {
          const { $from } = state.selection
          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d)
            if (node.type.name === this.name) {
              return chain().lift(this.name).run()
            }
          }
          return false
        },
    }
  },
})
