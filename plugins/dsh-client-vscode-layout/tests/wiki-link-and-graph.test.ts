import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' })
globalThis.window = dom.window as any
globalThis.document = dom.window.document as any
globalThis.HTMLElement = dom.window.HTMLElement as any
globalThis.Element = dom.window.Element as any
globalThis.Node = dom.window.Node as any
globalThis.DOMParser = dom.window.DOMParser as any
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window) as any

import { parseWikiLinkText, formatWikiLink, buildGraphFromDocuments } from '../src/client/tiptap/wiki/wikiLink.ts'

describe('Wiki-Links and Knowledge Graph (Task 9)', () => {
  test('parseWikiLinkText correctly parses target, anchor and alias', () => {
    const parsed1 = parseWikiLinkText('[[my-doc]]')
    assert.deepEqual(parsed1, {
      target: 'my-doc',
      anchor: null,
      alias: null,
    })

    const parsed2 = parseWikiLinkText('[[architecture/overview#database|DB Design]]')
    assert.deepEqual(parsed2, {
      target: 'architecture/overview',
      anchor: 'database',
      alias: 'DB Design',
    })
  })

  test('formatWikiLink formats wiki-link correctly', () => {
    const formatted1 = formatWikiLink({ target: 'guide', anchor: null, alias: null })
    assert.equal(formatted1, '[[guide]]')

    const formatted2 = formatWikiLink({ target: 'guide', anchor: 'step-1', alias: 'Step One' })
    assert.equal(formatted2, '[[guide#step-1|Step One]]')
  })

  test('buildGraphFromDocuments extracts nodes and edges from workspace documents', () => {
    const docs = [
      {
        path: 'index.md',
        content: 'Welcome to [[architecture]] and see [Setup](./setup.md).',
      },
      {
        path: 'architecture.md',
        content: 'Architecture overview. References [[components]] and [[setup]].',
      },
      {
        path: 'setup.md',
        content: 'Setup guide. Back to [[index]].',
      },
      {
        path: 'components.md',
        content: 'Components library.',
      },
    ]

    const graph = buildGraphFromDocuments(docs)
    assert.equal(graph.nodes.length, 4)
    assert.equal(graph.nodes.some(n => n.id === 'index.md'), true)
    assert.equal(graph.nodes.some(n => n.id === 'architecture.md'), true)

    // Check that edges exist between linked documents
    assert.equal(graph.links.length >= 4, true)
    const indexToArch = graph.links.find(l => l.source === 'index.md' && l.target === 'architecture.md')
    assert.ok(indexToArch, 'Expected link from index.md to architecture.md')

    const indexToSetup = graph.links.find(l => l.source === 'index.md' && l.target === 'setup.md')
    assert.ok(indexToSetup, 'Expected link from index.md to setup.md')
  })
})
