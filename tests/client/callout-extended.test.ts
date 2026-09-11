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

import {
  CALLOUT_TYPES,
  normalizeCalloutType,
  Callout,
  type CalloutType,
} from '../../src/client/tiptap/Callout.ts'

test('Callout: defines 15 distinct callout types and maps aliases', () => {
  assert.equal(CALLOUT_TYPES.length, 15, 'Must define exactly 15 callout types')
  const expectedTypes: CalloutType[] = [
    'note', 'tip', 'important', 'warning', 'caution',
    'abstract', 'info', 'todo', 'success', 'question',
    'failure', 'danger', 'bug', 'example', 'quote',
  ]
  for (const t of expectedTypes) {
    assert.ok(CALLOUT_TYPES.includes(t), `Must include ${t}`)
    assert.equal(normalizeCalloutType(t), t)
  }

  // Check aliases
  assert.equal(normalizeCalloutType('summary'), 'abstract')
  assert.equal(normalizeCalloutType('tldr'), 'abstract')
  assert.equal(normalizeCalloutType('check'), 'success')
  assert.equal(normalizeCalloutType('done'), 'success')
  assert.equal(normalizeCalloutType('help'), 'question')
  assert.equal(normalizeCalloutType('faq'), 'question')
  assert.equal(normalizeCalloutType('error'), 'danger')
  assert.equal(normalizeCalloutType('idea'), 'tip')
  assert.equal(normalizeCalloutType('warn'), 'warning')
})

test('Callout schema: supports title, icon, color, collapsible, and defaultOpen attributes', () => {
  const attrs = Callout.config.addAttributes?.call({ options: {} })
  assert.ok(attrs, 'Attributes must be defined')
  assert.ok('type' in attrs, 'Should have type attribute')
  assert.ok('title' in attrs, 'Should have title attribute')
  assert.ok('icon' in attrs, 'Should have icon attribute')
  assert.ok('color' in attrs, 'Should have color attribute')
  assert.ok('collapsible' in attrs, 'Should have collapsible attribute')
  assert.ok('defaultOpen' in attrs, 'Should have defaultOpen attribute')
})

test('Callout renderHTML: renders details/summary for collapsible callouts and div for static', () => {
  const renderHTML = Callout.config.renderHTML

  // Static callout
  const staticRender = renderHTML?.call(
    { options: { HTMLAttributes: {} } } as any,
    { HTMLAttributes: { 'data-callout-type': 'tip' } } as any
  )
  assert.equal(staticRender?.[0], 'div', 'Static callout should render div')

  // Collapsible callout
  const collapsibleRender = renderHTML?.call(
    { options: { HTMLAttributes: {} } } as any,
    {
      HTMLAttributes: {
        'data-callout-type': 'warning',
        'data-collapsible': 'true',
        'data-default-open': 'true',
        'data-title': 'Collapsible Warning',
      },
    } as any
  )
  assert.equal(collapsibleRender?.[0], 'details', 'Collapsible callout should render details')
})

test('Callout markdown tokenizer & serializer: preserves collapsible marker and title', () => {
  const tokenizer = Callout.config.markdownTokenizer
  assert.ok(tokenizer, 'Tokenizer must exist')

  const sample = '> [!NOTE]+ Collapsible Open\n> First body paragraph\n'
  const token = tokenizer.tokenize?.call(
    {} as any,
    sample,
    [],
    { blockTokens: (raw: string) => [{ type: 'paragraph', raw }] } as any
  )
  assert.ok(token, 'Should tokenize callout')
  assert.equal(token.calloutType, 'NOTE')
  assert.equal(token.foldableMarker, '+')
  assert.equal(token.calloutTitle, 'Collapsible Open')

  // Test parseMarkdown
  const node = Callout.config.parseMarkdown?.call(
    {} as any,
    token,
    {
      createNode: (name: string, attrs: any, content: any) => ({ type: name, attrs, content }),
      parseBlockChildren: (toks: any) => toks,
    } as any
  )
  assert.equal(node?.attrs?.type, 'note')
  assert.equal(node?.attrs?.collapsible, true)
  assert.equal(node?.attrs?.defaultOpen, true)
  assert.equal(node?.attrs?.title, 'Collapsible Open')

  // Test renderMarkdown
  const rendered = Callout.config.renderMarkdown?.call(
    {} as any,
    {
      attrs: {
        type: 'note',
        collapsible: true,
        defaultOpen: true,
        title: 'Collapsible Open',
      },
      content: [],
    } as any,
    { renderChildren: () => 'First body paragraph' } as any
  )
  assert.equal(rendered, '> [!NOTE]+ Collapsible Open\n> First body paragraph')
})

