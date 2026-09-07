import type { Node as PmNode } from '@tiptap/pm/model'

export type ResolveConfidence = 'exact' | 'same-type-ordinal' | 'ordinal' | 'clamped'

export interface BlockAnchor {
  blockIndex: number
  kind: string
  content: string
  selectionInBlock?: number
}

export interface ResolvedPosition {
  blockStart: number
  blockEnd: number
  point: number
  line: number
  confidence: ResolveConfidence
}

export interface DocSnapshot {
  source: string
  doc: PmNode
}

export interface CaptureOptions {
  refine?: boolean
}

export interface ModeSwitchPositionResolver {
  captureFromWysiwyg(doc: PmNode, pos: number, opts?: CaptureOptions): BlockAnchor | null
  captureFromSource(source: string, fullOffset: number, opts?: CaptureOptions): BlockAnchor | null
  resolveInSource(anchor: BlockAnchor, snapshot: DocSnapshot): ResolvedPosition | null
  resolveInWysiwyg(anchor: BlockAnchor, snapshot: DocSnapshot): ResolvedPosition | null
}

interface SourceBlock {
  blockIndex: number
  startLine: number
  endLine: number
  startOffset: number
  endOffset: number
  kind: string
  text: string
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(value, hi))
}

function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * Splits markdown source text into structural top-level blocks.
 */
export function computeSourceBlocks(source: string): SourceBlock[] {
  const lines = source.split('\n')
  const blocks: SourceBlock[] = []

  let currentBlockLines: string[] = []
  let blockStartLine = 1
  let blockStartOffset = 0
  let currentOffset = 0
  let inFencedCode = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineLen = line.length + 1 // +1 for \n

    if (line.trim().startsWith('```')) {
      inFencedCode = !inFencedCode
      currentBlockLines.push(line)
      if (!inFencedCode) {
        // End of code block
        const blockText = currentBlockLines.join('\n')
        blocks.push({
          blockIndex: blocks.length,
          startLine: blockStartLine,
          endLine: i + 1,
          startOffset: blockStartOffset,
          endOffset: currentOffset + line.length,
          kind: 'codeBlock',
          text: blockText,
        })
        currentBlockLines = []
        blockStartLine = i + 2
        blockStartOffset = currentOffset + lineLen
      }
    } else if (inFencedCode) {
      currentBlockLines.push(line)
    } else if (line.trim() === '') {
      if (currentBlockLines.length > 0) {
        const blockText = currentBlockLines.join('\n')
        const firstLine = currentBlockLines[0]!.trim()
        let kind = 'paragraph'
        if (firstLine.startsWith('#')) kind = 'heading'
        else if (firstLine.startsWith('>')) kind = 'blockquote'
        else if (/^[-*+]\s+/.test(firstLine) || /^\d+\.\s+/.test(firstLine)) kind = 'list'
        else if (firstLine.startsWith('|')) kind = 'table'

        blocks.push({
          blockIndex: blocks.length,
          startLine: blockStartLine,
          endLine: i,
          startOffset: blockStartOffset,
          endOffset: currentOffset - 1,
          kind,
          text: blockText,
        })
        currentBlockLines = []
      }
      blockStartLine = i + 2
      blockStartOffset = currentOffset + lineLen
    } else {
      if (currentBlockLines.length === 0) {
        blockStartLine = i + 1
        blockStartOffset = currentOffset
      }
      currentBlockLines.push(line)
    }

    currentOffset += lineLen
  }

  if (currentBlockLines.length > 0) {
    const blockText = currentBlockLines.join('\n')
    const firstLine = currentBlockLines[0]!.trim()
    let kind = 'paragraph'
    if (firstLine.startsWith('#')) kind = 'heading'
    else if (firstLine.startsWith('>')) kind = 'blockquote'
    else if (/^[-*+]\s+/.test(firstLine) || /^\d+\.\s+/.test(firstLine)) kind = 'list'
    else if (firstLine.startsWith('|')) kind = 'table'

    blocks.push({
      blockIndex: blocks.length,
      startLine: blockStartLine,
      endLine: lines.length,
      startOffset: blockStartOffset,
      endOffset: source.length,
      kind,
      text: blockText,
    })
  }

  return blocks
}

export function createModeSwitchPositionResolver(): ModeSwitchPositionResolver {
  return {
    captureFromWysiwyg(doc, pos, opts) {
      if (doc.childCount === 0) return null
      const p = clamp(pos, 0, doc.content.size)

      let acc = 0
      let blockIndex = doc.childCount - 1
      let blockContentStart = 0

      for (let i = 0; i < doc.childCount; i++) {
        const child = doc.child(i)
        const size = child.nodeSize
        if (p < acc + size) {
          blockIndex = i
          blockContentStart = acc + 1
          break
        }
        acc += size
        blockContentStart = acc + 1
      }

      const node = doc.child(blockIndex)
      const anchor: BlockAnchor = {
        blockIndex,
        kind: node.type.name,
        content: node.textContent,
      }

      if (opts?.refine) {
        anchor.selectionInBlock = Math.max(0, p - blockContentStart)
      }

      return anchor
    },

    captureFromSource(source, fullOffset, opts) {
      const blocks = computeSourceBlocks(source)
      if (blocks.length === 0) return null

      const offset = clamp(fullOffset, 0, source.length)
      let foundBlock = blocks[blocks.length - 1]!

      for (const block of blocks) {
        if (offset >= block.startOffset && offset <= block.endOffset + 1) {
          foundBlock = block
          break
        }
      }

      const anchor: BlockAnchor = {
        blockIndex: foundBlock.blockIndex,
        kind: foundBlock.kind,
        content: foundBlock.text,
      }

      if (opts?.refine) {
        anchor.selectionInBlock = Math.max(0, offset - foundBlock.startOffset)
      }

      return anchor
    },

    resolveInSource(anchor, snapshot) {
      const blocks = computeSourceBlocks(snapshot.source)
      if (blocks.length === 0) return null

      // Tier 1: Exact text match
      const exactMatch = blocks.find(
        (b) => normalizeText(b.text) === normalizeText(anchor.content),
      )
      if (exactMatch) {
        const point =
          anchor.selectionInBlock !== undefined
            ? clamp(
                exactMatch.startOffset + anchor.selectionInBlock,
                exactMatch.startOffset,
                exactMatch.endOffset,
              )
            : exactMatch.startOffset
        return {
          blockStart: exactMatch.startOffset,
          blockEnd: exactMatch.endOffset,
          point,
          line: exactMatch.startLine,
          confidence: 'exact',
        }
      }

      // Tier 2: Same-type ordinal match
      const inRange = anchor.blockIndex >= 0 && anchor.blockIndex < blocks.length
      if (inRange && blocks[anchor.blockIndex]!.kind === anchor.kind) {
        const b = blocks[anchor.blockIndex]!
        return {
          blockStart: b.startOffset,
          blockEnd: b.endOffset,
          point: b.startOffset,
          line: b.startLine,
          confidence: 'same-type-ordinal',
        }
      }

      // Tier 3: Ordinal match
      if (inRange) {
        const b = blocks[anchor.blockIndex]!
        return {
          blockStart: b.startOffset,
          blockEnd: b.endOffset,
          point: b.startOffset,
          line: b.startLine,
          confidence: 'ordinal',
        }
      }

      // Tier 4: Clamped fallback
      const clampedIdx = clamp(anchor.blockIndex, 0, blocks.length - 1)
      const b = blocks[clampedIdx]!
      return {
        blockStart: b.startOffset,
        blockEnd: b.endOffset,
        point: b.startOffset,
        line: b.startLine,
        confidence: 'clamped',
      }
    },

    resolveInWysiwyg(anchor, snapshot) {
      const { doc } = snapshot
      if (doc.childCount === 0) return null

      let acc = 0
      const nodeSpans: { index: number; from: number; to: number; node: PmNode }[] = []
      for (let i = 0; i < doc.childCount; i++) {
        const node = doc.child(i)
        nodeSpans.push({
          index: i,
          from: acc,
          to: acc + node.nodeSize,
          node,
        })
        acc += node.nodeSize
      }

      // Tier 1: Exact text match
      const exact = nodeSpans.find(
        (s) => normalizeText(s.node.textContent) === normalizeText(anchor.content),
      )
      if (exact) {
        const point =
          anchor.selectionInBlock !== undefined
            ? clamp(exact.from + 1 + anchor.selectionInBlock, exact.from, exact.to)
            : exact.from + 1
        return {
          blockStart: exact.from,
          blockEnd: exact.to,
          point,
          line: exact.index + 1,
          confidence: 'exact',
        }
      }

      // Tier 2: Same-type ordinal match
      const inRange = anchor.blockIndex >= 0 && anchor.blockIndex < doc.childCount
      if (inRange && doc.child(anchor.blockIndex).type.name === anchor.kind) {
        const span = nodeSpans[anchor.blockIndex]!
        return {
          blockStart: span.from,
          blockEnd: span.to,
          point: span.from + 1,
          line: span.index + 1,
          confidence: 'same-type-ordinal',
        }
      }

      // Tier 3: Ordinal match
      if (inRange) {
        const span = nodeSpans[anchor.blockIndex]!
        return {
          blockStart: span.from,
          blockEnd: span.to,
          point: span.from + 1,
          line: span.index + 1,
          confidence: 'ordinal',
        }
      }

      // Tier 4: Clamped fallback
      const clampedIdx = clamp(anchor.blockIndex, 0, doc.childCount - 1)
      const span = nodeSpans[clampedIdx]!
      return {
        blockStart: span.from,
        blockEnd: span.to,
        point: span.from + 1,
        line: span.index + 1,
        confidence: 'clamped',
      }
    },
  }
}
