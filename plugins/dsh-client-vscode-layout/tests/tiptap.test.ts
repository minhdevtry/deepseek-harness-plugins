/**
 * TipTap suite & markdown layer unit tests.
 *
 * Run: node --test --experimental-strip-types plugins/dsh-client-vscode-layout/tests/tiptap.test.ts
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { stabilize } from '../src/client/tiptap/markdown.ts'
import { documentExtensions } from '../src/client/tiptap/extensions.ts'
import { Callout } from '../src/client/tiptap/Callout.ts'

describe('stabilize fixed-point algorithm', () => {
  it('settles on the first pass if text is already fixed-point', () => {
    let calls = 0
    const text = '# Hello World\n\nSome paragraph.'
    const result = stabilize(text, (input) => {
      calls += 1
      return input
    })
    assert.equal(result, text)
    assert.equal(calls, 1)
  })

  it('settles on subsequent pass when normalization converges', () => {
    let calls = 0
    const start = 'item 1\n\n\n\nitem 2'
    const once = (input: string) => {
      calls += 1
      return input.replace(/\n{3,}/g, '\n\n')
    }
    const result = stabilize(start, once)
    assert.equal(result, 'item 1\n\nitem 2')
    assert.equal(calls, 2)
  })

  it('stops within maximum pass budget even if serializer drifts infinitely', () => {
    let calls = 0
    const start = 'start'
    // Simulating drift bug: adds blank line on each pass
    const drifting = (input: string) => {
      calls += 1
      return `${input}\n`
    }
    const result = stabilize(start, drifting)
    // MAX_PASSES = 8. Raised from 4 once stabilizing moved off the keystroke
    // path onto save alone: passes are now paid once per write, so the budget
    // buys convergence rather than latency.
    assert.equal(calls, 8)
    assert.equal(result, `start${'\n'.repeat(8)}`)
  })
})

import { Details, DetailsSummary, DetailsContent } from '../src/client/tiptap/details/Details.ts'

describe('TipTap extensions and Callout node', () => {
  it('creates document extensions list with all required Notion suite elements', () => {
    const exts = documentExtensions()
    const names = exts.map(e => e.name)

    assert.ok(names.includes('starterKit'), 'should contain starterKit')
    assert.ok(names.includes('codeBlock'), 'should contain codeBlockLowlight')
    assert.ok(names.includes('table'), 'should contain table')
    assert.ok(names.includes('tableRow'), 'should contain tableRow')
    assert.ok(names.includes('tableHeader'), 'should contain tableHeader')
    assert.ok(names.includes('tableCell'), 'should contain tableCell')
    assert.ok(names.includes('taskList'), 'should contain taskList')
    assert.ok(names.includes('taskItem'), 'should contain taskItem')
    assert.ok(names.includes('callout'), 'should contain custom callout node')
    assert.ok(names.includes('details'), 'should contain custom details node')
    assert.ok(names.includes('detailsSummary'), 'should contain detailsSummary node')
    assert.ok(names.includes('detailsContent'), 'should contain detailsContent node')
    assert.ok(names.includes('image'), 'should contain image')
    assert.ok(names.includes('youtube'), 'should contain youtube')
    assert.ok(names.includes('textStyle'), 'should contain textStyle')
    assert.ok(names.includes('color'), 'should contain color')
    assert.ok(names.includes('characterCount'), 'should contain characterCount')
    assert.ok(names.includes('dropCursor'), 'should contain dropCursor')
    assert.ok(names.includes('markdown'), 'should contain markdown')
  })

  it('Callout node has correct schema attributes and parse tags', () => {
    assert.equal(Callout.name, 'callout')
    assert.equal(Callout.config.group, 'block')
    assert.equal(Callout.config.content, 'block+')
    assert.equal(Callout.config.defining, true)
  })

  it('Details toggle block has correct schema attributes and markdown tokenizers', () => {
    assert.equal(Details.name, 'details')
    assert.equal(Details.config.group, 'block')
    assert.equal(Details.config.content, 'detailsSummary detailsContent')
    assert.equal(Details.config.defining, true)
    assert.equal(Details.config.isolating, true)

    assert.equal(DetailsSummary.name, 'detailsSummary')
    assert.equal(DetailsSummary.config.group, 'block')
    assert.equal(DetailsSummary.config.content, 'inline*')

    assert.equal(DetailsContent.name, 'detailsContent')
    assert.equal(DetailsContent.config.group, 'block')
    assert.equal(DetailsContent.config.content, 'block+')
  })
})
