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
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'
import { Markdown } from 'tiptap-markdown'
import { Callout } from './Callout.ts'
import { CalloutDecorations } from './callouts/CalloutDecorations.ts'
import { MermaidExtension } from './mermaid/MermaidExtension.tsx'
import { MathBlockExtension } from './math/MathExtension.tsx'
import { HeadingFoldExtension } from './headingFold/HeadingFoldPlugin.ts'
import { VideoEmbedExtension } from './video/VideoExtension.tsx'
import { RichImageExtension } from './image/ImageViewExtension.tsx'

/** Shared highlighter; building it per editor would re-register every grammar. */
const lowlight = createLowlight(common)

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
    }),
    CodeBlockLowlight.configure({ lowlight }),
    Link.configure({ openOnClick: false, autolink: true }),
    Underline,
    Highlight.configure({ multicolor: true }),
    Callout,
    CalloutDecorations,
    HeadingFoldExtension,
    MermaidExtension,
    MathBlockExtension,
    VideoEmbedExtension,
    RichImageExtension,
    Image,
    Youtube.configure({ controls: true, nocookie: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Typography,
    Markdown.configure({
      // `\n` between blocks rather than the library's tight default, and no
      // HTML passthrough: the serializer must emit markdown the parser can
      // read back identically (see markdown.ts).
      html: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ]
}
