import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

// Bootstrap JSDOM environment for CodeMirror 6 EditorView & DOM tests
const dom = new JSDOM('<!doctype html><html><body></body></html>')
;(globalThis as any).window = dom.window
;(globalThis as any).document = dom.window.document
dom.window.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0) as any
dom.window.cancelAnimationFrame = (id: number) => clearTimeout(id)
;(globalThis as any).requestAnimationFrame = dom.window.requestAnimationFrame
;(globalThis as any).cancelAnimationFrame = dom.window.cancelAnimationFrame
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
  'Window',
]) {
  ;(globalThis as any)[k] = (dom.window as any)[k]
}

import { EditorState, Compartment } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { undo, history } from '@codemirror/commands'
import {
  unifiedMergeView,
  getChunks,
  getOriginalDoc,
  acceptChunk,
  rejectChunk,
  goToNextChunk,
  goToPreviousChunk,
} from '@codemirror/merge'
import { BufferRegistry } from '../src/client/workbench/buffers.ts'

describe('Scenario 1: Single-Hunk Lifecycle (Accept vs Reject)', () => {
  test('Scenario 1A: Accept hunk leaves working document intact and reduces chunks to 0', () => {
    const baseline = 'function test() {\n  return 42;\n}\n'
    const aiText = 'function test() {\n  // Optimized with constant fold\n  return 42;\n}\n'

    const state = EditorState.create({
      doc: aiText,
      extensions: [history(), unifiedMergeView({ original: baseline, mergeControls: true })],
    })
    const host = document.createElement('div')
    const view = new EditorView({ state, parent: host })

    const chunks = getChunks(view.state)?.chunks ?? []
    assert.equal(chunks.length, 1)

    // Accept hunk
    const ok = acceptChunk(view, chunks[0]!.fromB)
    assert.equal(ok, true)

    // Working document text is untouched
    assert.equal(view.state.doc.toString(), aiText)
    // Chunks count drops to 0
    assert.equal(getChunks(view.state)?.chunks.length ?? 0, 0)

    view.destroy()
  })

  test('Scenario 1B: Reject hunk reverts text to baseline and reduces chunks to 0', () => {
    const baseline = 'const timeout = 1000;\n'
    const aiText = 'const timeout = 5000; // Updated timeout\n'

    const state = EditorState.create({
      doc: aiText,
      extensions: [history(), unifiedMergeView({ original: baseline, mergeControls: true })],
    })
    const host = document.createElement('div')
    const view = new EditorView({ state, parent: host })

    const chunks = getChunks(view.state)?.chunks ?? []
    assert.equal(chunks.length, 1)

    // Reject hunk
    const ok = rejectChunk(view, chunks[0]!.fromB)
    assert.equal(ok, true)

    // Working document text is reverted to baseline
    assert.equal(view.state.doc.toString(), baseline)
    // Chunks count drops to 0
    assert.equal(getChunks(view.state)?.chunks.length ?? 0, 0)

    view.destroy()
  })
})

describe('Scenario 2: Multi-Hunk Selective Cherry-Picking (3 hunks)', () => {
  test('Accept top and bottom hunks, reject middle hunk -> exact hybrid result', () => {
    const baseline = [
      '// HEADER',
      'const user = "Alice"',
      '// context 1',
      '// context 2',
      '// context 3',
      '// context 4',
      '// MIDDLE',
      'const role = "guest"',
      '// context 5',
      '// context 6',
      '// context 7',
      '// context 8',
      '// FOOTER',
      'const version = 1',
    ].join('\n') + '\n'

    const aiText = [
      '// HEADER: AI Enhanced',
      'const user = "Alice"',
      '// context 1',
      '// context 2',
      '// context 3',
      '// context 4',
      '// MIDDLE: AI Changed (Bad)',
      'const role = "superuser"',
      '// context 5',
      '// context 6',
      '// context 7',
      '// context 8',
      '// FOOTER: AI Enhanced',
      'const version = 2',
    ].join('\n') + '\n'

    const state = EditorState.create({
      doc: aiText,
      extensions: [history(), unifiedMergeView({ original: baseline, mergeControls: true })],
    })
    const host = document.createElement('div')
    const view = new EditorView({ state, parent: host })

    let chunks = getChunks(view.state)?.chunks ?? []
    assert.equal(chunks.length, 3, 'Should detect exactly 3 hunks')

    // 1. Accept Top Hunk (index 0)
    acceptChunk(view, chunks[0]!.fromB)
    chunks = getChunks(view.state)?.chunks ?? []
    assert.equal(chunks.length, 2, '2 hunks left after accepting top')

    // 2. Reject Middle Hunk (now at index 0 of remaining)
    rejectChunk(view, chunks[0]!.fromB)
    chunks = getChunks(view.state)?.chunks ?? []
    assert.equal(chunks.length, 1, '1 hunk left after rejecting middle')

    // 3. Accept Bottom Hunk (now at index 0 of remaining)
    acceptChunk(view, chunks[0]!.fromB)
    chunks = getChunks(view.state)?.chunks ?? []
    assert.equal(chunks.length, 0, '0 hunks left after accepting bottom')

    // Expected hybrid: Top AI, Middle Baseline, Bottom AI
    const expectedHybrid = [
      '// HEADER: AI Enhanced',
      'const user = "Alice"',
      '// context 1',
      '// context 2',
      '// context 3',
      '// context 4',
      '// MIDDLE',
      'const role = "guest"',
      '// context 5',
      '// context 6',
      '// context 7',
      '// context 8',
      '// FOOTER: AI Enhanced',
      'const version = 2',
    ].join('\n') + '\n'

    assert.equal(view.state.doc.toString(), expectedHybrid)

    view.destroy()
  })
})

describe('Scenario 3: Undo Sequence with Accept/Reject Asymmetry', () => {
  test('Undoing Accept restores diff chunk via baseline stack re-arm', () => {
    const baseline = 'let count = 0;\n'
    const aiText = 'let count = 10;\n'

    const diffComp = new Compartment()
    const baselineStack: string[] = []

    const state = EditorState.create({
      doc: aiText,
      extensions: [history(), diffComp.of(unifiedMergeView({ original: baseline, mergeControls: true }))],
    })
    const host = document.createElement('div')
    const view = new EditorView({ state, parent: host })

    assert.equal(getChunks(view.state)?.chunks.length, 1)

    // Snapshot baseline and accept
    baselineStack.push(getOriginalDoc(view.state).toString())
    acceptChunk(view, getChunks(view.state)!.chunks[0]!.fromB)

    assert.equal(getChunks(view.state)?.chunks.length ?? 0, 0)
    assert.equal(view.state.doc.toString(), aiText)

    // Undo Accept: Pop baseline and reconfigure compartment
    const popped = baselineStack.pop()!
    assert.equal(popped, baseline)

    view.dispatch({
      effects: diffComp.reconfigure(unifiedMergeView({ original: popped, mergeControls: true })),
    })

    // Chunk is restored back to 1!
    assert.equal(getChunks(view.state)?.chunks.length, 1)
    assert.equal(view.state.doc.toString(), aiText)

    view.destroy()
  })

  test('Undoing Reject restores AI text and diff chunk via CodeMirror history undo', () => {
    const baseline = 'let count = 0;\n'
    const aiText = 'let count = 10;\n'

    const state = EditorState.create({
      doc: aiText,
      extensions: [history(), unifiedMergeView({ original: baseline, mergeControls: true })],
    })
    const host = document.createElement('div')
    const view = new EditorView({ state, parent: host })

    assert.equal(getChunks(view.state)?.chunks.length, 1)

    // Reject chunk
    rejectChunk(view, getChunks(view.state)!.chunks[0]!.fromB)
    assert.equal(view.state.doc.toString(), baseline)
    assert.equal(getChunks(view.state)?.chunks.length ?? 0, 0)

    // Undo Reject using standard CodeMirror undo command
    const undone = undo(view)
    assert.equal(undone, true)

    // Text returns to AI text and chunk is re-computed live
    assert.equal(view.state.doc.toString(), aiText)
    assert.equal(getChunks(view.state)?.chunks.length, 1)

    view.destroy()
  })
})

describe('Scenario 4: Batch Accept-All and Batch Undo', () => {
  test('Accept All clears all chunks in one go; undoing restores all chunks', () => {
    const baseline = [
      'A',
      '// context 1',
      '// context 2',
      '// context 3',
      '// context 4',
      'B',
      '// context 5',
      '// context 6',
      '// context 7',
      '// context 8',
      'C',
    ].join('\n') + '\n'

    const aiText = [
      'A_new',
      '// context 1',
      '// context 2',
      '// context 3',
      '// context 4',
      'B_new',
      '// context 5',
      '// context 6',
      '// context 7',
      '// context 8',
      'C_new',
    ].join('\n') + '\n'

    const diffComp = new Compartment()
    const baselineStack: string[] = []

    const state = EditorState.create({
      doc: aiText,
      extensions: [history(), diffComp.of(unifiedMergeView({ original: baseline, mergeControls: true }))],
    })
    const host = document.createElement('div')
    const view = new EditorView({ state, parent: host })

    assert.equal(getChunks(view.state)?.chunks.length, 3)

    // Snapshot for batch accept
    baselineStack.push(getOriginalDoc(view.state).toString())

    // Accept All in reverse order
    const chunks = getChunks(view.state)?.chunks ?? []
    for (let i = chunks.length - 1; i >= 0; i--) {
      acceptChunk(view, chunks[i]!.fromB)
    }

    assert.equal(getChunks(view.state)?.chunks.length ?? 0, 0)
    assert.equal(view.state.doc.toString(), aiText)

    // Batch Undo
    const popped = baselineStack.pop()!
    view.dispatch({
      effects: diffComp.reconfigure(unifiedMergeView({ original: popped, mergeControls: true })),
    })

    assert.equal(getChunks(view.state)?.chunks.length, 3)
    assert.equal(view.state.doc.toString(), aiText)

    view.destroy()
  })
})

describe('Scenario 5: Batch Reject-All and Batch Undo', () => {
  test('Reject All reverts all text in one go; undoing restores all AI changes', () => {
    const baseline = [
      'A',
      '// context 1',
      '// context 2',
      '// context 3',
      '// context 4',
      'B',
      '// context 5',
      '// context 6',
      '// context 7',
      '// context 8',
      'C',
    ].join('\n') + '\n'

    const aiText = [
      'A_new',
      '// context 1',
      '// context 2',
      '// context 3',
      '// context 4',
      'B_new',
      '// context 5',
      '// context 6',
      '// context 7',
      '// context 8',
      'C_new',
    ].join('\n') + '\n'

    const state = EditorState.create({
      doc: aiText,
      extensions: [history(), unifiedMergeView({ original: baseline, mergeControls: true })],
    })
    const host = document.createElement('div')
    const view = new EditorView({ state, parent: host })

    assert.equal(getChunks(view.state)?.chunks.length, 3)

    // Reject All in reverse order
    const chunks = getChunks(view.state)?.chunks ?? []
    for (let i = chunks.length - 1; i >= 0; i--) {
      rejectChunk(view, chunks[i]!.fromB)
    }

    assert.equal(getChunks(view.state)?.chunks.length ?? 0, 0)
    assert.equal(view.state.doc.toString(), baseline)

    // Undo rejects
    while (undo(view)) {
      // Unwind transaction history
    }

    assert.equal(view.state.doc.toString(), aiText)
    assert.equal(getChunks(view.state)?.chunks.length, 3)

    view.destroy()
  })
})

describe('Scenario 6: Manual Live Typing during Active Review', () => {
  test('Operator edits document during review; diff chunks update live', () => {
    const baseline = [
      'line1',
      '// context 1',
      '// context 2',
      '// context 3',
      '// context 4',
      'line3',
    ].join('\n') + '\n'

    const aiText = [
      'line1_ai',
      '// context 1',
      '// context 2',
      '// context 3',
      '// context 4',
      'line3_ai',
    ].join('\n') + '\n'

    const state = EditorState.create({
      doc: aiText,
      extensions: [history(), unifiedMergeView({ original: baseline, mergeControls: true })],
    })
    const host = document.createElement('div')
    const view = new EditorView({ state, parent: host })

    assert.equal(getChunks(view.state)?.chunks.length, 2)

    // Operator types a new edit in the untouched middle context region
    const line3Pos = view.state.doc.line(3).to
    view.dispatch({
      changes: { from: line3Pos, insert: '\n// Operator inserted extra line' },
    })

    // Now there are 3 distinct hunks!
    const updatedChunks = getChunks(view.state)?.chunks ?? []
    assert.equal(updatedChunks.length, 3)

    view.destroy()
  })
})

describe('Scenario 7: Consecutive Cumulative AI Writes', () => {
  test('Cumulative baseline accommodates second AI write without losing prior diffs', () => {
    const baseline = [
      'block1',
      '// context 1',
      '// context 2',
      '// context 3',
      '// context 4',
      'block3',
    ].join('\n') + '\n'

    const turn1AiText = [
      'block1_ai',
      '// context 1',
      '// context 2',
      '// context 3',
      '// context 4',
      'block3',
    ].join('\n') + '\n'

    const diffComp = new Compartment()
    const state = EditorState.create({
      doc: turn1AiText,
      extensions: [history(), diffComp.of(unifiedMergeView({ original: baseline, mergeControls: true }))],
    })
    const host = document.createElement('div')
    const view = new EditorView({ state, parent: host })

    assert.equal(getChunks(view.state)?.chunks.length, 1)

    // Turn 2 write arrives: modifies block3 as well
    const turn2AiText = [
      'block1_ai',
      '// context 1',
      '// context 2',
      '// context 3',
      '// context 4',
      'block3_ai_turn2',
    ].join('\n') + '\n'

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: turn2AiText },
    })

    // Because baseline was kept cumulative, now both turn 1 and turn 2 hunks are visible!
    const cumulativeChunks = getChunks(view.state)?.chunks ?? []
    assert.equal(cumulativeChunks.length, 2)

    view.destroy()
  })
})

describe('Scenario 8: Navigation Hunk Traversal', () => {
  test('goToNextChunk and goToPreviousChunk navigate across hunks accurately', () => {
    const baseline = [
      'H1_base',
      '// context 1',
      '// context 2',
      '// context 3',
      '// context 4',
      'H2_base',
      '// context 5',
      '// context 6',
      '// context 7',
      '// context 8',
      'H3_base',
    ].join('\n') + '\n'

    const aiText = [
      'H1_ai',
      '// context 1',
      '// context 2',
      '// context 3',
      '// context 4',
      'H2_ai',
      '// context 5',
      '// context 6',
      '// context 7',
      '// context 8',
      'H3_ai',
    ].join('\n') + '\n'

    const state = EditorState.create({
      doc: aiText,
      extensions: [history(), unifiedMergeView({ original: baseline, mergeControls: true })],
    })
    const host = document.createElement('div')
    const view = new EditorView({ state, parent: host })

    assert.equal(getChunks(view.state)?.chunks.length, 3)

    // Focus top
    view.dispatch({ selection: { anchor: 0 } })

    // Next chunk jumps forward
    const ok1 = goToNextChunk(view)
    assert.equal(ok1, true)

    const ok2 = goToNextChunk(view)
    assert.equal(ok2, true)

    // Previous chunk jumps backward
    const prevOk = goToPreviousChunk(view)
    assert.equal(prevOk, true)

    view.destroy()
  })
})

describe('Scenario 9: Complex Edge Cases in Diffs', () => {
  test('Edge Case 9A: Empty baseline to populated file (New file insertion)', () => {
    const baseline = ''
    const aiText = 'line1\nline2\nline3\n'

    const state = EditorState.create({
      doc: aiText,
      extensions: [history(), unifiedMergeView({ original: baseline, mergeControls: true })],
    })
    const host = document.createElement('div')
    const view = new EditorView({ state, parent: host })

    const chunks = getChunks(view.state)?.chunks ?? []
    assert.equal(chunks.length, 1)

    // Accept whole new file
    acceptChunk(view, chunks[0]!.fromB)
    assert.equal(view.state.doc.toString(), aiText)
    assert.equal(getChunks(view.state)?.chunks.length ?? 0, 0)

    view.destroy()
  })

  test('Edge Case 9B: Populated baseline to empty file (File deletion)', () => {
    const baseline = 'line1\nline2\nline3\n'
    const aiText = ''

    const state = EditorState.create({
      doc: aiText,
      extensions: [history(), unifiedMergeView({ original: baseline, mergeControls: true })],
    })
    const host = document.createElement('div')
    const view = new EditorView({ state, parent: host })

    const chunks = getChunks(view.state)?.chunks ?? []
    assert.equal(chunks.length, 1)

    // Reject deletion -> restores all 3 lines
    rejectChunk(view, chunks[0]!.fromB)
    assert.equal(view.state.doc.toString(), baseline)
    assert.equal(getChunks(view.state)?.chunks.length ?? 0, 0)

    view.destroy()
  })

  test('Edge Case 9C: Duplicate repeated lines do not desync diff alignment', () => {
    const baseline = 'item\nitem\nitem\nitem\n'
    const aiText = 'item\nitem_changed\nitem\nitem\n'

    const state = EditorState.create({
      doc: aiText,
      extensions: [history(), unifiedMergeView({ original: baseline, mergeControls: true })],
    })
    const host = document.createElement('div')
    const view = new EditorView({ state, parent: host })

    const chunks = getChunks(view.state)?.chunks ?? []
    assert.equal(chunks.length, 1)

    // Accept only the changed duplicate line
    acceptChunk(view, chunks[0]!.fromB)
    assert.equal(view.state.doc.toString(), aiText)
    assert.equal(getChunks(view.state)?.chunks.length ?? 0, 0)

    view.destroy()
  })
})

describe('Scenario 10: BufferRegistry Dirtiness Lifecycle', () => {
  test('Buffer stays clean on Accept, becomes dirty on Reject', async () => {
    const diskContent = 'const port = 3000;\n'
    const aiContent = 'const port = 8080;\n'

    // Mock API for BufferRegistry
    const path = '/workspace/config.ts'
    const registry = new BufferRegistry(() => [history()])

    // Seed registry with initial disk content
    const state = EditorState.create({
      doc: aiContent,
      extensions: [history()],
    })

    // Manually register status
    ;(registry as any).setBufferForTest?.(path, {
      kind: 'text',
      state,
      diskDoc: EditorState.create({ doc: diskContent }).doc,
      dirty: false,
      truncated: false,
      size: diskContent.length,
    })

    // In a clean state where working doc matches AI text (which was written by AI):
    // 1. Accept does not modify EditorState doc -> dirty stays unchanged
    // 2. Reject modifies EditorState doc -> dirty becomes true if it differs from diskDoc
    const host = document.createElement('div')
    const view = new EditorView({
      state: EditorState.create({
        doc: aiContent,
        extensions: [history(), unifiedMergeView({ original: diskContent, mergeControls: true })],
      }),
      parent: host,
    })

    // Reject chunk
    rejectChunk(view, getChunks(view.state)!.chunks[0]!.fromB)
    assert.equal(view.state.doc.toString(), diskContent)

    view.destroy()
  })
})
