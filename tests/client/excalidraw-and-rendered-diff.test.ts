import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' })
globalThis.window = dom.window as any
globalThis.document = dom.window.document as any
globalThis.HTMLElement = dom.window.HTMLElement as any
globalThis.Element = dom.window.Element as any
globalThis.Node = dom.window.Node as any
globalThis.DOMParser = dom.window.DOMParser as any
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window) as any

import {
  parseExcalidrawScene,
  serializeExcalidrawScene,
  renderExcalidrawToSvg,
  type ExcalidrawScene,
  type ExcalidrawElement,
} from '../../src/client/excalidraw/excalidrawScene.ts'

import { alignBlocks, type BlockItem } from '../../src/client/diff/blockDiff.ts'

describe('Excalidraw Scene Processing (Task 10)', () => {
  test('parseExcalidrawScene safely parses valid and invalid scenes', () => {
    const raw = JSON.stringify({
      type: 'excalidraw',
      version: 2,
      elements: [
        {
          id: 'elem-1',
          type: 'rectangle',
          x: 10,
          y: 20,
          width: 100,
          height: 60,
          strokeColor: '#000000',
          backgroundColor: '#ff0000',
        },
      ],
      appState: { viewBackgroundColor: '#ffffff' },
    })

    const parsed = parseExcalidrawScene(raw)
    assert.ok(parsed)
    assert.equal(parsed.elements.length, 1)
    assert.equal(parsed.elements[0]?.id, 'elem-1')
    assert.equal(parsed.elements[0]?.type, 'rectangle')

    // Corrupted input
    const invalid = parseExcalidrawScene('this is not json')
    assert.equal(invalid, null)

    // Empty input returns empty scene
    const empty = parseExcalidrawScene('')
    assert.ok(empty)
    assert.equal(empty.elements.length, 0)
  })

  test('renderExcalidrawToSvg generates valid SVG markup with shapes and text', () => {
    const scene: ExcalidrawScene = {
      type: 'excalidraw',
      version: 2,
      elements: [
        {
          id: 'box1',
          type: 'rectangle',
          x: 50,
          y: 50,
          width: 120,
          height: 80,
          strokeColor: '#1e293b',
          backgroundColor: '#e2e8f0',
        },
        {
          id: 'circle1',
          type: 'ellipse',
          x: 200,
          y: 50,
          width: 80,
          height: 80,
          strokeColor: '#2563eb',
          backgroundColor: '#dbeafe',
        },
        {
          id: 'label1',
          type: 'text',
          x: 60,
          y: 80,
          width: 100,
          height: 20,
          strokeColor: '#0f172a',
          backgroundColor: 'transparent',
          text: 'Hello Excalidraw',
          fontSize: 16,
        },
      ],
      appState: { viewBackgroundColor: '#ffffff' },
    }

    const svg = renderExcalidrawToSvg(scene)
    assert.ok(svg.startsWith('<svg'))
    assert.ok(svg.includes('Hello Excalidraw'))
    assert.ok(svg.includes('<rect'))
    assert.ok(svg.includes('<ellipse'))
    assert.ok(svg.endsWith('</svg>'))
  })

  test('serializeExcalidrawScene rounds trip properly', () => {
    const scene: ExcalidrawScene = {
      type: 'excalidraw',
      version: 2,
      elements: [
        {
          id: 'diamond1',
          type: 'diamond',
          x: 100,
          y: 100,
          width: 60,
          height: 60,
          strokeColor: '#10b981',
          backgroundColor: '#d1fae5',
        },
      ],
      appState: { viewBackgroundColor: '#fafafa' },
    }

    const serialized = serializeExcalidrawScene(scene)
    const reparsed = parseExcalidrawScene(serialized)
    assert.ok(reparsed)
    assert.equal(reparsed.elements.length, 1)
    assert.equal(reparsed.elements[0]?.type, 'diamond')
  })
})

describe('Block Diff & LCS Alignment (Task 10)', () => {
  test('alignBlocks detects identical blocks, additions and deletions', () => {
    const before: BlockItem[] = [
      { key: 'p:Alpha', from: 0, to: 10 },
      { key: 'p:Beta', from: 10, to: 20 },
      { key: 'p:Gamma', from: 20, to: 30 },
    ]

    const after: BlockItem[] = [
      { key: 'p:Alpha', from: 0, to: 10 },
      { key: 'p:Beta-Updated', from: 10, to: 25 },
      { key: 'p:Gamma', from: 25, to: 35 },
      { key: 'p:Delta-New', from: 35, to: 45 },
    ]

    const ops = alignBlocks(before, after)
    // Should have:
    // 'same' for Alpha
    // 'del' for Beta, 'ins' for Beta-Updated
    // 'same' for Gamma
    // 'ins' for Delta-New
    const sameOps = ops.filter(op => op.type === 'same')
    const delOps = ops.filter(op => op.type === 'del')
    const insOps = ops.filter(op => op.type === 'ins')

    assert.equal(sameOps.length, 2)
    assert.equal(delOps.length, 1)
    assert.equal(insOps.length, 2)
  })
})
