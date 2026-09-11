/**
 * Interactive CSV / TSV preview component.
 *
 * Renders structured table grid with sticky headers and search filter.
 */
import { useMemo, useState } from 'react'
import { parseCsv } from './csv.ts'
import css from './CsvPreview.module.css'

export { parseCsv }

export interface CsvPreviewProps {
  content: string
  isTsv?: boolean
  onToggleRaw: () => void
}

export function CsvPreview({ content, isTsv = false, onToggleRaw }: CsvPreviewProps) {
  const [filter, setFilter] = useState('')

  const data = useMemo(() => {
    return parseCsv(content, isTsv ? '\t' : ',')
  }, [content, isTsv])

  const headers = data[0] || []
  const rows = data.slice(1)

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (q.length === 0) return rows
    return rows.filter(row => row.some(cell => cell.toLowerCase().includes(q)))
  }, [rows, filter])

  return (
    <div className={css.wrap}>
      <div className={css.toolbar}>
        <input
          type="text"
          className={css.search}
          placeholder="Filter data..."
          value={filter}
          onChange={e => { setFilter(e.target.value) }}
        />
        <span className={css.count}>
          {filteredRows.length} of {rows.length} rows
        </span>
        <button type="button" className={css.toggleBtn} onClick={onToggleRaw}>
          💻 View Raw Source
        </button>
      </div>

      <div className={css.tableWrap}>
        <table className={css.table}>
          <thead>
            <tr>
              <th className={css.th} style={{ width: 40, textAlign: 'center' }}>#</th>
              {headers.map((h, i) => (
                <th key={`head-${i}`} className={css.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rIdx) => (
              <tr key={`row-${rIdx}`} className={css.tr}>
                <td className={css.td} style={{ color: '#94a3b8', textAlign: 'center' }}>
                  {rIdx + 1}
                </td>
                {row.map((cell, cIdx) => (
                  <td key={`cell-${rIdx}-${cIdx}`} className={css.td}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
