/**
 * Concession-chain solver tests. This logic used to live inside a regex patch
 * against a compiled bundle, where the only way to exercise it was to launch a
 * browser. As a pure module it is directly callable.
 *
 * Run: node --test --experimental-strip-types plugins/dsh-client-vscode-layout/tests/columns.test.ts
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import {
  CENTER_MIN, RIGHT_MIN, SIDEBAR_MAX, SIDEBAR_MIN, clampWidth, computeColumns, rightMax,
} from '../src/client/columns.ts'

describe('clampWidth', () => {
  it('clamps into range and rounds to whole pixels', () => {
    assert.equal(clampWidth(100, 220, 500), 220)
    assert.equal(clampWidth(900, 220, 500), 500)
    assert.equal(clampWidth(300.6, 220, 500), 301)
  })
})

describe('rightMax', () => {
  it('scales with the viewport once past the absolute floor', () => {
    assert.equal(rightMax(2000), Math.floor(2000 * 0.82))
    // Narrow viewports keep a usable panel rather than a proportional sliver.
    assert.equal(rightMax(400), 480)
  })
})

describe('computeColumns', () => {
  it('honours both preferences when they fit', () => {
    const cols = computeColumns(1600, 280, 440)
    assert.deepEqual(cols, { sidebar: 280, center: 880, right: 440 })
  })

  it('always partitions the viewport exactly', () => {
    for (const viewport of [320, 700, 1024, 1440, 2560]) {
      for (const right of [0, 440, 1200]) {
        const cols = computeColumns(viewport, 280, right)
        assert.equal(cols.sidebar + cols.center + cols.right, viewport, `viewport=${viewport} right=${right}`)
      }
    }
  })

  it('shrinks the right column before the editor drops below its floor', () => {
    const cols = computeColumns(1000, 280, 600)
    assert.equal(cols.center, CENTER_MIN)
    assert.equal(cols.right, 1000 - 280 - CENTER_MIN)
    assert.ok(cols.right >= RIGHT_MIN)
  })

  it('auto-closes the right column when even its floor will not fit', () => {
    const cols = computeColumns(700, 280, 440)
    assert.equal(cols.right, 0)
    assert.equal(cols.sidebar, 280)
    assert.equal(cols.center, 420)
  })

  it('concedes the sidebar only as the last resort', () => {
    const cols = computeColumns(400, 280, 440)
    assert.deepEqual(cols, { sidebar: 0, center: 400, right: 0 })
  })

  it('treats a zero preference as closed rather than clamping it up', () => {
    const cols = computeColumns(1600, 0, 0)
    assert.deepEqual(cols, { sidebar: 0, center: 1600, right: 0 })
  })

  it('clamps a sidebar preference into its contract range', () => {
    assert.equal(computeColumns(2000, 50, 0).sidebar, SIDEBAR_MIN)
    assert.equal(computeColumns(2000, 9000, 0).sidebar, SIDEBAR_MAX)
  })

  it('lets the right column take most of the frame when asked', () => {
    const cols = computeColumns(1600, 0, 1300)
    assert.equal(cols.right, 1300)
    assert.equal(cols.center, 300)
  })
})
