import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
;(globalThis as any).window = dom.window
;(globalThis as any).document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
for (const k of [
  'HTMLElement',
  'Element',
  'Node',
  'DOMParser',
  'getComputedStyle',
  'MutationObserver',
  'Range',
  'NodeFilter',
]) {
  ;(globalThis as any)[k] = (dom.window as any)[k]
}

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import {
  createModeSwitchPositionResolver,
  type BlockAnchor,
} from '../src/client/workbench/modeSwitchPositionResolver.ts'

test('modeSwitchPositionResolver: captures from WYSIWYG and resolves in Source with exact confidence', () => {
  const markdownSource = `# Heading One\n\nFirst paragraph with some text.\n\nSecond paragraph.`
  const editor = new Editor({
    extensions: [StarterKit],
    content: `<h1>Heading One</h1><p>First paragraph with some text.</p><p>Second paragraph.</p>`,
  })

  const resolver = createModeSwitchPositionResolver()

  // Place cursor in second block ("First paragraph with some text.")
  // Block 0: h1 (size ~13), Block 1: p (starts around pos 14)
  const posInSecondBlock = 16
  const anchor = resolver.captureFromWysiwyg(editor.state.doc, posInSecondBlock, { refine: true })

  assert.ok(anchor, 'Should capture BlockAnchor from WYSIWYG')
  assert.equal(anchor.blockIndex, 1)
  assert.equal(anchor.kind, 'paragraph')
  assert.equal(anchor.content, 'First paragraph with some text.')

  // Resolve in Source
  const resolved = resolver.resolveInSource(anchor, {
    source: markdownSource,
    doc: editor.state.doc,
  })

  assert.ok(resolved, 'Should resolve position in Source')
  assert.equal(resolved.confidence, 'exact')
  assert.ok(resolved.point > 0, 'Should have positive point offset')
  assert.ok(resolved.line >= 3, 'Should resolve to line 3 (paragraphs start on line 3)')

  editor.destroy()
})

test('modeSwitchPositionResolver: handles clamped fallback when target block index is out of range', () => {
  const markdownSource = `# Only One Heading`
  const editor = new Editor({
    extensions: [StarterKit],
    content: `<h1>Only One Heading</h1>`,
  })

  const resolver = createModeSwitchPositionResolver()
  const outOfRangeAnchor: BlockAnchor = {
    blockIndex: 99,
    kind: 'paragraph',
    content: 'Non-existent block',
  }

  const resolved = resolver.resolveInSource(outOfRangeAnchor, {
    source: markdownSource,
    doc: editor.state.doc,
  })

  assert.ok(resolved, 'Should resolve with clamped fallback')
  assert.equal(resolved.confidence, 'clamped')
  assert.equal(resolved.line, 1)

  editor.destroy()
})

test('modeSwitchPositionResolver: captures from Source and resolves in WYSIWYG', () => {
  const markdownSource = `# Title\n\nLine 1\n\nLine 2`
  const editor = new Editor({
    extensions: [StarterKit],
    content: `<h1>Title</h1><p>Line 1</p><p>Line 2</p>`,
  })

  const resolver = createModeSwitchPositionResolver()
  // Offset into "Line 2"
  const offset = markdownSource.indexOf('Line 2')
  const anchor = resolver.captureFromSource(markdownSource, offset, { refine: true })

  assert.ok(anchor, 'Should capture BlockAnchor from Source')
  assert.equal(anchor.blockIndex, 2)
  assert.equal(anchor.content, 'Line 2')

  const resolvedWysiwyg = resolver.resolveInWysiwyg(anchor, {
    source: markdownSource,
    doc: editor.state.doc,
  })

  assert.ok(resolvedWysiwyg, 'Should resolve in WYSIWYG')
  assert.equal(resolvedWysiwyg.confidence, 'exact')
  assert.ok(resolvedWysiwyg.point > 0)

  editor.destroy()
})
