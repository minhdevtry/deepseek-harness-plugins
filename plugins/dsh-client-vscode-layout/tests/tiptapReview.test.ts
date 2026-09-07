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
import { getBlocks, diffBlockArrays, parseMarkdownToBlocks, findTextPosition } from '../src/client/tiptap/blockMap.ts'
import { reviewPluginKey, acceptSingleHunk, rejectSingleHunk, rejectHunksBatch } from '../src/client/tiptap/TipTapReviewPlugin.ts'
import { DocumentRegistry } from '../src/client/tiptap/documents.ts'

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

  test('rejecting a later hunk after an earlier accept restores content instead of deleting it (T1-3 regression)', () => {
    // The accepted hunk's replacement block COUNT differs from what it
    // replaced (1 baseline block -> 2 current blocks) — the exact shape that
    // desynced baseNodes from baselineBlocks before this fix, so that a
    // later reject indexed the wrong (or absent) baseline nodes and deleted
    // live content instead of restoring it.
    const baseMd = [
      'P0 zero',
      '',
      'P1 one',
      '',
      'P2 two',
      '',
      'P3 three',
    ].join('\n')
    const aiMd = [
      'P0 zero',
      '',
      'P1a one-a',
      '',
      'P1b one-b',
      '',
      'P2 two',
      '',
      'P3 three CHANGED',
    ].join('\n')

    const editor = new Editor({
      element: document.createElement('div'),
      extensions: documentExtensions(),
      content: aiMd,
      contentType: 'markdown',
    })

    try {
      editor.view.dispatch(
        editor.state.tr.setMeta(reviewPluginKey, { type: 'SET_BASELINE', baseline: baseMd }),
      )

      let state = reviewPluginKey.getState(editor.state)!
      assert.equal(state.hunks.length, 2, 'expected the P1-split hunk and the P3 hunk')

      // Accept the P1 -> P1a/P1b hunk (fromA=1,toA=2 -> fromB=1,toB=3: a
      // 1-baseline-block-for-2-current-blocks replacement).
      const splitHunk = state.hunks.find((h) => h.toB - h.fromB === 2)
      assert.ok(splitHunk, 'expected to find the split hunk')
      acceptSingleHunk(editor.view, splitHunk!, state)

      state = reviewPluginKey.getState(editor.state)!
      assert.equal(state.hunks.length, 1, 'one hunk (P3) should remain after accepting the split')

      // Reject the remaining P3 hunk — this must restore "P3 three", not
      // delete the paragraph outright.
      const p3Hunk = state.hunks[0]!
      rejectSingleHunk(editor.view, p3Hunk, state)

      const restored = editor.getMarkdown()
      assert.match(restored, /P3 three(?! CHANGED)/, 'P3 must be restored to its original text')
      assert.doesNotMatch(restored, /CHANGED/, 'the AI\'s P3 change must be gone after reject')
      // And nothing from the already-accepted split was touched by the reject.
      assert.match(restored, /P1a one-a/)
      assert.match(restored, /P1b one-b/)
    } finally {
      editor.destroy()
    }
  })

  test('a widget click looks up the CURRENT hunk by id rather than acting on a stale pre-edit snapshot (T1-4 regression)', () => {
    // This exercises the exact data flow renderHunkWidget's onclick now
    // performs: capture hunk.id only, then re-read plugin state and look the
    // hunk up fresh at click time — never close over the hunk/pluginState
    // captured when the widget (and, in prosemirror-view, its DOM node) was
    // first drawn, which a same-key decoration can reuse verbatim after an
    // edit inside the block.
    const baseMd = '# Title\n\nOriginal text.'
    const aiMd = '# Title\n\nAI modified text.'

    const editor = new Editor({
      element: document.createElement('div'),
      extensions: documentExtensions(),
      content: aiMd,
      contentType: 'markdown',
    })

    try {
      editor.view.dispatch(
        editor.state.tr.setMeta(reviewPluginKey, { type: 'SET_BASELINE', baseline: baseMd }),
      )

      const stateAtWidgetDraw = reviewPluginKey.getState(editor.state)!
      assert.equal(stateAtWidgetDraw.hunks.length, 1)
      const hunkAtWidgetDraw = stateAtWidgetDraw.hunks[0]!
      const hunkId = hunkAtWidgetDraw.id

      // The operator types more into the AI's paragraph before clicking
      // Accept. The block's index (and therefore hunk.id) is unchanged, but
      // its text is not what hunkAtWidgetDraw/stateAtWidgetDraw captured.
      const insertPos = editor.state.doc.content.size - 1
      editor.view.dispatch(editor.state.tr.insertText('!', insertPos))

      // What the fixed onclick handler does: re-read state and look the
      // hunk up by id, never reuse hunkAtWidgetDraw/stateAtWidgetDraw.
      const freshState = reviewPluginKey.getState(editor.state)!
      const freshHunk = freshState.hunks.find((h) => h.id === hunkId)
      assert.ok(freshHunk, 'the hunk must still be findable by its stable id after the edit')
      assert.notDeepEqual(freshHunk!.currentBlocks, hunkAtWidgetDraw.currentBlocks, 'the fresh hunk must reflect the edit')

      acceptSingleHunk(editor.view, freshHunk!, freshState)

      const resolvedState = reviewPluginKey.getState(editor.state)!
      assert.equal(resolvedState.hunks.length, 0, 'accepting the fresh hunk must resolve the review')
      assert.match(editor.getMarkdown(), /AI modified text\.!/, 'the accepted baseline must include the edit made after the widget was drawn')
    } finally {
      editor.destroy()
    }
  })

  test('a genuine create (empty-string baseline) still arms the review instead of being treated as "no baseline"', () => {
    // '' is a legitimate baseline (the whole file is new); only `null` means
    // "disarm". A falsy check on a `string | null` conflates the two.
    const aiMd = '# New Doc\n\nEverything here is new.'

    const editor = new Editor({
      element: document.createElement('div'),
      extensions: documentExtensions(),
      content: aiMd,
      contentType: 'markdown',
    })

    try {
      editor.view.dispatch(
        editor.state.tr.setMeta(reviewPluginKey, { type: 'SET_BASELINE', baseline: '' }),
      )

      const state = reviewPluginKey.getState(editor.state)!
      assert.equal(state.baselineMarkdown, '', 'an empty-string baseline must be stored, not collapsed to null')
      assert.ok(state.hunks.length > 0, 'the whole new document must show as one or more insertion hunks')
    } finally {
      editor.destroy()
    }
  })

  test('a baseline ending in a non-paragraph block does not produce a phantom trailing-paragraph hunk', () => {
    // `documents.ts#open` appends an empty trailing paragraph whenever the
    // live doc ends on a non-paragraph block (table, code block, …), to
    // pre-empt ProseMirror's own DOM-schema repair. parseMarkdownToBlocks
    // (which builds every review baseline) must do the exact same
    // normalization, or a file like this one diffs one block short against
    // the live doc and shows a spurious "add" hunk for a paragraph nobody
    // actually added.
    const md = '# Title\n\n```js\nconsole.log(1)\n```'

    const { blocks, nodes } = parseMarkdownToBlocks(md)
    assert.equal(nodes[nodes.length - 1]?.type.name, 'paragraph',
      'parseMarkdownToBlocks must append the same trailing paragraph documents.open does')

    const editor = new Editor({
      element: document.createElement('div'),
      extensions: documentExtensions(),
      content: md,
      contentType: 'markdown',
    })
    try {
      if (editor.state.doc.lastChild?.type.name !== 'paragraph') {
        editor.commands.insertContentAt(editor.state.doc.content.size, { type: 'paragraph' })
      }
      const currentBlocks = getBlocks(editor.state.doc)
      const hunks = diffBlockArrays(blocks, currentBlocks, editor.state.doc.content.size)
      assert.equal(hunks.length, 0, 'an unmodified file must show zero hunks, not a phantom trailing-paragraph insertion')
    } finally {
      editor.destroy()
    }
  })

  test('rejectHunksBatch reverts every hunk in one transaction, not one dispatch per hunk', () => {
    const baseMd = `Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.`
    const aiMd = `Paragraph 1 CHANGED.\n\nParagraph 2.\n\nParagraph 3 CHANGED.`

    const editor = new Editor({
      element: document.createElement('div'),
      extensions: documentExtensions(),
      content: aiMd,
      contentType: 'markdown',
    })

    try {
      editor.view.dispatch(
        editor.state.tr.setMeta(reviewPluginKey, { type: 'SET_BASELINE', baseline: baseMd }),
      )
      const before = reviewPluginKey.getState(editor.state)!
      assert.equal(before.hunks.length, 2, 'both changed paragraphs must show as hunks before reject')

      let dispatchCount = 0
      const countingView = {
        get state() { return editor.view.state },
        dispatch: (tr: any) => { dispatchCount++; editor.view.dispatch(tr) },
      }
      rejectHunksBatch(countingView, before.hunks, before)

      assert.equal(dispatchCount, 1, 'Reject All must be exactly one dispatch regardless of hunk count')
      const after = reviewPluginKey.getState(editor.state)!
      assert.equal(after.hunks.length, 0, 'every hunk must be reverted')
      assert.equal(editor.getText().includes('CHANGED'), false, 'the AI text must be fully reverted')
    } finally {
      editor.destroy()
    }
  })

  test('findTextPosition locates a search hit\'s line text for revealLine', () => {
    const md = `# Title\n\nFirst paragraph.\n\nSecond paragraph has the target phrase.\n\nThird paragraph.`
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: documentExtensions(),
      content: md,
      contentType: 'markdown',
    })
    try {
      const pos = findTextPosition(editor.state.doc, 'Second paragraph has the target phrase.')
      assert.notEqual(pos, undefined, 'must find the matching text block')
      const resolved = editor.state.doc.resolve(pos!)
      assert.equal(resolved.parent.textContent.includes('target phrase'), true,
        'the resolved position must be inside the block containing the match')
    } finally {
      editor.destroy()
    }
  })

  test('findTextPosition returns undefined for text that is not in the document', () => {
    const md = `# Title\n\nFirst paragraph.`
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: documentExtensions(),
      content: md,
      contentType: 'markdown',
    })
    try {
      assert.equal(findTextPosition(editor.state.doc, 'text that was never in this file'), undefined)
    } finally {
      editor.destroy()
    }
  })

  test('setFrontmatter reverts only the header — body, tree and undo history are untouched', () => {
    const path = '/work/notes.md'
    const md = '---\ntitle: New Title\ntags:\n  - ai\n---\n\n# Body\n\nSome text.'
    const registry = new DocumentRegistry()
    registry.open(path, md)

    const before = registry.frontmatter(path)
    assert.ok(before?.includes('title: New Title'))

    const editor = registry.editor(path)!
    const bodyBefore = editor.getText()
    const baselineFrontmatter = '---\ntitle: Old Title\n---\n'

    registry.setFrontmatter(path, baselineFrontmatter)

    assert.equal(registry.frontmatter(path), baselineFrontmatter, 'frontmatter must be replaced')
    assert.equal(registry.editor(path), editor, 'the same Editor instance must survive — no reopen/remount')
    assert.equal(editor.getText(), bodyBefore, 'the tree must not change')
    assert.equal(
      registry.source(path),
      baselineFrontmatter.replace(/\n*$/, '\n') + '\n# Body\n\nSome text.',
      'source must be the reverted frontmatter joined with the unchanged body',
    )
  })

  test('setFrontmatter can add a frontmatter block to a file that started without one', () => {
    const path = '/work/plain.md'
    const registry = new DocumentRegistry()
    registry.open(path, '# Just a heading\n\nNo frontmatter here.')
    assert.equal(registry.frontmatter(path), '')

    registry.setFrontmatter(path, '---\nrestored: true\n---\n')
    assert.equal(registry.frontmatter(path), '---\nrestored: true\n---\n')
    assert.ok(registry.source(path)?.startsWith('---\nrestored: true\n---\n'))
  })
})
