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
const MARKER_START = 'RAW_HTML_LINE'
const MARKER_END = ''

// One or more complete tags back to back with nothing else on the line, e.g.
// `<a id="x"></a>` (an anchor's open+close tag both land on one line) or
// a lone `<br>`. Anything with real text alongside a tag isn't "line-only".
function isLineOnlyHtml(trimmed: string): boolean {
  if (!trimmed.startsWith('<')) {
    return false
  }
  if (trimmed.startsWith('<!--')) {
    return trimmed.endsWith('-->')
  }
  return /^(?:<\/?[A-Za-z][\w.:-]*(?:\s[^<>]*?)?\/?>)+$/.test(trimmed)
}

/**
 * Replace every line outside a fenced code block whose trimmed content is a
 * single complete HTML comment or tag with an opaque marker run. Call this on
 * raw source text before it reaches an editor built from `documentExtensions`
 * — `RawHtmlLineExtension`'s tokenizer decodes the marker back on parse.
 */
export function encodeRawHtmlLines(source: string): string {
  const lines = source.split('\n')
  let activeFence: '`' | '~' | null = null
  let activeFenceLength = 0

  const encoded = lines.map((line) => {
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
    if (trimmed === '' || !isLineOnlyHtml(trimmed)) {
      return line
    }

    const indent = line.slice(0, line.length - line.trimStart().length)
    return `${indent}${MARKER_START}${encodeURIComponent(trimmed)}${MARKER_END}`
  })

  return encoded.join('\n')
}

function decodeMarker(src: string): { raw: string; value: string } | null {
  if (!src.startsWith(MARKER_START)) {
    return null
  }
  const endIndex = src.indexOf(MARKER_END, MARKER_START.length)
  if (endIndex === -1) {
    return null
  }
  const encoded = src.slice(MARKER_START.length, endIndex)
  try {
    return {
      raw: src.slice(0, endIndex + MARKER_END.length),
      value: decodeURIComponent(encoded),
    }
  } catch {
    return null
  }
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
      if (!src.startsWith(MARKER_START)) {
        return undefined
      }
      const decoded = decodeMarker(src)
      if (!decoded) {
        return undefined
      }
      return {
        type: 'rawHtmlLine',
        raw: decoded.raw,
        value: decoded.value,
      }
    },
  },

  parseMarkdown: (token, helpers) => {
    return helpers.createNode('rawHtmlLine', { value: token.value || '' })
  },

  renderMarkdown: (node) => (node.attrs?.value as string) || '',
})
