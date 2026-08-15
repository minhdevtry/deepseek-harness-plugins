/**
 * Tab-strip model tests.
 *
 * Run: node --test --experimental-strip-types plugins/dsh-client-vscode-layout/tests/tabs.test.ts
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import {
  activeAfterBulk, activeAfterClose, close, closeOthers, closeToLeft, closeToRight, move, open,
} from '../src/client/workbench/model/tabs.ts'

const TABS = ['/a.ts', '/b.ts', '/c.ts', '/d.ts']

describe('open', () => {
  it('appends a new path', () => {
    assert.deepEqual(open(['/a.ts'], '/b.ts'), ['/a.ts', '/b.ts'])
  })

  it('leaves the order alone when the path is already open', () => {
    // Reopening from the explorer must not yank the tab to the end, under the
    // operator's cursor.
    assert.deepEqual(open(TABS, '/b.ts'), TABS)
  })

  it('never mutates its input', () => {
    const input = ['/a.ts']
    open(input, '/b.ts')
    assert.deepEqual(input, ['/a.ts'])
  })
})

describe('bulk closes', () => {
  it('closes one', () => {
    assert.deepEqual(close(TABS, '/b.ts'), ['/a.ts', '/c.ts', '/d.ts'])
  })

  it('closes others', () => {
    assert.deepEqual(closeOthers(TABS, '/c.ts'), ['/c.ts'])
  })

  it('closes to the left, keeping the anchor', () => {
    assert.deepEqual(closeToLeft(TABS, '/c.ts'), ['/c.ts', '/d.ts'])
  })

  it('closes to the right, keeping the anchor', () => {
    assert.deepEqual(closeToRight(TABS, '/b.ts'), ['/a.ts', '/b.ts'])
  })

  it('is a no-op for an anchor that is not open', () => {
    assert.deepEqual(closeToLeft(TABS, '/zz.ts'), TABS)
    assert.deepEqual(closeToRight(TABS, '/zz.ts'), TABS)
  })

  it('closes everything when told to keep a tab that is not open', () => {
    assert.deepEqual(closeOthers(TABS, '/zz.ts'), [])
  })
})

describe('move', () => {
  it('reorders', () => {
    assert.deepEqual(move(TABS, 0, 2), ['/b.ts', '/c.ts', '/a.ts', '/d.ts'])
    assert.deepEqual(move(TABS, 3, 0), ['/d.ts', '/a.ts', '/b.ts', '/c.ts'])
  })

  it('clamps a drop past the end instead of losing the tab', () => {
    assert.deepEqual(move(TABS, 0, 99), ['/b.ts', '/c.ts', '/d.ts', '/a.ts'])
    assert.deepEqual(move(TABS, 2, -5), ['/c.ts', '/a.ts', '/b.ts', '/d.ts'])
  })

  it('ignores an out-of-range source', () => {
    assert.deepEqual(move(TABS, 9, 0), TABS)
  })

  it('keeps every tab', () => {
    for (let from = 0; from < TABS.length; from += 1) {
      for (let to = 0; to < TABS.length; to += 1) {
        assert.equal(move(TABS, from, to).length, TABS.length, `${from}->${to}`)
      }
    }
  })
})

describe('activeAfterClose', () => {
  it('leaves the selection alone when a background tab closes', () => {
    assert.equal(activeAfterClose(TABS, '/a.ts', '/c.ts'), '/c.ts')
  })

  it('takes the right-hand neighbour when the active tab closes', () => {
    assert.equal(activeAfterClose(TABS, '/b.ts', '/b.ts'), '/c.ts')
  })

  it('falls back to the left when the active tab was last', () => {
    assert.equal(activeAfterClose(TABS, '/d.ts', '/d.ts'), '/c.ts')
  })

  it('reports nothing when the only tab closes', () => {
    assert.equal(activeAfterClose(['/a.ts'], '/a.ts', '/a.ts'), undefined)
  })

  it('keeps closing in one direction across a run', () => {
    // Repeatedly closing the active tab should walk rightward, not bounce.
    let tabs: readonly string[] = TABS
    let active: string | undefined = '/b.ts'
    const seen: (string | undefined)[] = []
    while (active !== undefined) {
      const next = activeAfterClose(tabs, active, active)
      tabs = close(tabs, active)
      active = next
      seen.push(active)
    }
    assert.deepEqual(seen, ['/c.ts', '/d.ts', '/a.ts', undefined])
  })
})

describe('activeAfterBulk', () => {
  it('keeps a surviving selection', () => {
    assert.equal(activeAfterBulk(['/a.ts', '/c.ts'], '/c.ts'), '/c.ts')
  })

  it('falls back to the last survivor', () => {
    assert.equal(activeAfterBulk(['/a.ts', '/c.ts'], '/b.ts'), '/c.ts')
  })

  it('reports nothing when everything closed', () => {
    assert.equal(activeAfterBulk([], '/b.ts'), undefined)
  })
})
