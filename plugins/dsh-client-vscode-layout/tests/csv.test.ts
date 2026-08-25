import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv } from '../src/client/workbench/previews/csv.ts'

describe('parseCsv', () => {
  test('parses simple comma-separated values', () => {
    const raw = 'name,age,city\nAlice,30,New York\nBob,25,San Francisco'
    const result = parseCsv(raw)
    assert.deepEqual(result, [
      ['name', 'age', 'city'],
      ['Alice', '30', 'New York'],
      ['Bob', '25', 'San Francisco'],
    ])
  })

  test('parses quoted cells containing newlines (RFC 4180 multiline cell)', () => {
    const raw = 'id,description,status\n1,"Line 1\nLine 2\nLine 3",active\n2,"Single line",done'
    const result = parseCsv(raw)
    assert.equal(result.length, 3)
    assert.deepEqual(result[0], ['id', 'description', 'status'])
    assert.deepEqual(result[1], ['1', 'Line 1\nLine 2\nLine 3', 'active'])
    assert.deepEqual(result[2], ['2', 'Single line', 'done'])
  })

  test('parses quoted cells containing escaped quotes ("")', () => {
    const raw = 'id,quote,author\n1,"He said, ""Hello, world!""",Anonymous\n2,"Plain quote",Me'
    const result = parseCsv(raw)
    assert.equal(result.length, 3)
    assert.deepEqual(result[1], ['1', 'He said, "Hello, world!"', 'Anonymous'])
    assert.deepEqual(result[2], ['2', 'Plain quote', 'Me'])
  })

  test('parses multiline cell with escaped quotes and commas', () => {
    const raw = 'header\n"Item with ""quotes"",\ncommas,\nand multiple lines"'
    const result = parseCsv(raw)
    assert.equal(result.length, 2)
    assert.deepEqual(result[1], ['Item with "quotes",\ncommas,\nand multiple lines'])
  })

  test('handles CRLF line breaks correctly', () => {
    const raw = 'a,b,c\r\n1,2,3\r\n4,5,6'
    const result = parseCsv(raw)
    assert.deepEqual(result, [
      ['a', 'b', 'c'],
      ['1', '2', '3'],
      ['4', '5', '6'],
    ])
  })

  test('supports TSV tab delimiter', () => {
    const raw = 'col1\tcol2\tcol3\nval1\t"val2\nwith\nnewlines"\tval3'
    const result = parseCsv(raw, '\t')
    assert.deepEqual(result, [
      ['col1', 'col2', 'col3'],
      ['val1', 'val2\nwith\nnewlines', 'val3'],
    ])
  })

  test('returns empty array on empty input', () => {
    assert.deepEqual(parseCsv(''), [])
    assert.deepEqual(parseCsv('   \n  '), [])
  })
})
