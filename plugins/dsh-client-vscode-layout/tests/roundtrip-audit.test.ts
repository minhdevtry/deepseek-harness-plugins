import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
;(globalThis as any).window = dom.window
;(globalThis as any).document = dom.window.document
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

import { roundTrip } from '../src/client/tiptap/markdown.ts'

test('roundTrip: Preserves Frontmatter byte-for-byte', () => {
  const src = '---\ntitle: Hello\ntags:\n  - a\n  - b\n---\n\n# Heading\n\nBody text.\n'
  const out = roundTrip(src)
  assert.strictEqual(out.trim(), src.trim())
})

test('roundTrip: Preserves Footnote definitions as opaque lines', () => {
  const src = 'Some text\n\n[^1]: the footnote\n'
  const out = roundTrip(src)
  assert.strictEqual(out.trim(), src.trim())
})

test('roundTrip: Resolves Reference links to valid active markdown links', () => {
  const src = '[label][ref]\n\n[ref]: https://x.com\n'
  const out = roundTrip(src)
  assert.ok(out.includes('[label](https://x.com)'))
})

test('roundTrip: Preserves task lists and tables', () => {
  const taskSrc = '- [ ] todo\n- [x] done\n'
  assert.strictEqual(roundTrip(taskSrc).trim(), taskSrc.trim())

  const tableSrc = '| a | b |\n| :--- | :--- |\n| 1 | 2 |\n'
  assert.ok(roundTrip(tableSrc).includes('| a | b |'))
})

test('roundTrip: Preserves HTML comment inside blockquote without double prefixing', () => {
  const src = '> normal text\n> <!-- c -->\n> more text\n'
  const out = roundTrip(src)
  assert.ok(!out.includes('> >'))
  assert.ok(out.includes('<!-- c -->'))
})

