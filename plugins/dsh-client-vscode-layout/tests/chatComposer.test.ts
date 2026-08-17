import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { getLineRangeForSelection } from '../src/client/utils/chatComposer.ts'

describe('getLineRangeForSelection', () => {
  const doc = [
    '# Title',
    '',
    'First paragraph with some text.',
    'Second paragraph with specific content here.',
    'Third line is interesting.',
    '',
    '## Section 2',
    'List item 1',
    'List item 2',
    'List item 3',
  ].join('\n')

  test('locates single line selection accurately', () => {
    const res = getLineRangeForSelection(doc, 'First paragraph with some text.')
    assert.equal(res.startLine, 3)
    assert.equal(res.endLine, 3)
    assert.equal(res.rangeString, '#L3')
  })

  test('locates multi-line selection accurately', () => {
    const sel = ['Second paragraph with specific content here.', 'Third line is interesting.'].join('\n')
    const res = getLineRangeForSelection(doc, sel)
    assert.equal(res.startLine, 4)
    assert.equal(res.endLine, 5)
    assert.equal(res.rangeString, '#L4-L5')
  })

  test('locates partial selection within a line', () => {
    const res = getLineRangeForSelection(doc, 'Section 2')
    assert.equal(res.startLine, 7)
    assert.equal(res.endLine, 7)
    assert.equal(res.rangeString, '#L7')
  })

  test('locates list items selection across multiple lines', () => {
    const sel = ['List item 1', 'List item 2', 'List item 3'].join('\n')
    const res = getLineRangeForSelection(doc, sel)
    assert.equal(res.startLine, 8)
    assert.equal(res.endLine, 10)
    assert.equal(res.rangeString, '#L8-L10')
  })

  test('falls back gracefully on empty selection or document', () => {
    const res = getLineRangeForSelection(doc, '')
    assert.equal(res.rangeString, '')

    const res2 = getLineRangeForSelection('', 'something')
    assert.equal(res2.rangeString, '')
  })
})
