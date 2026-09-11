/**
 * Notion & Obsidian-style callout extension with GitHub-flavored markdown round-tripping.
 *
 * Supports 15 canonical callout types (5 GFM + 10 Obsidian-parity), custom titles,
 * inline icons, custom accent colors, and collapsible accordion toggles (> [!NOTE]+ / > [!NOTE]-).
 */
import { Node, mergeAttributes } from '@tiptap/core'

export type CalloutType =
  | 'note'
  | 'tip'
  | 'important'
  | 'warning'
  | 'caution'
  | 'abstract'
  | 'info'
  | 'todo'
  | 'success'
  | 'question'
  | 'failure'
  | 'danger'
  | 'bug'
  | 'example'
  | 'quote'

export const CALLOUT_TYPES: readonly CalloutType[] = [
  'note',
  'tip',
  'important',
  'warning',
  'caution',
  'abstract',
  'info',
  'todo',
  'success',
  'question',
  'failure',
  'danger',
  'bug',
  'example',
  'quote',
] as const

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>
}

export const TYPE_ALIAS_MAP: Readonly<Record<string, CalloutType>> = {
  note: 'note',
  tip: 'tip',
  important: 'important',
  warning: 'warning',
  caution: 'caution',
  abstract: 'abstract',
  info: 'info',
  todo: 'todo',
  success: 'success',
  question: 'question',
  failure: 'failure',
  danger: 'danger',
  bug: 'bug',
  example: 'example',
  quote: 'quote',
  summary: 'abstract',
  tldr: 'abstract',
  check: 'success',
  done: 'success',
  help: 'question',
  faq: 'question',
  fail: 'failure',
  missing: 'failure',
  error: 'danger',
  cite: 'quote',
  idea: 'tip',
  hint: 'tip',
  warn: 'warning',
  attention: 'warning',
}

export function normalizeCalloutType(raw: string | undefined): CalloutType {
  if (!raw) return 'note'
  const lower = raw.trim().toLowerCase()
  if (TYPE_ALIAS_MAP[lower]) return TYPE_ALIAS_MAP[lower]
  if ((CALLOUT_TYPES as readonly string[]).includes(lower)) return lower as CalloutType
  return 'note'
}

const CALLOUT_ALERT_START = /^ {0,3}>\s*\[!(\w+)\]([+-])?(?:\s+(.*?))?(?:\n|$)/i
const CALLOUT_ALERT_MARKER_LINE = /^\[!(\w+)\]([+-])?(?:\s+(.*?))?$/i
const CALLOUT_ALERT_QUOTE_LINE = /^ {0,3}>( ?)/

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /** Wrap selection into a callout block */
      setCallout: (attributes?: {
        type?: CalloutType
        title?: string
        icon?: string
        color?: string
        collapsible?: boolean
        defaultOpen?: boolean
      }) => ReturnType
      /** Toggle callout wrapping */
      toggleCallout: (attributes?: {
        type?: CalloutType
        title?: string
        icon?: string
        color?: string
        collapsible?: boolean
        defaultOpen?: boolean
      }) => ReturnType
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
        default: 'note',
        parseHTML: (element) =>
          normalizeCalloutType(
            element.getAttribute('data-callout-type') ||
              element.getAttribute('data-type') ||
              'note',
          ),
        renderHTML: (attributes) => ({
          'data-callout-type': attributes.type || 'note',
          'data-type': 'callout',
        }),
      },
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-title') || '',
        renderHTML: (attributes) =>
          attributes.title ? { 'data-title': attributes.title } : {},
      },
      icon: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-icon') || '',
        renderHTML: (attributes) =>
          attributes.icon ? { 'data-icon': attributes.icon } : {},
      },
      color: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-color') || '',
        renderHTML: (attributes) =>
          attributes.color ? { 'data-color': attributes.color } : {},
      },
      collapsible: {
        default: false,
        parseHTML: (element) =>
          element.tagName.toLowerCase() === 'details' ||
          element.getAttribute('data-collapsible') === 'true',
        renderHTML: (attributes) =>
          attributes.collapsible ? { 'data-collapsible': 'true' } : {},
      },
      defaultOpen: {
        default: true,
        parseHTML: (element) =>
          element.tagName.toLowerCase() === 'details'
            ? element.hasAttribute('open')
            : element.getAttribute('data-default-open') !== 'false',
        renderHTML: (attributes) =>
          attributes.collapsible && attributes.defaultOpen === false
            ? { 'data-default-open': 'false' }
            : {},
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'details[data-type="callout"]',
        getAttrs: (element: HTMLElement) => ({
          type: normalizeCalloutType(element.getAttribute('data-callout-type') || 'note'),
          title: element.getAttribute('data-title') || '',
          icon: element.getAttribute('data-icon') || '',
          color: element.getAttribute('data-color') || '',
          collapsible: true,
          defaultOpen: element.hasAttribute('open'),
        }),
      },
      {
        tag: 'div[data-type="callout"]',
        getAttrs: (element: HTMLElement) => ({
          type: normalizeCalloutType(element.getAttribute('data-callout-type') || 'note'),
          title: element.getAttribute('data-title') || '',
          icon: element.getAttribute('data-icon') || '',
          color: element.getAttribute('data-color') || '',
          collapsible: element.getAttribute('data-collapsible') === 'true',
          defaultOpen: element.getAttribute('data-default-open') !== 'false',
        }),
      },
      {
        tag: 'div[data-callout-type]',
        getAttrs: (element: HTMLElement) => ({
          type: normalizeCalloutType(element.getAttribute('data-callout-type') || 'note'),
          title: element.getAttribute('data-title') || '',
          icon: element.getAttribute('data-icon') || '',
          color: element.getAttribute('data-color') || '',
          collapsible: element.getAttribute('data-collapsible') === 'true',
          defaultOpen: element.getAttribute('data-default-open') !== 'false',
        }),
      },
      { tag: 'div.tiptap-callout' },
      { tag: 'blockquote[data-callout]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const calloutType = normalizeCalloutType(
      (HTMLAttributes['data-callout-type'] as string) || (HTMLAttributes.type as string) || 'note',
    )
    const collapsible =
      HTMLAttributes['data-collapsible'] === 'true' || HTMLAttributes.collapsible === true
    const defaultOpen =
      HTMLAttributes['data-default-open'] !== 'false' && HTMLAttributes.defaultOpen !== false
    const title = (HTMLAttributes['data-title'] as string) || (HTMLAttributes.title as string) || ''
    const color = (HTMLAttributes['data-color'] as string) || (HTMLAttributes.color as string) || ''
    const icon = (HTMLAttributes['data-icon'] as string) || (HTMLAttributes.icon as string) || ''

    const style = color
      ? `--callout-type-color: ${color}; border-left-color: ${color};`
      : undefined

    if (collapsible) {
      return [
        'details',
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          class: `tiptap-callout tiptap-callout-${calloutType} tiptap-callout-collapsible`,
          open: defaultOpen ? '' : undefined,
          style,
        }),
        [
          'summary',
          { class: 'tiptap-callout-summary', contenteditable: 'false' },
          ['span', { class: 'tiptap-callout-icon', 'data-icon': icon || undefined }],
          ['span', { class: 'tiptap-callout-title' }, title || calloutType.toUpperCase()],
          ['span', { class: 'tiptap-callout-chevron' }],
        ],
        ['div', { class: 'tiptap-callout-content' }, 0],
      ]
    }

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `tiptap-callout tiptap-callout-${calloutType}`,
        style,
      }),
      title
        ? [
            'div',
            { class: 'tiptap-callout-header', contenteditable: 'false' },
            ['span', { class: 'tiptap-callout-icon', 'data-icon': icon || undefined }],
            ['span', { class: 'tiptap-callout-title' }, title],
          ]
        : ['span', { class: 'tiptap-callout-icon-standalone', 'data-icon': icon || undefined, contenteditable: 'false' }],
      ['div', { class: 'tiptap-callout-content' }, 0],
    ]
  },

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
      const markerLine = CALLOUT_ALERT_MARKER_LINE.exec(
        firstLine.replace(CALLOUT_ALERT_QUOTE_LINE, ''),
      )
      if (!markerLine) {
        return undefined
      }
      const bodyLines: string[] = []
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
        foldableMarker: markerLine[2] || null,
        calloutTitle: markerLine[3] ? markerLine[3].trim() : '',
        tokens: bodyRaw.trim() ? helper.blockTokens(bodyRaw) : [],
      }
    },
  },

  parseMarkdown: (token, helpers) => {
    const rawType = token.calloutType || 'note'
    const calloutType = normalizeCalloutType(rawType)
    const foldableMarker = token.foldableMarker as '+' | '-' | null
    const collapsible = foldableMarker !== null && foldableMarker !== undefined
    const defaultOpen = foldableMarker === '+' || !collapsible
    const title = token.calloutTitle || ''

    const content =
      token.tokens?.length && helpers.parseBlockChildren
        ? helpers.parseBlockChildren(token.tokens)
        : [{ type: 'paragraph' }]

    return helpers.createNode(
      'callout',
      {
        type: calloutType,
        title,
        collapsible,
        defaultOpen,
      },
      content,
    )
  },

  renderMarkdown: (node, helpers) => {
    const type = normalizeCalloutType((node.attrs?.type as string) || 'note')
    const collapsible = Boolean(node.attrs?.collapsible)
    const defaultOpen = node.attrs?.defaultOpen !== false
    const title = (node.attrs?.title as string) || ''
    const foldMarker = collapsible ? (defaultOpen ? '+' : '-') : ''
    const marker = `[!${type.toUpperCase()}]${foldMarker}${title ? ` ${title}` : ''}`
    const body = helpers.renderChildren(node.content ?? [])
    const lines = [marker, ...body.split('\n')]
    return lines.map((line) => (line ? `> ${line}` : '>')).join('\n')
  },

  addCommands() {
    return {
      setCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attributes)
        },
      toggleCallout:
        (attributes) =>
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
