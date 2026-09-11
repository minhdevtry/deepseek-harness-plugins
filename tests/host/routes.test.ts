import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHostRequestHandler, registerHostRoutes } from '../../src/host/routes.ts'
import { isInsideSandbox } from '../../src/host/fileService.ts'
import { apply, name, inject } from '../../src/index.ts'

test('isInsideSandbox correctly rejects traversal attempts and allows inner paths', () => {
  const root = '/workspace/project'
  assert.equal(isInsideSandbox('/workspace/project', root), true)
  assert.equal(isInsideSandbox('/workspace/project/src/index.ts', root), true)
  assert.equal(isInsideSandbox('/workspace/project/nested/sub/file.txt', root), true)
  assert.equal(isInsideSandbox('/workspace/project/..hidden', root), true)

  // Traversals
  assert.equal(isInsideSandbox('/workspace/project/../../etc/passwd', root), false)
  assert.equal(isInsideSandbox('/workspace/other', root), false)
  assert.equal(isInsideSandbox('/etc/shadow', root), false)
  assert.equal(isInsideSandbox('..', root), false)
  assert.equal(isInsideSandbox('/workspace/project/../..', root), false)

  // Null byte injection
  assert.equal(isInsideSandbox('/workspace/project/\0evil', root), false)
})

test('HTTP Routes enforce sandbox traversal security', async () => {
  const tempSandbox = await mkdtemp(join(tmpdir(), 'dsh-routes-sandbox-'))
  const outsideDir = await mkdtemp(join(tmpdir(), 'dsh-routes-outside-'))
  const outsideFile = join(outsideDir, 'secret.txt')
  await writeFile(outsideFile, 'secret content', 'utf8')

  const handler = createHostRequestHandler({ sandboxRoot: tempSandbox })
  const server = http.createServer((req, res) => {
    handler(req, res).catch((err) => {
      res.writeHead(500)
      res.end(err.message)
    })
  })

  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as any).port
  const baseUrl = `http://localhost:${port}`

  try {
    // 1. GET /vscode-files/read traversal attempt -> 403
    {
      const res = await fetch(`${baseUrl}/vscode-files/read?path=${encodeURIComponent(outsideFile)}`)
      assert.equal(res.status, 403)
      const data = await res.json()
      assert.equal(data.ok, false)
      assert.match(data.error, /Access Denied/)
    }

    // 2. GET /vscode-files/list traversal attempt -> 403
    {
      const res = await fetch(`${baseUrl}/vscode-files/list?path=${encodeURIComponent(outsideDir)}`)
      assert.equal(res.status, 403)
      const data = await res.json()
      assert.equal(data.ok, false)
      assert.match(data.error, /Access Denied/)
    }

    // 3. POST /vscode-files/write traversal attempt -> 403
    {
      const res = await fetch(`${baseUrl}/vscode-files/write`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: join(outsideDir, 'hack.txt'), content: 'bad' }),
      })
      assert.equal(res.status, 403)
      const data = await res.json()
      assert.equal(data.ok, false)
      assert.match(data.error, /Access Denied/)
    }

    // 4. POST /vscode-files/mkdir traversal attempt -> 403
    {
      const res = await fetch(`${baseUrl}/vscode-files/mkdir`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: outsideDir, name: 'hacked-dir' }),
      })
      assert.equal(res.status, 403)
      const data = await res.json()
      assert.equal(data.ok, false)
      assert.match(data.error, /Access Denied/)
    }

    // 5. POST /vscode-files/mkfile traversal attempt -> 403
    {
      const res = await fetch(`${baseUrl}/vscode-files/mkfile`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: outsideDir, name: 'hacked.txt' }),
      })
      assert.equal(res.status, 403)
      const data = await res.json()
      assert.equal(data.ok, false)
      assert.match(data.error, /Access Denied/)
    }

    // 6. POST /vscode-files/rename traversal attempt -> 403
    {
      const res = await fetch(`${baseUrl}/vscode-files/rename`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: outsideFile, newName: 'renamed.txt' }),
      })
      assert.equal(res.status, 403)
      const data = await res.json()
      assert.equal(data.ok, false)
      assert.match(data.error, /Access Denied/)
    }

    // 7. POST /vscode-files/delete traversal attempt -> 403
    {
      const res = await fetch(`${baseUrl}/vscode-files/delete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: outsideFile }),
      })
      assert.equal(res.status, 403)
      const data = await res.json()
      assert.equal(data.ok, false)
      assert.match(data.error, /Access Denied/)
    }

    // 8. POST /vscode-files/delete root traversal attempt -> 403
    {
      const res = await fetch(`${baseUrl}/vscode-files/delete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: '/' }),
      })
      assert.equal(res.status, 403)
      const data = await res.json()
      assert.equal(data.ok, false)
      assert.match(data.error, /Access Denied/)
    }

    // 8a. POST /vscode-files/upload-image traversal attempt -> 403
    {
      const res = await fetch(`${baseUrl}/vscode-files/upload-image`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          root: outsideDir,
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          mimeType: 'image/png',
        }),
      })
      assert.equal(res.status, 403)
      const data = await res.json()
      assert.equal(data.ok, false)
      assert.match(data.error, /Access Denied/)
    }

    // 8b. POST /vscode-files/git/stage traversal file attempt -> 403
    {
      const res = await fetch(`${baseUrl}/vscode-files/git/stage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ root: tempSandbox, file: '../../outside.txt' }),
      })
      assert.equal(res.status, 403)
      const data = await res.json()
      assert.equal(data.ok, false)
      assert.match(data.error, /Access Denied/)
    }

    // 8c. POST /vscode-files/git/stage traversal root attempt -> 403
    {
      const res = await fetch(`${baseUrl}/vscode-files/git/stage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ root: outsideDir, file: 'secret.txt' }),
      })
      assert.equal(res.status, 403)
      const data = await res.json()
      assert.equal(data.ok, false)
      assert.match(data.error, /Access Denied/)
    }

    // 9. Valid operations inside sandbox work correctly
    {
      // sandbox-info
      const infoRes = await fetch(`${baseUrl}/vscode-files/sandbox-info`)
      assert.equal(infoRes.status, 200)
      const infoData = await infoRes.json()
      assert.equal(infoData.ok, true)
      assert.equal(infoData.sandboxed, true)

      // mkfile
      const mkfileRes = await fetch(`${baseUrl}/vscode-files/mkfile`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: tempSandbox, name: 'hello.txt' }),
      })
      assert.equal(mkfileRes.status, 200)

      // write
      const targetFile = join(tempSandbox, 'hello.txt')
      const writeRes = await fetch(`${baseUrl}/vscode-files/write`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: targetFile, content: 'Hello Sandbox' }),
      })
      assert.equal(writeRes.status, 200)

      // read (absolute path)
      const readRes = await fetch(`${baseUrl}/vscode-files/read?path=${encodeURIComponent(targetFile)}`)
      assert.equal(readRes.status, 200)
      const readData = await readRes.json()
      assert.equal(readData.ok, true)
      assert.equal(readData.content, 'Hello Sandbox')
      assert.equal(readData.kind, 'text')

      // read (relative non-absolute path resolved against sandbox root)
      const readRelRes = await fetch(`${baseUrl}/vscode-files/read?path=hello.txt`)
      assert.equal(readRelRes.status, 200)
      const readRelData = await readRelRes.json()
      assert.equal(readRelData.ok, true)
      assert.equal(readRelData.content, 'Hello Sandbox')

      // list
      const listRes = await fetch(`${baseUrl}/vscode-files/list?path=${encodeURIComponent(tempSandbox)}`)
      assert.equal(listRes.status, 200)
      const listData = await listRes.json()
      assert.equal(listData.ok, true)
      assert.equal(listData.files.length, 1)
      assert.equal(listData.files[0].name, 'hello.txt')
    }
  } finally {
    server.close()
    await rm(tempSandbox, { recursive: true, force: true })
    await rm(outsideDir, { recursive: true, force: true })
  }
})

test('Cordis plugin exports and registration', () => {
  assert.equal(name, 'dsh-vscode-workspace')
  assert.deepEqual(inject, ['webServer'])

  let registeredRoute: any = null
  const mockCtx: any = {
    inject: (deps: string[], cb: Function) => {},
    effect: (fn: Function) => fn(),
    webServer: {
      register: (route: any) => {
        registeredRoute = route
      },
    },
  }

  apply(mockCtx)
  assert.ok(registeredRoute)
  assert.equal(registeredRoute.kind, 'prefix')
  assert.equal(registeredRoute.path, '/vscode-files')
  assert.equal(typeof registeredRoute.handler, 'function')
})
