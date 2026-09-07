import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { computeLineSummary } from '../src/client/workbench/lineSummary.ts'

describe('computeLineSummary', () => {
  test('identical text is zero/zero without running the diff at all', () => {
    const text = 'a\nb\nc\n'
    assert.deepEqual(computeLineSummary(text, text), { added: 0, removed: 0 })
  })

  test('a pure insertion counts only added lines', () => {
    const baseline = 'a\nb\n'
    const current = 'a\nNEW1\nNEW2\nb\n'
    assert.deepEqual(computeLineSummary(baseline, current), { added: 2, removed: 0 })
  })

  test('a pure deletion counts only removed lines', () => {
    const baseline = 'a\nb\nc\nd\n'
    const current = 'a\nd\n'
    assert.deepEqual(computeLineSummary(baseline, current), { added: 0, removed: 2 })
  })

  test('a replacement counts both sides', () => {
    const baseline = 'const x = 1\nconst y = 2\nconst z = 3\n'
    const current = 'const x = 1\nconst y = 200\nconst y2 = 201\nconst z = 3\n'
    const result = computeLineSummary(baseline, current)
    assert.equal(result.removed, 1)
    assert.equal(result.added, 2)
  })

  test('a whole-file create (empty baseline) counts every line as added', () => {
    const current = 'line1\nline2\nline3\n'
    assert.deepEqual(computeLineSummary('', current), { added: 3, removed: 0 })
  })

  test('multiple separated changes are summed across chunks', () => {
    const baseline = ['block1', 'ctx1', 'ctx2', 'ctx3', 'ctx4', 'block3'].join('\n')
    const current = ['block1_ai', 'ctx1', 'ctx2', 'ctx3', 'ctx4', 'block3_ai'].join('\n')
    assert.deepEqual(computeLineSummary(baseline, current), { added: 2, removed: 2 })
  })
})
