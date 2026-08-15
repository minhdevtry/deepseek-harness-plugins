/**
 * Buffer registry tests.
 *
 * The registry is a plain class precisely so this file can exist: dirty
 * tracking, save rebasing and the load race are all assertable without a
 * browser. `fetch` is the only seam, and it is stubbed per test.
 *
 * Run: node --test --experimental-strip-types plugins/dsh-client-vscode-layout/tests/buffers.test.ts
 */
import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { EditorState } from '@codemirror/state'
import { BufferRegistry } from '../src/client/workbench/buffers.ts'

const realFetch = globalThis.fetch

afterEach(() => { globalThis.fetch = realFetch })

/** Stub `fetch` with a per-route handler and count the calls it receives. */
function stubFetch(handler: (url: string, init?: RequestInit) => unknown): { calls: string[] } {
  const calls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push(url)
    const body = handler(url, init)
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  return { calls }
}

/** A registry with no extensions — none of these assertions need a view. */
function registry(): BufferRegistry {
  return new BufferRegistry(() => [])
}

/** Type-narrowing accessor: fail loudly rather than assert on a union. */
function textBuffer(reg: BufferRegistry, path: string) {
  const status = reg.status(path)
  assert.equal(status?.kind, 'text', `expected a text buffer for ${path}`)
  return status as Extract<NonNullable<ReturnType<BufferRegistry['status']>>, { kind: 'text' }>
}

describe('load', () => {
  it('reads a file into a clean buffer', async () => {
    stubFetch(() => ({ ok: true, kind: 'text', content: 'hello\nworld', size: 11 }))
    const reg = registry()
    await reg.load('/a.ts')
    const buffer = textBuffer(reg, '/a.ts')
    assert.equal(buffer.state.doc.toString(), 'hello\nworld')
    assert.equal(buffer.dirty, false)
    assert.equal(reg.isDirty('/a.ts'), false)
  })

  it('issues one read when two callers race', async () => {
    const { calls } = stubFetch(() => ({ ok: true, kind: 'text', content: 'x', size: 1 }))
    const reg = registry()
    await Promise.all([reg.load('/a.ts'), reg.load('/a.ts'), reg.load('/a.ts')])
    assert.equal(calls.filter(url => url.includes('/read')).length, 1)
  })

  it('does not re-read an already loaded buffer', async () => {
    const { calls } = stubFetch(() => ({ ok: true, kind: 'text', content: 'x', size: 1 }))
    const reg = registry()
    await reg.load('/a.ts')
    await reg.load('/a.ts')
    assert.equal(calls.filter(url => url.includes('/read')).length, 1)
  })

  it('keeps a binary file out of the editor', async () => {
    stubFetch(() => ({ ok: true, kind: 'binary', content: '', size: 4096 }))
    const reg = registry()
    await reg.load('/logo.png')
    assert.deepEqual(reg.status('/logo.png'), { kind: 'binary', size: 4096 })
  })

  it('opens a truncated file read-only', async () => {
    stubFetch(() => ({ ok: true, kind: 'too-large', content: 'head', size: 9_000_000 }))
    const reg = registry()
    await reg.load('/huge.log')
    assert.equal(textBuffer(reg, '/huge.log').truncated, true)
  })

  it('records a failed read as an error buffer', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false, error: 'nope' }), {
      status: 403, headers: { 'content-type': 'application/json' },
    })) as typeof fetch
    const reg = registry()
    await reg.load('/secret')
    assert.deepEqual(reg.status('/secret'), { kind: 'error', message: 'nope' })
  })
})

describe('sync and dirtiness', () => {
  it('goes dirty on an edit and clean again when the text matches disk', async () => {
    stubFetch(() => ({ ok: true, kind: 'text', content: 'abc', size: 3 }))
    const reg = registry()
    await reg.load('/a.ts')

    const edited = EditorState.create({ doc: 'abcd' })
    reg.sync('/a.ts', edited)
    assert.equal(reg.isDirty('/a.ts'), true)

    // Typing the change back out is not "still modified".
    reg.sync('/a.ts', EditorState.create({ doc: 'abc' }))
    assert.equal(reg.isDirty('/a.ts'), false)
  })

  it('notifies only when the dirty flag flips, not on every keystroke', async () => {
    stubFetch(() => ({ ok: true, kind: 'text', content: 'abc', size: 3 }))
    const reg = registry()
    await reg.load('/a.ts')

    let notifications = 0
    reg.subscribe(() => { notifications += 1 })

    reg.sync('/a.ts', EditorState.create({ doc: 'abcd' }))   // clean -> dirty: 1
    reg.sync('/a.ts', EditorState.create({ doc: 'abcde' }))  // still dirty: 0
    reg.sync('/a.ts', EditorState.create({ doc: 'abcdef' })) // still dirty: 0
    assert.equal(notifications, 1)
  })

  it('keeps the snapshot reference stable between changes', async () => {
    stubFetch(() => ({ ok: true, kind: 'text', content: 'abc', size: 3 }))
    const reg = registry()
    await reg.load('/a.ts')
    const first = reg.getSnapshot()
    reg.sync('/a.ts', EditorState.create({ doc: 'abcd' }))
    const second = reg.getSnapshot()
    // A fresh object per read would make useSyncExternalStore loop forever.
    assert.equal(reg.getSnapshot(), second)
    assert.notEqual(first, second)
    assert.deepEqual([...second.dirty], ['/a.ts'])
  })
})

describe('save', () => {
  it('writes the document and rebases the dirty comparison', async () => {
    const bodies: string[] = []
    stubFetch((url, init) => {
      if (url.includes('/write')) {
        bodies.push(String(init?.body))
        return { ok: true, size: 4 }
      }
      return { ok: true, kind: 'text', content: 'abc', size: 3 }
    })
    const reg = registry()
    await reg.load('/a.ts')
    reg.sync('/a.ts', EditorState.create({ doc: 'abcd' }))

    const result = await reg.save('/a.ts')
    assert.equal(result.ok, true)
    assert.equal(reg.isDirty('/a.ts'), false)
    assert.match(bodies[0] ?? '', /"content":"abcd"/)
  })

  it('stays dirty when the operator types while the save is in flight', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/write')) {
        await gate
        return new Response(JSON.stringify({ ok: true, size: 4 }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ ok: true, kind: 'text', content: 'abc', size: 3 }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch

    const reg = registry()
    await reg.load('/a.ts')
    reg.sync('/a.ts', EditorState.create({ doc: 'abcd' }))

    const saving = reg.save('/a.ts')
    // A keystroke lands after the write was issued but before it returned.
    reg.sync('/a.ts', EditorState.create({ doc: 'abcde' }))
    release?.()
    await saving

    // Marking this clean would claim 'abcde' is on disk when 'abcd' was written.
    assert.equal(reg.isDirty('/a.ts'), true)
  })

  it('refuses to save a truncated file', async () => {
    stubFetch(() => ({ ok: true, kind: 'too-large', content: 'head', size: 9_000_000 }))
    const reg = registry()
    await reg.load('/huge.log')
    const result = await reg.save('/huge.log')
    assert.equal(result.ok, false)
  })

  it('reports a write refusal without claiming the buffer is clean', async () => {
    stubFetch((url) => (url.includes('/write')
      ? { ok: false, error: 'Access Denied' }
      : { ok: true, kind: 'text', content: 'abc', size: 3 }))
    const reg = registry()
    await reg.load('/a.ts')
    reg.sync('/a.ts', EditorState.create({ doc: 'abcd' }))
    const result = await reg.save('/a.ts')
    assert.equal(result.ok, false)
    assert.equal(reg.isDirty('/a.ts'), true)
  })
})

describe('revertSpec', () => {
  it('describes a change back to the disk text', async () => {
    stubFetch(() => ({ ok: true, kind: 'text', content: 'abc', size: 3 }))
    const reg = registry()
    await reg.load('/a.ts')
    reg.sync('/a.ts', EditorState.create({ doc: 'abcXYZ' }))

    const spec = reg.revertSpec('/a.ts')
    assert.notEqual(spec, undefined)
    assert.equal(spec?.changes.from, 0)
    assert.equal(spec?.changes.to, 6)
    assert.equal(spec?.changes.insert.toString(), 'abc')
  })

  it('is undefined for a clean buffer', async () => {
    stubFetch(() => ({ ok: true, kind: 'text', content: 'abc', size: 3 }))
    const reg = registry()
    await reg.load('/a.ts')
    assert.equal(reg.revertSpec('/a.ts'), undefined)
  })
})

describe('forget', () => {
  it('drops the buffer and clears its dirty mark', async () => {
    stubFetch(() => ({ ok: true, kind: 'text', content: 'abc', size: 3 }))
    const reg = registry()
    await reg.load('/a.ts')
    reg.sync('/a.ts', EditorState.create({ doc: 'abcd' }))
    assert.deepEqual([...reg.getSnapshot().dirty], ['/a.ts'])

    reg.forget('/a.ts')
    assert.equal(reg.status('/a.ts'), undefined)
    assert.deepEqual([...reg.getSnapshot().dirty], [])
  })

  it('still loads when the tab is closed mid-read and reopened at once', async () => {
    // Regression: the in-flight promise used to be shared through the loading
    // map, so the reopen was handed the retired read — which then discarded
    // its own result on settling, leaving the tab blank for good.
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    let reads = 0
    globalThis.fetch = (async () => {
      reads += 1
      if (reads === 1) await gate
      return new Response(JSON.stringify({ ok: true, kind: 'text', content: `read${reads}`, size: 5 }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const reg = registry()
    const first = reg.load('/a.ts')
    reg.forget('/a.ts')
    const second = reg.load('/a.ts')
    release?.()
    await Promise.all([first, second])

    assert.equal(textBuffer(reg, '/a.ts').state.doc.toString(), 'read2')
  })

  it('lets a reload supersede a read that is still in flight', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    let reads = 0
    globalThis.fetch = (async () => {
      reads += 1
      if (reads === 1) await gate
      return new Response(JSON.stringify({ ok: true, kind: 'text', content: `read${reads}`, size: 5 }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const reg = registry()
    const first = reg.load('/a.ts')
    const second = reg.reload('/a.ts')
    release?.()
    await Promise.all([first, second])

    // The stale first read must not overwrite the fresher one.
    assert.equal(textBuffer(reg, '/a.ts').state.doc.toString(), 'read2')
  })

  it('does not resurrect a buffer whose read landed after the tab closed', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    globalThis.fetch = (async () => {
      await gate
      return new Response(JSON.stringify({ ok: true, kind: 'text', content: 'abc', size: 3 }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const reg = registry()
    const loading = reg.load('/a.ts')
    reg.forget('/a.ts')
    release?.()
    await loading

    assert.equal(reg.status('/a.ts'), undefined)
  })
})

describe('setText and getText', () => {
  it('updates text content and marks buffer dirty', async () => {
    stubFetch(() => ({ ok: true, kind: 'text', content: '# Original Title', size: 16 }))
    const reg = registry()
    await reg.load('/note.md')

    assert.equal(reg.getText('/note.md'), '# Original Title')
    assert.equal(reg.isDirty('/note.md'), false)

    reg.setText('/note.md', '# New Notion Heading\n\nSome body text.')
    assert.equal(reg.getText('/note.md'), '# New Notion Heading\n\nSome body text.')
    assert.equal(reg.isDirty('/note.md'), true)

    // Reverting to original disk text clears dirty flag
    reg.setText('/note.md', '# Original Title')
    assert.equal(reg.isDirty('/note.md'), false)
  })

  it('notifies subscribers only when dirty state flips', async () => {
    stubFetch(() => ({ ok: true, kind: 'text', content: 'hello', size: 5 }))
    const reg = registry()
    await reg.load('/note.md')

    let notifications = 0
    reg.subscribe(() => { notifications += 1 })

    // First change: clean -> dirty (should notify)
    reg.setText('/note.md', 'hello world')
    assert.equal(notifications, 1)

    // Second change: still dirty (should not notify)
    reg.setText('/note.md', 'hello world again')
    assert.equal(notifications, 1)

    // Third change: back to clean (should notify)
    reg.setText('/note.md', 'hello')
    assert.equal(notifications, 2)
  })

  it('ignores setText for non-loaded or non-text buffers', () => {
    const reg = registry()
    assert.doesNotThrow(() => {
      reg.setText('/missing.md', 'some text')
    })
    assert.equal(reg.getText('/missing.md'), undefined)
  })
})
