import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { diff } from '@codemirror/merge'
import { Editor } from '@tiptap/core'
import { documentExtensions } from './extensions.ts'
import { encodeRawHtmlLines } from './html/rawHtmlLine.ts'
import { splitFrontmatter } from './frontmatter/splitFrontmatter.ts'

export interface BlockInfo {
  index: number
  pos: number
  size: number
  node: ProseMirrorNode
  text: string
}

export interface BlockHunk {
  id: string
  fromA: number
  toA: number
  fromB: number
  toB: number
  fromPos: number
  toPos: number
  baseBlocks: string[]
  baseNodes?: ProseMirrorNode[] | undefined
  currentBlocks: string[]
  type: 'add' | 'delete' | 'replace'
}

/** Cache block text serialization per ProseMirror node instance */
const blockTextCache = new WeakMap<ProseMirrorNode, string>()

/**
 * Extract top-level block info from a ProseMirror document.
 */
export function getBlocks(doc: ProseMirrorNode): BlockInfo[] {
  const blocks: BlockInfo[] = []
  let pos = 0
  let index = 0

  doc.forEach((child) => {
    let text = blockTextCache.get(child)
    if (text === undefined) {
      text = serializeSingleBlock(child)
      blockTextCache.set(child, text)
    }

    blocks.push({
      index,
      pos,
      size: child.nodeSize,
      node: child,
      text,
    })

    pos += child.nodeSize
    index += 1
  })

  return blocks
}

/**
 * Serialize a single ProseMirror top-level node to a canonical text representation for diffing.
 */
export function serializeSingleBlock(node: ProseMirrorNode): string {
  // Combine node type with text content and relevant attributes (e.g. heading level, callout emoji)
  const typeName = node.type.name
  const attrs = node.attrs ? JSON.stringify(node.attrs) : ''
  const content = node.textContent
  return `${typeName}:${attrs}:${content}`
}

/**
 * Parse markdown into an array of canonical block strings and ProseMirror nodes.
 */
export function parseMarkdownToBlocks(markdown: string): { blocks: string[]; nodes: ProseMirrorNode[]; frontmatter: string } {
  const { frontmatter, body } = splitFrontmatter(markdown)
  const editor = new Editor({
    element: typeof document !== 'undefined' ? document.createElement('div') : null,
    extensions: documentExtensions(),
    content: encodeRawHtmlLines(body),
    contentType: 'markdown',
  })

  try {
    const doc = editor.state.doc
    const blocks: string[] = []
    const nodes: ProseMirrorNode[] = []
    doc.forEach((child) => {
      blocks.push(serializeSingleBlock(child))
      nodes.push(child)
    })
    return { blocks, nodes, frontmatter }
  } finally {
    editor.destroy()
  }
}

/**
 * Diff two block lists using @codemirror/merge's diff() with private-use character encoding.
 */
export function diffBlockArrays(
  baseBlocks: readonly string[],
  currentBlocks: readonly BlockInfo[],
  docSize: number,
  baseNodes?: readonly ProseMirrorNode[]
): BlockHunk[] {
  const idMap = new Map<string, string>()

  const encode = (blocks: readonly string[]): string => {
    return blocks.map((t) => {
      let c = idMap.get(t)
      if (c === undefined) {
        c = String.fromCharCode(0xe000 + idMap.size)
        idMap.set(t, c)
      }
      return c
    }).join('')
  }

  const baseEncoded = encode(baseBlocks)
  const currentEncoded = encode(currentBlocks.map((b) => b.text))

  const changes = diff(baseEncoded, currentEncoded)
  const hunks: BlockHunk[] = []

  for (let i = 0; i < changes.length; i++) {
    const ch = changes[i]!
    const fromA = ch.fromA
    const toA = ch.toA
    const fromB = ch.fromB
    const toB = ch.toB

    let fromPos = 0
    let toPos = 0

    if (currentBlocks.length === 0) {
      fromPos = 0
      toPos = 0
    } else if (fromB < currentBlocks.length) {
      fromPos = currentBlocks[fromB]!.pos
      if (toB > fromB) {
        const lastBlock = currentBlocks[toB - 1]!
        toPos = lastBlock.pos + lastBlock.size
      } else {
        toPos = fromPos
      }
    } else {
      fromPos = docSize
      toPos = docSize
    }

    const baseSlice = baseBlocks.slice(fromA, toA)
    const baseNodeSlice = baseNodes ? baseNodes.slice(fromA, toA) : undefined
    const currentSlice = currentBlocks.slice(fromB, toB).map((b) => b.text)

    const type: 'add' | 'delete' | 'replace' =
      fromA === toA ? 'add' : fromB === toB ? 'delete' : 'replace'

    hunks.push({
      id: `hunk-${i}-${fromA}-${toA}-${fromB}-${toB}`,
      fromA,
      toA,
      fromB,
      toB,
      fromPos,
      toPos,
      baseBlocks: baseSlice,
      baseNodes: baseNodeSlice,
      currentBlocks: currentSlice,
      type,
    })
  }

  return hunks
}
