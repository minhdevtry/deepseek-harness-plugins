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

import { Editor } from '@tiptap/core'
import { documentExtensions } from '../src/client/tiptap/extensions.ts'

describe('Image & Code Block Extensions (Task 7)', () => {
  function createTestEditor(md: string): Editor {
    return new Editor({
      element: document.createElement('div'),
      extensions: documentExtensions(),
      content: md,
      contentType: 'markdown',
    })
  }

  test('RichImage parses and serializes image attributes accurately', () => {
    const md = '![Diagram caption](https://example.com/diagram.png "Architecture Diagram")'
    const editor = createTestEditor(md)
    try {
      let imageFound = false
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'richImage' || node.type.name === 'image') {
          imageFound = true
          assert.equal(node.attrs.src, 'https://example.com/diagram.png')
          assert.equal(node.attrs.alt, 'Diagram caption')
          assert.equal(node.attrs.title, 'Architecture Diagram')
          return false
        }
        return true
      })
      assert.equal(imageFound, true)
    } finally {
      editor.destroy()
    }
  })

  test('CodeBlock parses language and preserves code text intact', () => {
    const code = '<div class="card"><h1>Hello Sandbox</h1></div>'
    const md = `\`\`\`html\n${code}\n\`\`\``
    const editor = createTestEditor(md)
    try {
      let codeBlockFound = false
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'codeBlock') {
          codeBlockFound = true
          assert.equal(node.attrs.language, 'html')
          assert.equal(node.textContent.trim(), code)
          return false
        }
        return true
      })
      assert.equal(codeBlockFound, true)
    } finally {
      editor.destroy()
    }
  })
})
