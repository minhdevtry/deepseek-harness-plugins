/**
 * Byte-preserving passthrough for HTML the schema can't represent.
 *
 * TipTap's schema only understands the markup it has a node/mark for.
 * Anything else — a machine-generated `<!-- do not edit -->` header, an
 * `<a id="...">` anchor used as a heading-jump target — has no node to
 * become, and `@tiptap/markdown`'s own HTML fallback drops it silently: an
 * unrecognized tag with no children parses to nothing (measured: a 3000-line
 * generated doc with an anchor before every heading lost ~200 lines on one
 * round trip).
 *
 * Scope is deliberately narrow: only a line whose ENTIRE trimmed content is
 * one HTML comment or one complete tag gets preserved this way — exactly the
 * shape of both real cases found in this repo's docs (a leading generation
 * banner, and per-section anchor tags). A tag embedded mid-sentence, or a
 * comment spanning multiple lines, is not handled; that HTML still round-trips
 * however `@tiptap/markdown`'s own fallback already treats it (dropped, same
 * as before this module existed) rather than through a half-built path here.
 *
 * How it works: before the markdown ever reaches the parser, a matching line
 * is replaced with a marker run built from ASCII control characters — bytes
 * nobody can type or paste as prose, so there is no escaping/collision
 * concern the way there would be with a human-readable marker. A block-level
 * `markdownTokenizer` recognizes that marker and turns it into an atom node
 * carrying the original line as an opaque `value` attribute; `renderMarkdown`
 * echoes that value back verbatim, byte for byte, on save.
 */
import { Node, mergeAttributes } from '@tiptap/core'

// U+0001/U+0002 (SOH/STX): bytes nobody can type or paste as prose, so a
// user's own authored text can never collide with this marker the way a
// human-readable envelope like `[[RAW_HTML:...]]` could.
const MARKER_START = '\u0001RAW_HTML_LINE\u0001'
const MARKER_END = '\u0002'

// One or more complete tags back to back with nothing else on the line, e.g.
// `<a id="x"></a>` (an anchor's open+close tag both land on one line) or
// a lone `<br>`. Anything with real text alongside a tag isn't "line-only".
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const MARKER_REGEX = new RegExp(
  `^([ \\t]*)${escapeRegex(MARKER_START)}([^${escapeRegex(MARKER_END)}]*)${escapeRegex(MARKER_END)}`,
)

function isLineOnlyHtml(trimmed: string): boolean {
  if (!trimmed.startsWith('<')) {
    return false
  }
  if (trimmed.startsWith('<!--')) {
    return trimmed.endsWith('-->')
  }
  return /^(?:<\/?[A-Za-z][\w.:-]*(?:\s[^<>]*?)?\/?>)+$/.test(trimmed)
}

/** `[^id]: text` — a footnote definition. CommonMark has no footnotes, so the
 *  parser escapes the brackets and the reference is destroyed. */
const FOOTNOTE_DEF = /^\[\^[^\]]+\]:/

function isOpaqueLine(trimmed: string): boolean {
  return isLineOnlyHtml(trimmed) || FOOTNOTE_DEF.test(trimmed)
}

/**
 * Replace every line outside a fenced code block whose trimmed content is a
 * single complete HTML comment, tag, or footnote def with an opaque marker run. Call this on
 * raw source text before it reaches an editor built from `documentExtensions`
 * — `RawHtmlLineExtension`'s tokenizer decodes the marker back on parse.
 */
export function encodeRawHtmlLines(source: string): string {
  const lines = source.split('\n')
  let activeFence: '`' | '~' | null = null
  let activeFenceLength = 0

  const encoded = lines.map((line, index) => {
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line)
    const fenceRun = fenceMatch?.[1]
    if (fenceRun) {
      const fenceChar = fenceRun[0] as '`' | '~'
      const fenceLength = fenceRun.length
      if (activeFence === null) {
        activeFence = fenceChar
        activeFenceLength = fenceLength
      } else if (activeFence === fenceChar && fenceLength >= activeFenceLength) {
        activeFence = null
        activeFenceLength = 0
      }
      return line
    }

    if (activeFence !== null) {
      return line
    }

    const trimmed = line.trim()
    const indent = line.slice(0, line.length - line.trimStart().length)

    // The `>` belongs to the blockquote, not to the opaque line, so it stays
    // outside the marker — baking it into the node's value would make the
    // serializer emit it twice (`> > <!-- x -->`).
    //
    // Only a blockquote that is *nothing but* this one line can be preserved.
    // `rawHtmlLine` is a block node, so putting one in the middle of a
    // multi-line quote closes the paragraph before it and opens another after,
    // and the quote comes back out as three blocks separated by bare `>`
    // lines — which then re-encode and grow again on the next save. For those,
    // fall through to the parser's own (lossy) handling: losing the comment
    // once beats a file that gains two lines every time it is written.
    const quote = /^>\s*/.exec(trimmed)
    if (quote !== null) {
      const previous = lines[index - 1] ?? ''
      const next = lines[index + 1] ?? ''
      if (/^\s*>/.test(previous) || /^\s*>/.test(next)) {
        return line
      }
      const payload = trimmed.slice(quote[0].length)
      if (payload === '' || !isOpaqueLine(payload)) {
        return line
      }
      return `${indent}${quote[0]}${MARKER_START}${encodeURIComponent(payload)}${MARKER_END}`
    }

    if (trimmed === '' || !isOpaqueLine(trimmed)) {
      return line
    }

    return `${indent}${MARKER_START}${encodeURIComponent(trimmed)}${MARKER_END}`
  })

  return encoded.join('\n')
}

export const RawHtmlLineExtension = Node.create({
  name: 'rawHtmlLine',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      value: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-raw-html-line]',
        getAttrs: (element) => ({ value: (element as HTMLElement).textContent || '' }),
      },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-raw-html-line': '',
        contenteditable: 'false',
        class: 'raw-html-line',
        title: 'Khối định dạng đặc biệt (chỉ sửa được ở Raw view)',
      }),
      (node.attrs.value as string) || '',
    ]
  },

  markdownTokenName: 'rawHtmlLine',

  markdownTokenizer: {
    name: 'rawHtmlLine',
    level: 'block',
    start(src) {
      const index = src.indexOf(MARKER_START)
      return index === -1 ? -1 : index
    },
    tokenize(src) {
      const match = MARKER_REGEX.exec(src)
      if (!match) {
        return undefined
      }
      try {
        return {
          type: 'rawHtmlLine',
          raw: match[0],
          value: (match[1] ?? '') + decodeURIComponent(match[2] ?? ''),
        }
      } catch {
        return undefined
      }
    },
  },

  parseMarkdown: (token, helpers) => {
    return helpers.createNode('rawHtmlLine', { value: token.value || '' })
  },

  renderMarkdown: (node) => (node.attrs?.value as string) || '',
})
