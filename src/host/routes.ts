/**
 * HTTP Route Handlers for @anoslide/dsh-vscode-workspace (/vscode-files/*).
 *
 * Implements all workspace HTTP endpoints: file operations, git porcelain,
 * search, upload, auth, persona, and raw asset streaming.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import type { Context } from '@deepseek-ai/cordis'
import type { AuthUser, R2Config } from './types.ts'
import {
  createDirectory,
  createFile,
  deleteItem,
  getRawFile,
  getSandboxFolders,
  isInsideSandbox,
  listDirectory,
  readFileContent,
  renameItem,
  saveLocalImage,
  searchDirectory,
  searchFileContent,
  writeFileContent,
} from './fileService.ts'
import {
  getGitLog,
  getGitStatus,
  gitCommit,
  gitDiscard,
  gitFetch,
  gitPull,
  gitPush,
  gitStage,
  gitUnstage,
} from './gitService.ts'
import { uploadImageToR2 } from './r2Service.ts'
import { readPersona, readPersonaSync, registerPersonaPrompt, writePersona } from './personaService.ts'

export function getSandboxRoot(): string {
  return resolve(process.env.DSH_SANDBOX_ROOT || process.cwd())
}

const activeSessions = new Map<string, { user: AuthUser; createdAt: number }>()

export function sendJson(res: ServerResponse, code: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  })
  res.end(body)
}

export function readJsonBody<T = any>(req: IncomingMessage, cap = 12 * 1024 * 1024): Promise<T> {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > cap) {
        rejectPromise(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolvePromise(text.length > 0 ? (JSON.parse(text) as T) : ({} as T))
      } catch {
        rejectPromise(new Error('invalid JSON body'))
      }
    })
    req.on('error', rejectPromise)
  })
}

function validSegment(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0 && s.length <= 120 && !/[\\/]/.test(s) && s !== '.' && s !== '..'
}

function verifyAuth(req: IncomingMessage, url: URL, password = process.env.DSH_PASSWORD || '') {
  if (!password) {
    return {
      authenticated: true,
      requiresAuth: false,
      user: { name: 'Lucas', color: '#3b82f6', avatar: '👨‍💻' },
    }
  }

  const authHeader = req.headers['authorization']
  let token: string | null = null
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim()
  } else if (url.searchParams.has('token')) {
    token = url.searchParams.get('token')
  } else if (req.headers['cookie']) {
    const match = req.headers['cookie'].match(/(?:^|;\s*)dsh_token=([^;]+)/)
    if (match?.[1]) token = match[1]
  }

  if (token && activeSessions.has(token)) {
    const session = activeSessions.get(token)!
    return { authenticated: true, requiresAuth: true, token, user: session.user }
  }

  return { authenticated: false, requiresAuth: true }
}

let shikiPromise: Promise<any> | null = null
function resolveShikiEntry(): string {
  try {
    return createRequire(import.meta.url).resolve('shiki')
  } catch {}
  const globalRoot = process.env.APPDATA ? join(process.env.APPDATA, 'npm', 'node_modules') : null
  if (globalRoot) {
    const dshBin = join(globalRoot, '@deepseek-ai', 'dsh', 'lib', 'bin.js')
    if (existsSync(dshBin)) {
      try {
        return createRequire(dshBin).resolve('shiki')
      } catch {}
    }
  }
  throw new Error('Unable to locate shiki')
}

function loadShiki(): Promise<any> {
  if (shikiPromise === null) {
    shikiPromise = (async () => {
      const entry = resolveShikiEntry()
      return import(pathToFileURL(entry).href)
    })()
  }
  return shikiPromise
}

const LANG_BY_EXT: Record<string, string> = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx', mjs: 'javascript', cjs: 'javascript',
  html: 'html', htm: 'html', xml: 'xml', svg: 'xml', vue: 'vue',
  css: 'css', scss: 'scss', less: 'less', json: 'json', jsonc: 'jsonc',
  yml: 'yaml', yaml: 'yaml', md: 'markdown', py: 'python',
  sh: 'shellscript', bash: 'shellscript', zsh: 'shellscript', go: 'go', rs: 'rust',
  java: 'java', c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', sql: 'sql', toml: 'toml', ini: 'ini',
}

export interface RouteHandlerOptions {
  sandboxRoot?: string
  password?: string
}

/**
 * Creates the HTTP request handler for /vscode-files/* routes.
 */
export function createHostRequestHandler(options: RouteHandlerOptions = {}) {
  return async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const defaultRoot = options.sandboxRoot ? resolve(options.sandboxRoot) : getSandboxRoot()
    const password = options.password ?? (process.env.DSH_PASSWORD || '')
    const url = new URL(req.url ?? '/', 'http://localhost')

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'authorization, content-type',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
      })
      res.end()
      return
    }

    // ── Public / Auth Endpoints ──
    if (url.pathname === '/vscode-files/auth/status') {
      const auth = verifyAuth(req, url, password)
      sendJson(res, 200, {
        ok: true,
        requiresAuth: auth.requiresAuth,
        authenticated: auth.authenticated,
        user: auth.user || null,
      })
      return
    }

    if (url.pathname === '/vscode-files/auth/login' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req, 4096)
        const inputPassword = body?.password || ''
        if (password && inputPassword !== password) {
          sendJson(res, 401, { ok: false, error: 'Invalid workspace password. Please try again.' })
          return
        }
        const token = crypto.randomBytes(24).toString('hex')
        const user: AuthUser = {
          name: body?.name || (body?.preset === 'lona' ? 'Lona' : 'Lucas'),
          color: body?.color || (body?.preset === 'lona' ? '#ec4899' : '#3b82f6'),
          avatar: body?.avatar || (body?.preset === 'lona' ? '💖' : '👨‍💻'),
        }
        activeSessions.set(token, { user, createdAt: Date.now() })
        res.setHeader('Set-Cookie', `dsh_token=${token}; Path=/; SameSite=Lax; Max-Age=2592000`)
        sendJson(res, 200, { ok: true, token, user })
        return
      } catch (err: any) {
        sendJson(res, 400, { ok: false, error: err.message })
        return
      }
    }

    if (url.pathname === '/vscode-files/auth/logout' && req.method === 'POST') {
      const authHeader = req.headers['authorization']
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
      if (token) activeSessions.delete(token)
      res.setHeader('Set-Cookie', 'dsh_token=; Path=/; Max-Age=0')
      sendJson(res, 200, { ok: true })
      return
    }

    if (url.pathname === '/vscode-files/sandbox-info') {
      const queryRoot = url.searchParams.get('root') || url.searchParams.get('path')
      const activeRoot = queryRoot ? resolve(queryRoot) : defaultRoot
      sendJson(res, 200, {
        ok: true,
        sandboxed: true,
        sandboxRoot: activeRoot,
        projectName: basename(activeRoot),
      })
      return
    }

    if (url.pathname === '/vscode-files/collab-info') {
      const hostName = (req.headers.host || 'localhost:3080').split(':')[0]
      sendJson(res, 200, {
        ok: true,
        wsPort: 3088,
        wsUrl: `ws://${hostName}:3088`,
      })
      return
    }

    // ── Auth Protection Middleware ──
    const auth = verifyAuth(req, url, password)
    if (auth.requiresAuth && !auth.authenticated) {
      sendJson(res, 401, {
        ok: false,
        error: 'Unauthorized: Password authentication required to access this workspace.',
      })
      return
    }

    // ── Sandbox Subdirectory Explorer ──
    if (url.pathname === '/vscode-files/sandbox-folders') {
      try {
        const folders = await getSandboxFolders(defaultRoot)
        sendJson(res, 200, { ok: true, sandboxRoot: defaultRoot, folders })
      } catch (err: any) {
        sendJson(res, 500, { ok: false, error: err.message })
      }
      return
    }

    // ── Global Persona ──
    if (url.pathname === '/vscode-files/persona') {
      if (req.method === 'POST') {
        try {
          const body = await readJsonBody(req, 128 * 1024 + 4096)
          await writePersona(body?.content)
          sendJson(res, 200, { ok: true })
        } catch (error: any) {
          sendJson(res, 400, { ok: false, error: error.message })
        }
        return
      }
      const content = await readPersona()
      sendJson(res, 200, { ok: true, content })
      return
    }

    // ── Protected POST Operations ──
    if (req.method === 'POST') {
      let body: any
      try {
        body = await readJsonBody(req, 12 * 1024 * 1024)
      } catch (error: any) {
        sendJson(res, 400, { ok: false, error: error.message })
        return
      }

      if (url.pathname === '/vscode-files/write') {
        const writePath = body?.path || url.searchParams.get('path')
        const content = typeof body?.content === 'string' ? body.content : (typeof body === 'string' ? body : '')
        if (typeof writePath !== 'string' || writePath.length === 0) {
          sendJson(res, 400, { ok: false, error: 'body needs { path: string, content: string } or ?path= query' })
          return
        }
        if (!isInsideSandbox(writePath, defaultRoot)) {
          sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
          return
        }
        try {
          const size = await writeFileContent(writePath, content, defaultRoot)
          sendJson(res, 200, { ok: true, size })
        } catch (err: any) {
          sendJson(res, 400, { ok: false, error: err.message })
        }
        return
      }

      if (url.pathname === '/vscode-files/mkdir') {
        const parent = body?.path
        if (typeof parent !== 'string' || !validSegment(body?.name)) {
          sendJson(res, 400, { ok: false, error: 'body needs { path: string, name: string }' })
          return
        }
        if (!isInsideSandbox(parent, defaultRoot)) {
          sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
          return
        }
        const full = join(parent, body.name)
        if (!isInsideSandbox(full, defaultRoot)) {
          sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
          return
        }
        try {
          await createDirectory(full, defaultRoot)
          sendJson(res, 200, { ok: true, path: full })
        } catch (error: any) {
          sendJson(res, 409, { ok: false, error: `Already exists or cannot create directory: ${error?.code ?? 'unknown'}` })
        }
        return
      }

      if (url.pathname === '/vscode-files/mkfile') {
        const parent = body?.path
        if (typeof parent !== 'string' || !validSegment(body?.name)) {
          sendJson(res, 400, { ok: false, error: 'body needs { path: string, name: string }' })
          return
        }
        if (!isInsideSandbox(parent, defaultRoot)) {
          sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
          return
        }
        const full = join(parent, body.name)
        if (!isInsideSandbox(full, defaultRoot)) {
          sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
          return
        }
        try {
          await createFile(full, defaultRoot)
          sendJson(res, 200, { ok: true, path: full })
        } catch (error: any) {
          sendJson(res, 409, { ok: false, error: `Already exists or cannot create file: ${error?.code ?? 'unknown'}` })
        }
        return
      }

      if (url.pathname === '/vscode-files/rename') {
        const oldPath = body?.path
        if (typeof oldPath !== 'string' || !validSegment(body?.newName)) {
          sendJson(res, 400, { ok: false, error: 'body needs { path: string, newName: string }' })
          return
        }
        if (!isInsideSandbox(oldPath, defaultRoot)) {
          sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
          return
        }
        const newPath = join(dirname(oldPath), body.newName)
        if (!isInsideSandbox(newPath, defaultRoot)) {
          sendJson(res, 403, { ok: false, error: 'Access Denied: Target path is outside the sandboxed workspace directory' })
          return
        }
        try {
          const result = await renameItem(oldPath, newPath, defaultRoot)
          sendJson(res, 200, { ok: true, path: result.path, healedFiles: result.healedFiles })
        } catch (error: any) {
          sendJson(res, 500, { ok: false, error: error.message })
        }
        return
      }

      if (url.pathname === '/vscode-files/delete') {
        const delPath = body?.path
        if (typeof delPath !== 'string' || delPath.length === 0) {
          sendJson(res, 400, { ok: false, error: 'body needs { path: string }' })
          return
        }
        if (!isInsideSandbox(delPath, defaultRoot)) {
          sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
          return
        }
        if (resolve(delPath) === '/' || resolve(delPath) === 'C:\\') {
          sendJson(res, 403, { ok: false, error: 'Access Denied: Cannot delete root filesystem directory' })
          return
        }
        try {
          await deleteItem(delPath, defaultRoot)
          sendJson(res, 200, { ok: true })
        } catch (error: any) {
          const code = error.code === 'ENOENT' ? 404 : 500
          sendJson(res, code, { ok: false, error: error.message })
        }
        return
      }

      if (url.pathname === '/vscode-files/git/stage') {
        const root = body?.root || defaultRoot
        const file = body?.file
        if (!file || typeof file !== 'string') return sendJson(res, 400, { ok: false, error: 'missing file' })
        if (!isInsideSandbox(root, defaultRoot)) {
          return sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
        }
        const resolvedFile = isAbsolute(file) ? resolve(file) : resolve(root, file)
        if (!isInsideSandbox(resolvedFile, root)) {
          return sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
        }
        try {
          await gitStage(root, file)
          return sendJson(res, 200, { ok: true })
        } catch (err: any) {
          return sendJson(res, 500, { ok: false, error: err.message })
        }
      }

      if (url.pathname === '/vscode-files/git/unstage') {
        const root = body?.root || defaultRoot
        const file = body?.file
        if (!file || typeof file !== 'string') return sendJson(res, 400, { ok: false, error: 'missing file' })
        if (!isInsideSandbox(root, defaultRoot)) {
          return sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
        }
        const resolvedFile = isAbsolute(file) ? resolve(file) : resolve(root, file)
        if (!isInsideSandbox(resolvedFile, root)) {
          return sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
        }
        try {
          await gitUnstage(root, file)
          return sendJson(res, 200, { ok: true })
        } catch (err: any) {
          return sendJson(res, 500, { ok: false, error: err.message })
        }
      }

      if (url.pathname === '/vscode-files/git/discard') {
        const root = body?.root || defaultRoot
        const file = body?.file
        if (!file || typeof file !== 'string') return sendJson(res, 400, { ok: false, error: 'missing file' })
        if (!isInsideSandbox(root, defaultRoot)) {
          return sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
        }
        const resolvedFile = isAbsolute(file) ? resolve(file) : resolve(root, file)
        if (!isInsideSandbox(resolvedFile, root)) {
          return sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
        }
        try {
          await gitDiscard(root, file)
          return sendJson(res, 200, { ok: true })
        } catch (err: any) {
          return sendJson(res, 500, { ok: false, error: err.message })
        }
      }

      if (url.pathname === '/vscode-files/git/commit') {
        const root = body?.root || defaultRoot
        const message = body?.message
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
          return sendJson(res, 400, { ok: false, error: 'missing message' })
        }
        if (!isInsideSandbox(root, defaultRoot)) {
          return sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
        }
        try {
          await gitCommit(root, message)
          return sendJson(res, 200, { ok: true })
        } catch (err: any) {
          return sendJson(res, 500, { ok: false, error: err.message })
        }
      }

      if (url.pathname === '/vscode-files/git/push') {
        const root = body?.root || defaultRoot
        if (!isInsideSandbox(root, defaultRoot)) {
          return sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
        }
        try {
          await gitPush(root)
          return sendJson(res, 200, { ok: true })
        } catch (err: any) {
          return sendJson(res, 500, { ok: false, error: err.message })
        }
      }

      if (url.pathname === '/vscode-files/git/pull') {
        const root = body?.root || defaultRoot
        if (!isInsideSandbox(root, defaultRoot)) {
          return sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
        }
        try {
          await gitPull(root)
          return sendJson(res, 200, { ok: true })
        } catch (err: any) {
          return sendJson(res, 500, { ok: false, error: err.message })
        }
      }

      if (url.pathname === '/vscode-files/git/fetch') {
        const root = body?.root || defaultRoot
        if (!isInsideSandbox(root, defaultRoot)) {
          return sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
        }
        try {
          await gitFetch(root)
          return sendJson(res, 200, { ok: true })
        } catch (err: any) {
          return sendJson(res, 500, { ok: false, error: err.message })
        }
      }

      if (url.pathname === '/vscode-files/upload-image') {
        const root = body?.root ? resolve(body.root) : defaultRoot
        if (!isInsideSandbox(root, defaultRoot)) {
          return sendJson(res, 403, { ok: false, error: 'Access Denied: Path is outside the sandboxed workspace directory' })
        }
        const storage = body?.storage || 'local'
        const base64Data = body?.data
        const mimeType = body?.mimeType || 'image/png'
        const altText = body?.altText || 'image'

        if (!base64Data) {
          return sendJson(res, 400, { ok: false, error: 'missing image data' })
        }

        const raw = typeof base64Data === 'string' ? base64Data.replace(/^data:image\/\w+;base64,/, '') : ''
        const buffer = Buffer.from(raw, 'base64')

        if (storage === 'r2') {
          try {
            const r2Config: R2Config = body?.r2Config || {}
            const publicUrl = await uploadImageToR2(r2Config, buffer, mimeType, altText)
            return sendJson(res, 200, { ok: true, url: publicUrl })
          } catch (err: any) {
            return sendJson(res, 500, { ok: false, error: err.message })
          }
        } else {
          try {
            const { absPath, relPath } = await saveLocalImage(root, buffer, mimeType)
            return sendJson(res, 200, {
              ok: true,
              url: `/vscode-files/raw?path=${encodeURIComponent(absPath)}`,
              relPath,
            })
          } catch (err: any) {
            return sendJson(res, 500, { ok: false, error: err.message })
          }
        }
      }
    }

    // ── Protected GET Operations ──
    let rawTarget = url.searchParams.get('path')
    if (!rawTarget || rawTarget === '.' || rawTarget === './') {
      rawTarget = defaultRoot
    } else if (rawTarget === '~') {
      rawTarget = homedir()
    } else if (rawTarget.startsWith('~/')) {
      rawTarget = join(homedir(), rawTarget.slice(2))
    }
    const target = isAbsolute(rawTarget) ? resolve(rawTarget) : resolve(defaultRoot, rawTarget)

    if (!isInsideSandbox(target, defaultRoot)) {
      sendJson(res, 403, {
        ok: false,
        error: `Access Denied: Path is outside the sandboxed workspace directory (${defaultRoot})`,
      })
      return
    }

    try {
      if (url.pathname === '/vscode-files/list') {
        const listing = await listDirectory(target, defaultRoot)
        sendJson(res, 200, {
          ok: true,
          path: listing.path,
          root: listing.path,
          sandboxRoot: listing.sandboxRoot,
          dirs: listing.dirs,
          files: listing.files,
        })
        return
      }

      if (url.pathname === '/vscode-files/read') {
        const readRes = await readFileContent(target, defaultRoot)
        sendJson(res, 200, {
          ok: true,
          kind: readRes.kind,
          content: readRes.content,
          size: readRes.size,
        })
        return
      }

      if (url.pathname === '/vscode-files/raw') {
        const rawFile = await getRawFile(target, defaultRoot)
        res.writeHead(200, {
          'content-type': rawFile.mimeType,
          'content-length': rawFile.size,
          'cache-control': 'no-cache',
          'access-control-allow-origin': '*',
        })
        res.end(rawFile.buffer)
        return
      }

      if (url.pathname === '/vscode-files/git') {
        try {
          const status = await getGitStatus(target)
          sendJson(res, 200, { ok: true, repo: true, ...status })
        } catch {
          sendJson(res, 200, { ok: false, notRepo: true, error: 'not a git repository' })
        }
        return
      }

      if (url.pathname === '/vscode-files/git/log') {
        const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1), 200)
        const logRes = await getGitLog(target, limit)
        sendJson(res, 200, { ok: true, commits: logRes.commits })
        return
      }

      if (url.pathname === '/vscode-files/search') {
        const q = url.searchParams.get('q') ?? ''
        const type = url.searchParams.get('type') || 'filename'
        const caseSensitive = url.searchParams.get('caseSensitive') === 'true'
        const isRegex = url.searchParams.get('isRegex') === 'true'

        if (type === 'content') {
          if (typeof q !== 'string' || q.trim().length === 0) {
            sendJson(res, 400, { ok: false, error: 'missing q' })
            return
          }
          const results = await searchFileContent(target, q.trim(), caseSensitive, isRegex)
          sendJson(res, 200, { ok: true, results })
          return
        }

        const results = await searchDirectory(target, typeof q === 'string' ? q.trim() : '')
        sendJson(res, 200, { ok: true, results })
        return
      }

      if (url.pathname === '/vscode-files/highlight') {
        const readRes = await readFileContent(target, defaultRoot)
        if (readRes.kind === 'too-large') {
          sendJson(res, 200, { ok: false, error: 'too large to highlight' })
          return
        }
        if (readRes.binary) {
          sendJson(res, 200, { ok: false, error: 'binary' })
          return
        }
        try {
          const shiki = await loadShiki()
          const theme = url.searchParams.get('theme') === 'light' ? 'github-light' : 'github-dark'
          const lang = LANG_BY_EXT[extname(target).slice(1).toLowerCase()] ?? 'text'
          const html = await shiki.codeToHtml(readRes.content, { lang, theme })
          sendJson(res, 200, { ok: true, html })
        } catch (error: any) {
          sendJson(res, 200, { ok: false, error: error?.message ?? String(error) })
        }
        return
      }

      sendJson(res, 404, { ok: false, error: 'unknown vscode-files endpoint' })
    } catch (error: any) {
      const isNotFound = error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
      const statusCode = isNotFound ? 404 : 500
      sendJson(res, statusCode, { ok: false, error: error?.message ?? String(error) })
    }
  }
}

/**
 * Mounts the /vscode-files/* routes on Cordis webServer service.
 */
export function registerHostRoutes(ctx: Context): void {
  // Register global persona injection into systemPrompt
  registerPersonaPrompt(ctx)

  const handler = createHostRequestHandler()

  // Register HTTP route handler on ctx.webServer
  ;(ctx as any).effect?.(() => {
    return (ctx as any).webServer?.register({
      kind: 'prefix',
      path: '/vscode-files',
      handler,
    }, 'dsh-vscode-workspace: /vscode-files routes')
  })
}
