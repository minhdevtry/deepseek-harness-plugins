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

import { normalizeMarkdownAST } from '../../src/client/tiptap/markdown/pipeline.ts'

test('normalizeMarkdownAST: triệt tiêu thẻ <br /> và <br/> rác thành newline sạch', () => {
  const input = 'Dòng 1<br>Dòng 2<br />Dòng 3<br   />Dòng 4\n'
  const normalized = normalizeMarkdownAST(input)
  assert.ok(!normalized.includes('<br>'), 'chứa thẻ <br>')
  assert.ok(!normalized.includes('<br />'), 'chứa thẻ <br />')
  assert.ok(!normalized.includes('<br   />'), 'chứa thẻ <br   />')
  assert.ok(normalized.includes('Dòng 1\nDòng 2\nDòng 3\nDòng 4'))
})

test('normalizeMarkdownAST: bảo toàn công thức toán học KaTeX $x$ và $$block$$ không bị escape', () => {
  const mathDoc = '# Math\n\nInline $E = mc^2$ and block:\n\n$$\\int_{0}^{1} x^2 dx = \\frac{1}{3}$$\n'
  const normalized = normalizeMarkdownAST(mathDoc)
  assert.ok(normalized.includes('$E = mc^2$'))
  assert.ok(normalized.includes('$$\\int_{0}^{1} x^2 dx = \\frac{1}{3}$$'))
  assert.ok(!normalized.includes('\\$E'), 'bị escape dollar sign')
})

test('normalizeMarkdownAST: nested list chứa fenced code block không bị phình dòng trống qua các lần lưu', () => {
  const listWithCode = '- Step 1\n  ```python\n  print("hello")\n  ```\n- Step 2\n'
  const pass1 = normalizeMarkdownAST(listWithCode)
  const pass2 = normalizeMarkdownAST(pass1)
  const pass3 = normalizeMarkdownAST(pass2)
  assert.strictEqual(pass2, pass1, 'pass 2 differs from pass 1')
  assert.strictEqual(pass3, pass2, 'pass 3 differs from pass 2 - file is growing!')
})

test('normalizeMarkdownAST: bảo toàn callout format chuẩn GitHub / Obsidian', () => {
  const calloutDoc = '> [!NOTE]\n> Đây là nội dung ghi chú quan trọng.\n'
  const normalized = normalizeMarkdownAST(calloutDoc)
  assert.ok(normalized.includes('> [!NOTE]'))
  assert.ok(normalized.includes('> Đây là nội dung ghi chú quan trọng.'))
})
