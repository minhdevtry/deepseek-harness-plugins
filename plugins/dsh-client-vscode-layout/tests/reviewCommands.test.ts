/**
 * Cross-tree review command seat unit tests.
 *
 * This is the whole seam `TurnReviewCard` reaches Workbench's live
 * accept/reject through — getting the install/notify contract wrong means a
 * chat-side accept or reject either does nothing or throws.
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import {
  installReviewCommands,
  reviewCommands,
  subscribeReviewCommands,
  getReviewCommandsVersion,
  notifyReviewCommandsChanged,
  type ReviewCommandsApi,
} from '../src/client/workbench/reviewCommands.ts'

function fakeApi(overrides?: Partial<ReviewCommandsApi>): ReviewCommandsApi {
  return {
    summaryForTurn: () => [],
    acceptAll: () => {},
    rejectAll: async () => {},
    ...overrides,
  }
}

describe('reviewCommands seat', () => {
  it('is inert (empty results, no-op commands) until Workbench installs one', async () => {
    assert.deepEqual(reviewCommands().summaryForTurn('7'), [])
    assert.doesNotThrow(() => { reviewCommands().acceptAll('/w/a.ts') })
    await assert.doesNotReject(() => reviewCommands().rejectAll('/w/a.ts'))
  })

  it('routes to the installed implementation and restores the inert default', async () => {
    const seen: string[] = []
    const retract = installReviewCommands(fakeApi({
      summaryForTurn: (turnId) => [{ path: `/w/${turnId}.ts`, added: 1, removed: 0 }],
      acceptAll: (path) => { seen.push(path) },
    }))
    assert.deepEqual(reviewCommands().summaryForTurn('3'), [{ path: '/w/3.ts', added: 1, removed: 0 }])
    reviewCommands().acceptAll('/w/x.ts')
    assert.deepEqual(seen, ['/w/x.ts'])

    retract()
    assert.deepEqual(reviewCommands().summaryForTurn('3'), [])
  })

  it('lets a newer install win and ignores the stale disposer', () => {
    // Two Workbench mounts overlapping across a remount must not leave the
    // seam inert — the same invariant fileOpener.ts's seat already keeps.
    const retractFirst = installReviewCommands(fakeApi({ summaryForTurn: () => [{ path: '/w/first.ts', added: 0, removed: 0 }] }))
    installReviewCommands(fakeApi({ summaryForTurn: () => [{ path: '/w/second.ts', added: 0, removed: 0 }] }))
    retractFirst()
    assert.deepEqual(reviewCommands().summaryForTurn('_'), [{ path: '/w/second.ts', added: 0, removed: 0 }])
  })

  it('bumps the version and notifies subscribers on install, uninstall, and explicit notify', () => {
    const versions: number[] = []
    const unsubscribe = subscribeReviewCommands(() => { versions.push(getReviewCommandsVersion()) })
    const startVersion = getReviewCommandsVersion()

    const retract = installReviewCommands(fakeApi())
    notifyReviewCommandsChanged()
    retract()

    assert.equal(versions.length, 3, 'install, explicit notify, and uninstall must each notify once')
    assert.deepEqual(versions, [startVersion + 1, startVersion + 2, startVersion + 3])
    unsubscribe()
  })

  it('a throwing subscriber does not stop the others from being notified', () => {
    let secondFired = false
    const unsubscribeFirst = subscribeReviewCommands(() => { throw new Error('boom') })
    const unsubscribeSecond = subscribeReviewCommands(() => { secondFired = true })
    assert.doesNotThrow(() => { notifyReviewCommandsChanged() })
    assert.equal(secondFired, true)
    unsubscribeFirst()
    unsubscribeSecond()
  })
})
