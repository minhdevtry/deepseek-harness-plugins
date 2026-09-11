import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

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
]) {
  ;(globalThis as any)[k] = (dom.window as any)[k]
}

import { EditorState, Compartment, StateEffect } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { history } from '@codemirror/commands'
import {
  unifiedMergeView,
  getChunks,
  getOriginalDoc,
  acceptChunk,
  rejectChunk,
  diff,
  presentableDiff,
} from '@codemirror/merge'

describe('Phase 1 AI Review: @codemirror/merge integration', () => {
  test('getChunks returns null (not undefined) when merge view is disarmed', () => {
    const state = EditorState.create({ doc: 'const x = 1\nconst y = 2\n' })
    const res = getChunks(state)
    assert.equal(res, null)

    // Safe accessor pattern
    const chunks = getChunks(state)?.chunks ?? []
    assert.deepEqual(chunks, [])
  })

  test('unifiedMergeView calculates diff chunks between baseline and working doc', () => {
    const baseline = 'const a = 1\nconst b = 2\nconst c = 3\n'
    const aiWorkingDoc = 'const a = 1\nconst b = 200\nconst c = 3\nconst d = 4\n'

    const state = EditorState.create({
      doc: aiWorkingDoc,
      extensions: [unifiedMergeView({ original: baseline, mergeControls: true })],
    })

    const chunks = getChunks(state)?.chunks ?? []
    assert.ok(chunks.length >= 1)
  })

  test('Accept does NOT change document text but decreases chunk count', () => {
    const baseline = 'line1\nold_b\nline3\n'
    const aiWorkingDoc = 'line1\nnew_B\nline3\n'

    let state = EditorState.create({
      doc: aiWorkingDoc,
      extensions: [unifiedMergeView({ original: baseline, mergeControls: true })],
    })

    const dom = document.createElement('div')
    const view = new EditorView({
      state,
      parent: dom,
    })

    assert.equal(getChunks(view.state)?.chunks.length, 1)
    assert.equal(view.state.doc.toString(), aiWorkingDoc)

    const chunk = getChunks(view.state)!.chunks[0]
    assert.ok(chunk)

    // Accept chunk
    const accepted = acceptChunk(view, chunk.fromB)
    assert.equal(accepted, true)

    // Document text must remain 100% identical to AI working doc
    assert.equal(view.state.doc.toString(), aiWorkingDoc)

    // Chunk count drops to 0
    assert.equal(getChunks(view.state)?.chunks.length ?? 0, 0)

    view.destroy()
  })

  test('Reject changes document text back to baseline', () => {
    const baseline = 'line1\nold_b\nline3\n'
    const aiWorkingDoc = 'line1\nnew_B\nline3\n'

    let state = EditorState.create({
      doc: aiWorkingDoc,
      extensions: [unifiedMergeView({ original: baseline, mergeControls: true })],
    })

    const dom = document.createElement('div')
    const view = new EditorView({
      state,
      parent: dom,
    })

    assert.equal(getChunks(view.state)?.chunks.length, 1)

    const chunk = getChunks(view.state)!.chunks[0]
    assert.ok(chunk)

    // Reject chunk
    const rejected = rejectChunk(view, chunk.fromB)
    assert.equal(rejected, true)

    // Document text must revert to baseline
    assert.equal(view.state.doc.toString(), baseline)

    // Chunk count drops to 0
    assert.equal(getChunks(view.state)?.chunks.length ?? 0, 0)

    view.destroy()
  })

  test('Undoing an accept works by re-arming diff compartment with baseline snapshot', () => {
    const baseline = 'line1\nold_b\nline3\nold_d\n'
    const aiWorkingDoc = 'line1\nnew_B\nline3\nnew_D\n'

    const diffComp = new Compartment()
    const baselineSnapshots: string[] = []

    const state = EditorState.create({
      doc: aiWorkingDoc,
      extensions: [diffComp.of(unifiedMergeView({ original: baseline, mergeControls: true }))],
    })

    const dom = document.createElement('div')
    const view = new EditorView({
      state,
      parent: dom,
    })

    assert.equal(getChunks(view.state)?.chunks.length, 2)

    // Snapshot before accepting hunk 1
    baselineSnapshots.push(getOriginalDoc(view.state).toString())
    const chunk1 = getChunks(view.state)!.chunks[0]
    acceptChunk(view, chunk1.fromB)

    // Now 1 chunk remains
    assert.equal(getChunks(view.state)?.chunks.length, 1)
    assert.equal(view.state.doc.toString(), aiWorkingDoc)

    // Undo the accept by popping baseline snapshot and reconfiguring compartment
    const poppedBaseline = baselineSnapshots.pop()!
    assert.equal(poppedBaseline, baseline)

    view.dispatch({
      effects: diffComp.reconfigure(unifiedMergeView({ original: poppedBaseline, mergeControls: true })),
    })

    // Both chunks are restored!
    assert.equal(getChunks(view.state)?.chunks.length, 2)
    assert.equal(view.state.doc.toString(), aiWorkingDoc)

    view.destroy()
  })

  test('Batch Accept All leaves working doc intact and clears all chunks', () => {
    const baseline = '1\n2\n3\n4\n5\n'
    const aiWorkingDoc = '1_ai\n2\n3_ai\n4\n5_ai\n'

    const state = EditorState.create({
      doc: aiWorkingDoc,
      extensions: [unifiedMergeView({ original: baseline, mergeControls: true })],
    })

    const dom = document.createElement('div')
    const view = new EditorView({
      state,
      parent: dom,
    })

    const initialChunks = getChunks(view.state)?.chunks ?? []
    assert.equal(initialChunks.length, 3)

    // Accept all in reverse order
    for (let i = initialChunks.length - 1; i >= 0; i--) {
      const c = initialChunks[i]
      if (c) acceptChunk(view, c.fromB)
    }

    assert.equal(getChunks(view.state)?.chunks.length ?? 0, 0)
    assert.equal(view.state.doc.toString(), aiWorkingDoc)

    view.destroy()
  })

  test('Batch Reject All reverts working doc back to baseline', () => {
    const baseline = '1\n2\n3\n4\n5\n'
    const aiWorkingDoc = '1_ai\n2\n3_ai\n4\n5_ai\n'

    const state = EditorState.create({
      doc: aiWorkingDoc,
      extensions: [unifiedMergeView({ original: baseline, mergeControls: true })],
    })

    const dom = document.createElement('div')
    const view = new EditorView({
      state,
      parent: dom,
    })

    const initialChunks = getChunks(view.state)?.chunks ?? []
    assert.equal(initialChunks.length, 3)

    // Reject all in reverse order
    for (let i = initialChunks.length - 1; i >= 0; i--) {
      const c = initialChunks[i]
      if (c) rejectChunk(view, c.fromB)
    }

    assert.equal(getChunks(view.state)?.chunks.length ?? 0, 0)
    assert.equal(view.state.doc.toString(), baseline)

    view.destroy()
  })
})

describe('Compartment lifecycle across a simulated remount (T0-7)', () => {
  // CodeEditor persists its EditorState into BufferRegistry on unmount and
  // rebuilds an EditorView from it on the next mount (see buffers.ts's
  // module doc: "the state object IS the tab's memory"). A merge-view
  // compartment appended fresh on every mount, instead of a stable per-path
  // one that is reconfigured after the first mount, corrupts that memory:
  // this reproduces the bug directly against the mount effect's OLD shape,
  // then proves the NEW shape (BufferRegistry.mergeCompartments +
  // isMergeArmed) avoids it.

  test('BUG (fixed shape): appending a fresh compartment on every mount permanently shadows the first', () => {
    const baseline = 'a\nb\nc\nd\n'
    const aiText = 'A\nb\nc\nD\n'

    // Mount 1: a brand-new compartment, exactly what a per-mount `useRef(new
    // Compartment())` produced before the fix.
    const compartment1 = new Compartment()
    let state = EditorState.create({
      doc: aiText,
      extensions: [history(), compartment1.of(unifiedMergeView({ original: baseline, mergeControls: true }))],
    })
    const host = document.createElement('div')
    let view = new EditorView({ state, parent: host })
    assert.equal(getChunks(view.state)?.chunks.length, 2)

    // Unmount: the state (carrying compartment1's config) is handed back to
    // the registry, exactly like `registry.sync(path, view.state)`.
    const persisted = view.state
    view.destroy()

    // Mount 2 (a remount of the same path): a SECOND fresh compartment is
    // appended via appendConfig, which is additive — compartment1's config
    // is still present underneath.
    const compartment2 = new Compartment()
    state = persisted.update({
      effects: StateEffect.appendConfig.of([compartment2.of(unifiedMergeView({ original: baseline, mergeControls: true }))]),
    }).state
    view = new EditorView({ state, parent: host })

    // Reconfiguring compartment2 — the ONLY compartment this new mount knows
    // about — can never reach the field compartment1's `.init()` still owns.
    view.dispatch({ effects: compartment2.reconfigure([]) })
    assert.equal(getChunks(view.state)?.chunks.length, 2, 'disarming the second compartment does not disarm the view')

    view.dispatch({
      effects: compartment2.reconfigure(unifiedMergeView({ original: 'TOTALLY DIFFERENT\n', mergeControls: true })),
    })
    assert.equal(getOriginalDoc(view.state).toString(), baseline, 'the second compartment cannot move the baseline either')

    view.destroy()
  })

  test('FIX: reusing the same compartment pair across mounts, appended only once, lets reconfigure work after a remount', () => {
    const baseline = 'a\nb\nc\nd\n'
    const aiText = 'A\nb\nc\nD\n'

    // One BufferRegistry, one path — mergeCompartments/isMergeArmed give the
    // stable identity + arm-once tracking CodeEditor now relies on.
    const registry = new BufferRegistryForTest()
    registry.seed('/a.ts', EditorState.create({ doc: aiText, extensions: [history()] }))

    const host = document.createElement('div')

    const mount = (): EditorView => {
      const buffer = registry.textState('/a.ts')
      const { diff } = registry.mergeCompartments('/a.ts')!
      const armed = registry.isMergeArmed('/a.ts')
      let initial = buffer
      if (!armed) {
        initial = buffer.update({
          effects: StateEffect.appendConfig.of([diff.of(unifiedMergeView({ original: baseline, mergeControls: true }))]),
        }).state
        registry.markMergeArmed('/a.ts')
      }
      const v = new EditorView({ state: initial, parent: host })
      if (armed) {
        v.dispatch({ effects: diff.reconfigure(unifiedMergeView({ original: baseline, mergeControls: true })) })
      }
      return v
    }

    // Mount 1 (first ever): appends.
    let view = mount()
    assert.equal(getChunks(view.state)?.chunks.length, 2)
    registry.persist('/a.ts', view.state)
    view.destroy()

    // Mount 2 (remount): reconfigures the SAME compartment — no second
    // append, so nothing is left shadowed.
    view = mount()
    assert.equal(getChunks(view.state)?.chunks.length, 2, 'the remount still sees the correct baseline')

    const { diff } = registry.mergeCompartments('/a.ts')!
    view.dispatch({ effects: diff.reconfigure([]) })
    assert.equal(getChunks(view.state), null, 'disarming after a remount actually disarms')

    view.dispatch({
      effects: diff.reconfigure(unifiedMergeView({ original: 'TOTALLY DIFFERENT\n', mergeControls: true })),
    })
    assert.equal(getOriginalDoc(view.state).toString(), 'TOTALLY DIFFERENT\n', 're-arming after a remount actually moves the baseline')

    view.destroy()
  })
})

/** Minimal stand-in exercising the exact BufferRegistry methods CodeEditor's mount effect calls, without a network-backed load(). */
class BufferRegistryForTest {
  #states = new Map<string, EditorState>()
  #compartments = new Map<string, { diff: Compartment; readOnly: Compartment }>()
  #armed = new Set<string>()

  seed(path: string, state: EditorState): void { this.#states.set(path, state) }
  textState(path: string): EditorState {
    const s = this.#states.get(path)
    if (!s) throw new Error(`not seeded: ${path}`)
    return s
  }
  persist(path: string, state: EditorState): void { this.#states.set(path, state) }
  mergeCompartments(path: string): { diff: Compartment; readOnly: Compartment } | undefined {
    if (!this.#states.has(path)) return undefined
    let c = this.#compartments.get(path)
    if (!c) { c = { diff: new Compartment(), readOnly: new Compartment() }; this.#compartments.set(path, c) }
    return c
  }
  isMergeArmed(path: string): boolean { return this.#armed.has(path) }
  markMergeArmed(path: string): void { this.#armed.add(path) }
}

describe('Phase 2 Pre-verification: diff vs presentableDiff on block array encoding', () => {
  test('diff() preserves distinct hunks for block-encoded characters, while presentableDiff collapses them', () => {
    // 5 blocks: a, b, c, d, e encoded as characters
    // baseline: abcde
    // target:   AbcDe (block 0 modified, block 3 modified; separated by 2 unchanged blocks 'bc')
    const base = 'abcde'
    const target = 'AbcDe'

    const rawDiff = diff(base, target)
    const pDiff = presentableDiff(base, target)

    // diff() must produce 2 discrete atomic changes: [0,1) and [3,4)
    assert.equal(rawDiff.length, 2)
    assert.equal(rawDiff[0]?.fromA, 0)
    assert.equal(rawDiff[0]?.toA, 1)
    assert.equal(rawDiff[1]?.fromA, 3)
    assert.equal(rawDiff[1]?.toA, 4)

    // presentableDiff() inappropriately collapses them into 1 single giant change spanning [0,5)
    assert.equal(pDiff.length, 1)
    assert.equal(pDiff[0]?.fromA, 0)
    assert.equal(pDiff[0]?.toA, 5)
  })
})
