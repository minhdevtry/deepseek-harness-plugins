import { useMemo } from 'react'
import { alignBlocks, type BlockItem, type AlignOp } from './blockDiff.ts'
import css from './RenderedDiffView.module.css'

export interface RenderedDiffViewProps {
  beforeText: string
  afterText: string
  path: string
}

function parseTextIntoBlocks(text: string): BlockItem[] {
  const lines = text.split('\n')
  const blocks: BlockItem[] = []
  let currentBlockLines: string[] = []
  let currentFrom = 0
  let currentPos = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineLen = line.length + 1 // including \n

    if (line.trim() === '') {
      if (currentBlockLines.length > 0) {
        const content = currentBlockLines.join('\n')
        blocks.push({
          from: currentFrom,
          to: currentPos,
          key: content.trim(),
        })
        currentBlockLines = []
      }
      currentPos += lineLen
      currentFrom = currentPos
    } else {
      currentBlockLines.push(line)
      currentPos += lineLen
    }
  }

  if (currentBlockLines.length > 0) {
    const content = currentBlockLines.join('\n')
    blocks.push({
      from: currentFrom,
      to: currentPos,
      key: content.trim(),
    })
  }

  return blocks
}

export function RenderedDiffView({ beforeText, afterText, path }: RenderedDiffViewProps) {
  const ops: AlignOp[] = useMemo(() => {
    const beforeBlocks = parseTextIntoBlocks(beforeText)
    const afterBlocks = parseTextIntoBlocks(afterText)
    return alignBlocks(beforeBlocks, afterBlocks)
  }, [beforeText, afterText])

  const { added, removed } = useMemo(() => {
    let insCount = 0
    let delCount = 0
    for (const op of ops) {
      if (op.type === 'ins') insCount++
      else if (op.type === 'del') delCount++
    }
    return { added: insCount, removed: delCount }
  }, [ops])

  return (
    <div className={css.container}>
      <div className={css.diffSummary}>
        <span>Visual Block Diff for <strong>{path.split(/[/\\]/).pop()}</strong></span>
        <span>·</span>
        <span className={css.badgeIns}>+{added} added blocks</span>
        <span>·</span>
        <span className={css.badgeDel}>−{removed} removed blocks</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ops.map((op, idx) => {
          if (op.type === 'same') {
            return (
              <div key={idx} className={css.blockUnchanged}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{op.b.key}</pre>
              </div>
            )
          }
          if (op.type === 'ins') {
            return (
              <div key={idx} className={css.blockIns}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{op.b.key}</pre>
              </div>
            )
          }
          return (
            <div key={idx} className={css.blockDel}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{op.a.key}</pre>
            </div>
          )
        })}
      </div>
    </div>
  )
}
