import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
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
import { executeAddBlockBelow } from '../src/client/tiptap/dragHandle/gutterActions.ts'

import { fileURLToPath } from 'node:url'

test('TipTapEditor.module.css: contains 3-column named CSS Grid tokens and ask-composer-height inset', () => {
  const currentFile = fileURLToPath(import.meta.url)
  const currentDir = path.dirname(currentFile)
  const cssPath = path.resolve(currentDir, '../src/client/tiptap/TipTapEditor.module.css')
  const cssContent = fs.readFileSync(cssPath, 'utf8')

  assert.ok(cssContent.includes('[full-start]'), 'Must declare [full-start] grid line')
  assert.ok(cssContent.includes('[content-start]'), 'Must declare [content-start] grid line')
  assert.ok(cssContent.includes('[content-end]'), 'Must declare [content-end] grid line')
  assert.ok(cssContent.includes('[full-end]'), 'Must declare [full-end] grid line')
  assert.ok(cssContent.includes('--content-max-width'), 'Must declare --content-max-width (1024px)')
  assert.ok(cssContent.includes('--ask-composer-height'), 'Must declare --ask-composer-height inset')
  assert.ok(cssContent.includes('grid-column: full') || cssContent.includes('grid-column: full-start / full-end'), 'Must have breakout to full column')
})

test('GutterControls: executeAddBlockBelow inserts a new paragraph and triggers slash menu with "/"', () => {
  const editor = new Editor({
    extensions: [StarterKit],
    content: '<p>First line of text</p>',
  })

  const firstNode = editor.state.doc.firstChild
  assert.ok(firstNode, 'first node should exist')

  // Execute add block below the first paragraph
  executeAddBlockBelow(editor, 0, firstNode)

  // Document should now have two paragraphs, and the second should contain "/"
  assert.equal(editor.state.doc.childCount, 2, 'Should have 2 paragraphs')
  const secondNode = editor.state.doc.child(1)
  assert.equal(secondNode.type.name, 'paragraph')
  assert.equal(secondNode.textContent, '/', 'Should have inserted "/" to trigger slash menu')

  editor.destroy()
})
