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

  test('correctly matches second occurrence of identical lines using character offsets', () => {
    const codeDoc = [
      'function foo() {', // Line 1
      '  return 1',        // Line 2
      '}',                // Line 3
      '',                 // Line 4
      'function bar() {', // Line 5
      '  return 1',        // Line 6
      '}',                // Line 7
    ].join('\n')

    const firstIndex = codeDoc.indexOf('  return 1')
    const secondIndex = codeDoc.indexOf('  return 1', firstIndex + 1)

    // Selecting first occurrence (line 2)
    const res1 = getLineRangeForSelection(codeDoc, '  return 1', {
      from: firstIndex,
      to: firstIndex + '  return 1'.length,
    })
    assert.equal(res1.startLine, 2)
    assert.equal(res1.endLine, 2)
    assert.equal(res1.rangeString, '#L2')

    // Selecting second occurrence (line 6) - with offset must be #L6, not #L2
    const res2 = getLineRangeForSelection(codeDoc, '  return 1', {
      from: secondIndex,
      to: secondIndex + '  return 1'.length,
    })
    assert.equal(res2.startLine, 6)
    assert.equal(res2.endLine, 6)
    assert.equal(res2.rangeString, '#L6')

    // Selecting the second closing brace '}' (line 7)
    const firstBrace = codeDoc.indexOf('}')
    const secondBrace = codeDoc.indexOf('}', firstBrace + 1)
    const resBrace = getLineRangeForSelection(codeDoc, '}', {
      from: secondBrace,
      to: secondBrace + 1,
    })
    assert.equal(resBrace.startLine, 7)
    assert.equal(resBrace.endLine, 7)
    assert.equal(resBrace.rangeString, '#L7')
  })
})
