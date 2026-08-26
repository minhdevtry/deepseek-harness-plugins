import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { formatModShortcut, formatRedoShortcut } from '../src/client/utils/platform.ts'

describe('platform utilities', () => {
  test('formatModShortcut formats modifier shortcut', () => {
    const s1 = formatModShortcut('k')
    assert.ok(s1.includes('K'))

    const s2 = formatModShortcut('f')
    assert.ok(s2.includes('F'))

    const s3 = formatModShortcut('z', { shift: true })
    assert.ok(s3.includes('Z'))
  })

  test('formatRedoShortcut returns non-empty redo shortcut string', () => {
    const redo = formatRedoShortcut()
    assert.ok(redo === 'Ctrl+Y' || redo === '⇧⌘Z')
  })
})
