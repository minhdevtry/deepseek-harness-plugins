import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { SaveQueue } from '../src/client/workbench/saveQueue.ts'

describe('Agent File Write Watcher & Autosave Hold Integration', () => {
  test('SaveQueue.hold freezes autosave and enqueue while AI write is in flight', async () => {
    const queue = new SaveQueue()
    const path = '/workspace/ARCHITECTURE.md'

    let saveExecuted = false
    const task = async () => {
      saveExecuted = true
      return true
    }

    // 1. Hold autosave for path
    queue.hold(path)
    assert.equal(queue.isHeld(path), true)

    // 2. Attempting to enqueue a save while held returns false immediately
    const enqueuedResult = await queue.enqueue(path, task)
    assert.equal(enqueuedResult, false)
    assert.equal(saveExecuted, false)

    // 3. Reconcile autosave on held path ignores it
    let autosaveFired = false
    queue.reconcileAutosave(new Set([path]), 10, () => {
      autosaveFired = true
    })

    await new Promise(resolve => setTimeout(resolve, 25))
    assert.equal(autosaveFired, false)

    // 4. Release path hold
    queue.release(path)
    assert.equal(queue.isHeld(path), false)

    // 5. Now enqueue works properly
    const postReleaseResult = await queue.enqueue(path, task)
    assert.equal(postReleaseResult, true)
    assert.equal(saveExecuted, true)

    queue.dispose()
  })
})
