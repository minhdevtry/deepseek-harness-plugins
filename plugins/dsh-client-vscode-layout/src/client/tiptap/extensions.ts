/**
 * The editor's extension set — one list, shared by the live editor and by the
 * headless round-trip machinery in `markdown.ts`.
 *
 * Sharing matters: the fidelity guarantees in `markdown.ts` are only true of
 * the schema the editor actually runs. Two lists would drift, and the drift
 * would show up as files being rewritten differently from how they were read.
 *
 * `lowlight` is loaded with `common` (~35 languages), not `all` (~190). `all`
 * costs +296 KB gzip for code fences *inside documents*, while the code editor
 * already carries its own CodeMirror grammars — measured, not assumed.
 */
import type { Extensions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Code } from '@tiptap/extension-code'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list'
import { Highlight } from '@tiptap/extension-highlight'
import { Image } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Underline } from '@tiptap/extension-underline'
import { Youtube } from '@tiptap/extension-youtube'
import { TextAlign } from '@tiptap/extension-text-align'
import { Typography } from '@tiptap/extension-typography'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { CharacterCount } from '@tiptap/extension-character-count'
import { Dropcursor } from '@tiptap/extension-dropcursor'
import { createLowlight, common } from 'lowlight'
import { Markdown } from '@tiptap/markdown'
import { renderCompactTableMarkdown } from './table/compactTableMarkdown.ts'
import { Callout } from './Callout.ts'
import { CalloutDecorations } from './callouts/CalloutDecorations.ts'
import { Details, DetailsSummary, DetailsContent } from './details/Details.ts'
import { RichCodeBlockLowlight } from './codeblock/CodeBlockExtension.ts'
import { MermaidExtension } from './mermaid/MermaidExtension.tsx'
import { MathBlockExtension } from './math/MathExtension.tsx'
import { HeadingFoldExtension } from './headingFold/HeadingFoldPlugin.ts'
import { RichImageExtension } from './image/ImageViewExtension.tsx'
import { RawHtmlLineExtension } from './html/rawHtmlLine.ts'

/** Shared highlighter; building it per editor would re-register every grammar. */
const lowlight = createLowlight(common)

/**
 * The default Code mark excludes every other mark (`excludes: '_'`), which
 * drops the enclosing Link mark when parsing `` [`label`](url) `` — a common
 * convention for linking to code identifiers, file paths, and package names.
 * Markdown supports a linked code label, so Code must stay exclusive with
 * text formatting only, not with Link.
 */
const RichCode = Code.extend({ excludes: 'code bold italic strike underline' })

/**
 * The stock Table markdown renderer pads every cell to its column's widest
 * cell (and stretches the separator row's dashes to match), which is valid
 * GFM but explodes file size when one cell is much longer than its
 * neighbors — measured on a real doc with long linked cells: 125KB -> 301KB
 * for output that renders identically. This keeps everything else (parsing,
 * node views, commands) and only swaps the renderer for one that emits
 * single-space-padded cells, matching how these tables were actually authored.
 */
const CompactTable = Table.extend({
  renderMarkdown: (node, helpers) => renderCompactTableMarkdown(node, helpers),
})

/**
 * The stock TextStyle mark has no Markdown serializer.
 * This preserves text color on Markdown roundtrip via `<span style="color: ...">`.
 */
const RichTextStyle = TextStyle.extend({
  renderMarkdown: (mark, helpers) => {
    const styleAttrs: string[] = []
    if (mark.attrs?.color) {
      styleAttrs.push(`color: ${mark.attrs.color}`)
    }
    if (styleAttrs.length === 0) {
      return helpers.renderChildren(mark)
    }
    return `<span style="${styleAttrs.join('; ')}">${helpers.renderChildren(mark)}</span>`
  },
})

/**
 * The stock Highlight mark renders `==text==` but loses custom color attributes.
 * This renders standard `==text==` for default highlight and `<mark style="...">` for custom colors.
 */
const RichHighlight = Highlight.extend({
  renderMarkdown: (mark, helpers) => {
    const color = mark.attrs?.color
    if (color) {
      return `<mark style="background-color: ${color}">${helpers.renderChildren(mark)}</mark>`
    }
    return `==${helpers.renderChildren(mark)}==`
  },
})

/**
 * Build the extension list.
 * @returns the extensions, in a fixed order.
 */
export function documentExtensions(): Extensions {
  return [
    StarterKit.configure({
      // Replaced below by the lowlight variant, which is the same node with
      // syntax highlighting; leaving both registers the name twice.
      codeBlock: false,
      // StarterKit ships Link in v3; configuring it here
      // instead keeps one registration per name.
      link: false,
      underline: false,
      dropcursor: false,
      // Replaced below by RichCode, which relaxes `excludes` to keep code
      // labels linkable; leaving both registers the name twice.
      code: false,
    }),
    RichCode,
    RichCodeBlockLowlight.configure({ lowlight }),
    Link.configure({ openOnClick: false, autolink: true }),
    Underline,
    RichTextStyle,
    Color,
    RichHighlight.configure({ multicolor: true }),
    CharacterCount,
    Dropcursor.configure({ color: 'var(--dsw-alias-state-business-primary, #3b82f6)', width: 2 }),
    Callout,
    CalloutDecorations,
    Details,
    DetailsSummary,
    DetailsContent,
    RawHtmlLineExtension,
    HeadingFoldExtension,
    MermaidExtension,
    MathBlockExtension,
    RichImageExtension,
    Image,
    Youtube.configure({
      inline: false,
      nocookie: false,
      allowFullscreen: true,
      autoplay: false,
      controls: true,
      HTMLAttributes: {
        class: 'tiptap-youtube-video',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
        allowfullscreen: 'true',
        referrerpolicy: 'no-referrer-when-downgrade',
      },
    }),
    CompactTable.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Typography,
    Markdown,
  ]
}
