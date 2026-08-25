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

/**
 * GitHub-style alert markdown, e.g. `> [!WARNING]\n> body`. Maps onto our five
 * callout colors; IMPORTANT collapses onto 'info' since we don't have a
 * distinct sixth color for it.
 *
 * `success` has no standard GitHub marker (the real convention is exactly
 * NOTE/TIP/IMPORTANT/WARNING/CAUTION), so it gets its own SUCCESS marker
 * instead of also collapsing onto TIP. Sharing TIP's marker used to mean a
 * `success` callout silently became a `tip` one on the very next save+reload
 * — SUCCESS isn't real GitHub syntax, but it round-trips correctly within
 * this editor, and degrades to a plain, readable blockquote everywhere else.
 */
const CALLOUT_MARKER_TO_TYPE: Record<string, CalloutType> = {
  note: 'info',
  tip: 'tip',
  important: 'info',
  warning: 'warning',
  caution: 'danger',
  success: 'success',
}

const CALLOUT_TYPE_TO_MARKER: Record<CalloutType, string> = {
  info: 'NOTE',
  tip: 'TIP',
  warning: 'WARNING',
  danger: 'CAUTION',
  success: 'SUCCESS',
}

const CALLOUT_ALERT_START = /^ {0,3}>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|SUCCESS)\]/i
const CALLOUT_ALERT_MARKER_LINE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|SUCCESS)\]\s*(.*)$/i
const CALLOUT_ALERT_QUOTE_LINE = /^ {0,3}>( ?)/

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

  // A distinct token name (not 'blockquote') so this doesn't collide with
  // the native Blockquote extension's own markdown registration — the
  // markdown library resolves a NODE's renderer by first checking token-name
  // registrations, so reusing 'blockquote' here would hijack rendering of
  // every plain blockquote in the document, not just alert-style ones.
  markdownTokenName: 'calloutAlert',

  markdownTokenizer: {
    name: 'calloutAlert',
    level: 'block',
    start(src) {
      const match = CALLOUT_ALERT_START.exec(src)
      return match ? match.index : -1
    },
    tokenize(src, _tokens, helper) {
      const lines = src.split('\n')
      const firstLine = lines[0] ?? ''
      if (!CALLOUT_ALERT_START.test(firstLine)) {
        return undefined
      }
      const markerLine = CALLOUT_ALERT_MARKER_LINE.exec(firstLine.replace(CALLOUT_ALERT_QUOTE_LINE, ''))
      if (!markerLine) {
        return undefined
      }
      const bodyLines: string[] = markerLine[2] ? [markerLine[2]] : []
      let consumed = 1
      for (; consumed < lines.length; consumed += 1) {
        const line = lines[consumed] ?? ''
        if (!CALLOUT_ALERT_QUOTE_LINE.test(line)) {
          break
        }
        bodyLines.push(line.replace(CALLOUT_ALERT_QUOTE_LINE, ''))
      }
      const consumedLines = lines.slice(0, consumed)
      const raw = consumedLines.join('\n') + (consumed < lines.length ? '\n' : '')
      const bodyRaw = bodyLines.join('\n')
      return {
        type: 'calloutAlert',
        raw,
        calloutType: markerLine[1],
        tokens: bodyRaw.trim() ? helper.blockTokens(bodyRaw) : [],
      }
    },
  },

  parseMarkdown: (token, helpers) => {
    const calloutType = CALLOUT_MARKER_TO_TYPE[(token.calloutType || '').toLowerCase()] || 'info'
    const content =
      token.tokens?.length && helpers.parseBlockChildren
        ? helpers.parseBlockChildren(token.tokens)
        : [{ type: 'paragraph' }]
    return helpers.createNode('callout', { type: calloutType }, content)
  },

  renderMarkdown: (node, helpers) => {
    const marker = CALLOUT_TYPE_TO_MARKER[(node.attrs?.type as CalloutType) || 'info'] || 'NOTE'
    const body = helpers.renderChildren(node.content ?? [])
    const lines = [`[!${marker}]`, ...body.split('\n')]
    return lines.map((line) => (line ? `> ${line}` : '>')).join('\n')
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
