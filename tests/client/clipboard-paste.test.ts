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
import Link from '@tiptap/extension-link'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import {
  detectLoneTrustedUrl,
} from '../../src/client/tiptap/clipboard/loneUrl.ts'
import {
  linkifySelection,
  insertVsCodeCodeBlock,
} from '../../src/client/tiptap/clipboard/handlePaste.ts'

test('detectLoneTrustedUrl: detects standalone valid URLs and normalizes bare domains', () => {
  assert.equal(detectLoneTrustedUrl('https://example.com/docs'), 'https://example.com/docs')
  assert.equal(detectLoneTrustedUrl('http://github.com/inkeep'), 'http://github.com/inkeep')
  assert.equal(detectLoneTrustedUrl('example.com/page'), 'https://example.com/page')
  assert.equal(detectLoneTrustedUrl('mailto:support@example.com'), 'mailto:support@example.com')

  // Rejections
  assert.equal(detectLoneTrustedUrl(''), null)
  assert.equal(detectLoneTrustedUrl('https://example.com and another word'), null)
  assert.equal(detectLoneTrustedUrl('javascript:alert(1)'), null)
  assert.equal(detectLoneTrustedUrl('some random prose text'), null)
})

test('linkifySelection: wraps non-empty text selection into a link mark without replacing text', () => {
  const editor = new Editor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: '<p>Click here to read documentation</p>',
  })

  // Select "here" (from pos 7 to 11)
  editor.commands.setTextSelection({ from: 7, to: 11 })
  assert.equal(editor.state.selection.empty, false)

  const success = linkifySelection(editor.view, 'https://example.com')
  assert.ok(success, 'linkifySelection should succeed')

  const json = editor.getJSON()
  const p = json.content?.[0]
  assert.ok(p?.content, 'paragraph should have content')

  // Verify text "here" has link mark
  const hereNode = p.content.find((c: any) => c.text === 'here')
  assert.ok(hereNode, '"here" node should exist')
  assert.equal(hereNode.marks?.[0]?.type, 'link')
  assert.equal(hereNode.marks?.[0]?.attrs?.href, 'https://example.com')

  editor.destroy()
})

test('insertVsCodeCodeBlock: parses vscode-editor-data and inserts codeBlock with correct language', () => {
  const lowlight = createLowlight(common)
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: '<p>Before</p>',
  })

  // Place caret at end
  editor.commands.setTextSelection(8)

  const vscodeMeta = JSON.stringify({ mode: 'typescript', version: 1 })
  const codeContent = 'const x: number = 42;'
  const success = insertVsCodeCodeBlock(editor.view, vscodeMeta, codeContent)
  assert.ok(success, 'insertVsCodeCodeBlock should succeed')

  const json = editor.getJSON()
  const codeNode = json.content?.find((c: any) => c.type === 'codeBlock')
  assert.ok(codeNode, 'codeBlock node should be created')
  assert.equal(codeNode.attrs?.language, 'typescript')
  assert.equal((codeNode.content?.[0] as any)?.text, 'const x: number = 42;')

  editor.destroy()
})
