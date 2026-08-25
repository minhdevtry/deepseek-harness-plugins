/**
 * RFC 4180 compliant CSV / TSV character parser.
 *
 * Implemented as a state machine rather than a line-splitting regex so that:
 * 1. Newlines within quoted cells are preserved as cell content rather than
 *    prematurely breaking the row.
 * 2. Escaped quotes ("") within quoted cells are decoded into single quotes (").
 */

export function parseCsv(text: string, delimiter: string = ','): string[][] {
  if (!text || text.trim().length === 0) return []

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let insideQuote = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (char === '"') {
      if (insideQuote) {
        if (i + 1 < text.length && text[i + 1] === '"') {
          // Escaped quote: "" -> "
          currentCell += '"'
          i += 1
        } else {
          // Closing quote
          insideQuote = false
        }
      } else {
        // Opening quote
        insideQuote = true
      }
    } else if (char === delimiter && !insideQuote) {
      currentRow.push(currentCell)
      currentCell = ''
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      // Handle CRLF or LF
      if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
        i += 1
      }
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ''
    } else {
      currentCell += char
    }
  }

  // Push pending cell and row
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell)
    rows.push(currentRow)
  }

  // Filter out trailing empty row if the text ended with a newline
  if (rows.length > 0) {
    const lastRow = rows[rows.length - 1]
    if (lastRow && lastRow.length === 1 && lastRow[0] === '' && (text.endsWith('\n') || text.endsWith('\r'))) {
      rows.pop()
    }
  }

  return rows
}
