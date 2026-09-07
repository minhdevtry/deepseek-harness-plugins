import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { reconstructBaseline } from '../src/client/workbench/reconstructBaseline.ts'

describe('reconstructBaseline (T0-5)', () => {
  test('a genuine create (one hunk, oldText: null, newText: whole file) reconstructs to empty', () => {
    const postWrite = 'line1\nline2\nline3\n'
    const result = reconstructBaseline(postWrite, [{ oldText: null, newText: postWrite }])
    assert.equal(result.ok, true)
    assert.equal(result.text, '')
  })

  test('a single edit fragment reverses back to its pre-edit text', () => {
    const postWrite = 'const a = 1\nconst b = 200\nconst c = 3\n'
    const result = reconstructBaseline(postWrite, [
      { oldText: 'const b = 2', newText: 'const b = 200' },
    ])
    assert.equal(result.ok, true)
    assert.equal(result.text, 'const a = 1\nconst b = 2\nconst c = 3\n')
  })

  test('multiple hunks (an overwrite of an existing file behaves exactly like a multi-hunk edit) reverse independently', () => {
    const postWrite = [
      'block1_ai',
      '// context 1',
      '// context 2',
      '// context 3',
      '// context 4',
      'block3_ai',
    ].join('\n') + '\n'

    const result = reconstructBaseline(postWrite, [
      { oldText: 'block1', newText: 'block1_ai' },
      { oldText: 'block3', newText: 'block3_ai' },
    ])
    assert.equal(result.ok, true)
    assert.equal(result.text, [
      'block1',
      '// context 1',
      '// context 2',
      '// context 3',
      '// context 4',
      'block3',
    ].join('\n') + '\n')
  })

  test('a pure-insertion hunk (oldText: null) reverses by deleting its newText', () => {
    const postWrite = 'line1\nNEW LINE\nline2\n'
    const result = reconstructBaseline(postWrite, [{ oldText: null, newText: 'NEW LINE\n' }])
    assert.equal(result.ok, true)
    assert.equal(result.text, 'line1\nline2\n')
  })

  test('reports ok:false and stops when a hunk\'s newText cannot be located', () => {
    const postWrite = 'completely unrelated content\n'
    const result = reconstructBaseline(postWrite, [{ oldText: 'x', newText: 'this text is not present' }])
    assert.equal(result.ok, false)
    // Best-effort: unreconstructed content is left as-is rather than thrown away.
    assert.equal(result.text, postWrite)
  })

  test('skips a hunk with empty newText rather than corrupting the reconstruction at index 0', () => {
    const postWrite = 'line1\nline2\n'
    const result = reconstructBaseline(postWrite, [{ oldText: 'something', newText: '' }])
    assert.equal(result.ok, true)
    assert.equal(result.text, postWrite)
  })

  test('no hunks reconstructs to the post-write content unchanged', () => {
    const result = reconstructBaseline('unchanged\n', [])
    assert.equal(result.ok, true)
    assert.equal(result.text, 'unchanged\n')
  })
})
