/**
 * TipTap Callout / Alert block node extension.
 *
 * Provides Notion-style callout blocks with customizable types:
 * - 'info' / 'note' (blue)
 * - 'tip' (green/emerald)
 * - 'warning' (amber/yellow)
 * - 'danger' / 'caution' (red/rose)
 * - 'success' (teal/green)
 */
import { Node, mergeAttributes } from '@tiptap/core'

export type CalloutType = 'info' | 'tip' | 'warning' | 'danger' | 'success'

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
    /** Wrap selection into a callout block */
    setCallout: (attributes?: { type?: CalloutType }) => ReturnType
    /** Toggle callout wrapping */
    toggleCallout: (attributes?: { type?: CalloutType }) => ReturnType
    /** Lift out of callout */
    unsetCallout: () => ReturnType
  }
}
}

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: element => element.getAttribute('data-callout-type') || element.getAttribute('data-type') || 'info',
        renderHTML: attributes => ({
          'data-callout-type': attributes.type,
          'data-type': 'callout',
        }),
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="callout"]' },
      { tag: 'div[data-callout-type]' },
      { tag: 'div.tiptap-callout' },
      { tag: 'blockquote[data-callout]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const calloutType = (HTMLAttributes['data-callout-type'] as string) || 'info'
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `tiptap-callout tiptap-callout-${calloutType}`,
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setCallout:
        attributes =>
          ({ commands }) => {
            return commands.wrapIn(this.name, attributes)
          },
      toggleCallout:
        attributes =>
          ({ commands }) => {
            return commands.toggleWrap(this.name, attributes)
          },
      unsetCallout:
        () =>
          ({ commands }) => {
            return commands.lift(this.name)
          },
    }
  },
})
