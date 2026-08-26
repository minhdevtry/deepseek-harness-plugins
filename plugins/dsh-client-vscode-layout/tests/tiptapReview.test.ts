import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

// Bootstrap JSDOM environment for ProseMirror and TipTap in Node.js
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
})
globalThis.window = dom.window as any
globalThis.document = dom.window.document as any
globalThis.HTMLElement = dom.window.HTMLElement as any
globalThis.Element = dom.window.Element as any
globalThis.Node = dom.window.Node as any
globalThis.DOMParser = dom.window.DOMParser as any
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window) as any
globalThis.MutationObserver = dom.window.MutationObserver as any
globalThis.Range = dom.window.Range as any
globalThis.NodeFilter = dom.window.NodeFilter as any
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0) as any
globalThis.cancelAnimationFrame = (id) => clearTimeout(id) as any

import { Editor } from '@tiptap/core'
import { documentExtensions } from '../src/client/tiptap/extensions.ts'
import { getBlocks, diffBlockArrays, parseMarkdownToBlocks } from '../src/client/tiptap/blockMap.ts'
import { reviewPluginKey, acceptSingleHunk, rejectSingleHunk } from '../src/client/tiptap/TipTapReviewPlugin.ts'

describe('TipTap Notion WYSIWYG AI Review (Phase 2)', () => {
  test('getBlocks extracts top-level blocks from TipTap Editor', () => {
    const md = `# Title\n\nFirst paragraph.\n\n> Callout or quote\n\n- List item 1\n- List item 2`
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: documentExtensions(),
      content: md,
      contentType: 'markdown',
    })

    try {
      const blocks = getBlocks(editor.state.doc)
      assert.equal(blocks.length >= 4, true)
      assert.equal(blocks[0]?.node.type.name, 'heading')
      assert.equal(blocks[1]?.node.type.name, 'paragraph')
    } finally {
      editor.destroy()
    }
  })

  test('diffBlockArrays detects added, modified, and deleted blocks', () => {
    const baseMd = `# Title\n\nParagraph 1.\n\nParagraph 2.`
    const newMd = `# Title\n\nParagraph 1 MODIFIED BY AI.\n\nParagraph 2.\n\nParagraph 3 NEW.`

    const { blocks: baseBlocks } = parseMarkdownToBlocks(baseMd)
    const { blocks: newBlocks } = parseMarkdownToBlocks(newMd)

    const editor = new Editor({
      element: document.createElement('div'),
      extensions: documentExtensions(),
      content: newMd,
      contentType: 'markdown',
    })

    try {
      const currentBlocks = getBlocks(editor.state.doc)
      const hunks = diffBlockArrays(baseBlocks, currentBlocks, editor.state.doc.content.size)

      assert.equal(hunks.length >= 2, true)
      // Hunk 1: modified paragraph 1
      assert.equal(hunks[0]?.type, 'replace')
      // Hunk 2: added paragraph 3
      assert.equal(hunks[1]?.type, 'add')
    } finally {
      editor.destroy()
    }
  })

  test('acceptSingleHunk advances baseline and clears diff for that block', () => {
    const baseMd = `# Title\n\nOriginal text.`
    const aiMd = `# Title\n\nAI modified text.`

    const editor = new Editor({
      element: document.createElement('div'),
      extensions: documentExtensions(),
      content: aiMd,
      contentType: 'markdown',
    })

    try {
      // Set baseline
      editor.view.dispatch(
        editor.state.tr.setMeta(reviewPluginKey, {
          type: 'SET_BASELINE',
          baseline: baseMd,
        })
      )

      let state = reviewPluginKey.getState(editor.state)!
      assert.equal(state.hunks.length, 1)

      // Accept hunk
      acceptSingleHunk(editor.view, state.hunks[0]!, state)

      state = reviewPluginKey.getState(editor.state)!
      assert.equal(state.hunks.length, 0)
    } finally {
      editor.destroy()
    }
  })

  test('rejectSingleHunk restores baseline block in working document with native undo', () => {
    const baseMd = `# Title\n\nOriginal Paragraph.`
    const aiMd = `# Title\n\nAI Overwritten Paragraph.`

    const editor = new Editor({
      element: document.createElement('div'),
      extensions: documentExtensions(),
      content: aiMd,
      contentType: 'markdown',
    })

    try {
      // Set baseline
      editor.view.dispatch(
        editor.state.tr.setMeta(reviewPluginKey, {
          type: 'SET_BASELINE',
          baseline: baseMd,
        })
      )

      let state = reviewPluginKey.getState(editor.state)!
      assert.equal(state.hunks.length, 1)

      // Reject hunk -> should restore Original Paragraph
      rejectSingleHunk(editor.view, state.hunks[0]!, state)

      const restoredText = editor.getMarkdown()
      assert.match(restoredText, /Original Paragraph/)
    } finally {
      editor.destroy()
    }
  })
})
