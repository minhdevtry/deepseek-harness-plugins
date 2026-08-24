/**
 * A markdown table renderer that skips column-alignment padding.
 *
 * `@tiptap/extension-table`'s own `renderMarkdown` pads every cell to the
 * widest cell in its column (and the separator row's dash count follows
 * suit), which is valid GFM but explodes file size on any table with a wide
 * cell: one 300-character link list in a single row inflates every other
 * row in that column by the same 300 characters. Measured on a real
 * project doc with ~1300 linked cells: 125KB -> 301KB, a 2.4x bloat, for
 * output that renders identically. This renders the same cells with a
 * single space of padding, matching how most hand- and machine-written
 * markdown tables already look (including the docs that motivated this).
 */
import type { JSONContent, MarkdownRendererHelpers } from '@tiptap/core'

const CELL_LINE_SEPARATOR = ''

type CellAlign = 'left' | 'right' | 'center' | null

function alignOf(attrs: Record<string, unknown> | null | undefined): CellAlign {
  const align = attrs?.align
  return align === 'left' || align === 'right' || align === 'center' ? align : null
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

type Cell = { text: string; isHeader: boolean; align: CellAlign }

function renderCell(cellNode: JSONContent, helpers: MarkdownRendererHelpers): Cell {
  const content = cellNode.content
  let raw: string
  if (Array.isArray(content) && content.length > 1) {
    raw = content.map((child) => helpers.renderChildren(child as unknown as JSONContent)).join(CELL_LINE_SEPARATOR)
  } else {
    raw = content ? helpers.renderChildren(content as unknown as JSONContent[]) : ''
  }
  // Cells stay on one line; line breaks become <br> (the parser turns <br> back into hard breaks).
  const text = collapseWhitespace(raw.split(CELL_LINE_SEPARATOR).join('\n').replace(/[ \t]*\r?\n[ \t]*/g, '<br>'))
  return { text, isHeader: cellNode.type === 'tableHeader', align: alignOf(cellNode.attrs) }
}

export function renderCompactTableMarkdown(node: JSONContent, helpers: MarkdownRendererHelpers): string {
  if (!node.content || node.content.length === 0) {
    return ''
  }

  const rows: Cell[][] = node.content.map((rowNode) => (rowNode.content ?? []).map((cellNode) => renderCell(cellNode, helpers)))

  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0)
  if (columnCount === 0) {
    return ''
  }

  const columnAlign: CellAlign[] = Array.from({ length: columnCount }, (_, i) => {
    for (const row of rows) {
      if (row[i]?.align) return row[i].align
    }
    return null
  })

  const headerRow = rows[0] ?? []
  const hasHeader = headerRow.some((cell) => cell.isHeader)
  const headerTexts = Array.from({ length: columnCount }, (_, i) => (hasHeader ? headerRow[i]?.text || '' : ''))

  const separatorCell = (align: CellAlign): string => {
    if (align === 'left') return ':---'
    if (align === 'right') return '---:'
    if (align === 'center') return ':---:'
    return '---'
  }

  const lines = [
    `| ${headerTexts.join(' | ')} |`,
    `| ${columnAlign.map(separatorCell).join(' | ')} |`,
  ]

  const body = hasHeader ? rows.slice(1) : rows
  for (const row of body) {
    lines.push(`| ${Array.from({ length: columnCount }, (_, i) => row[i]?.text || '').join(' | ')} |`)
  }

  return `\n${lines.join('\n')}\n`
}
