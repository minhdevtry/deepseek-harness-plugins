/**
 * Typed client for the `dsh-host-files` HTTP surface (`/vscode-files/*`).
 *
 * React-free by design: this is the explorer's data layer, so it stays
 * callable from tests and from the apply world without a DOM. Every call
 * resolves to a discriminated result instead of throwing — a failed directory
 * listing is an ordinary state the tree renders, not an exception to catch at
 * five call sites.
 *
 * The host answers `{ ok: false, error }` with a non-2xx status for refusals
 * (outside the sandbox, name conflicts, missing paths); both shapes collapse
 * into `ApiFailure` here so callers have one thing to check.
 */

/** Where the host plugin mounts its routes. */
const BASE = '/vscode-files'

/** localStorage key the login flow writes; sent as a Bearer token when present. */
export const TOKEN_KEY = 'dsh_auth_token'

/** A successful call. */
export type ApiSuccess<T> = { ok: true; value: T }
/** A refused or failed call, carrying a message fit to show the operator. */
export type ApiFailure = { ok: false; error: string }
/** Every call resolves to one of these — nothing here throws for expected failures. */
export type ApiResult<T> = ApiSuccess<T> | ApiFailure

/** One directory entry as the host reports it. */
export interface DirEntry {
  name: string
  /** Absolute host path. */
  path: string
  /** Dotfile or a conventionally-collapsed directory (node_modules, .git, …). */
  hidden: boolean
}

/** A file entry: a directory entry plus stat facts. */
export interface FileEntry extends DirEntry {
  size: number
  mtimeMs: number
}

/** One directory listing. */
export interface Listing {
  /** The listed directory (absolute, resolved). */
  path: string
  /** The sandbox boundary — nothing outside it can be listed. */
  sandboxRoot: string
  dirs: DirEntry[]
  files: FileEntry[]
}

/**
 * Porcelain status letters, keyed by repository-relative path.
 * `M` modified, `A` added, `D` deleted, `R` renamed, `??` untracked.
 */
export type GitStatuses = Record<string, string>

/** One changed file reported by git. */
export interface GitFileChange {
  path: string
  status: string
}

/** Git status for a directory, or the "not a repository" verdict. */
export type GitStatus =
  /** `branch` is absent only when the host could not name HEAD. */
  | {
      repo: true
      statuses: GitStatuses
      branch?: string | undefined
      staged?: GitFileChange[] | undefined
      unstaged?: GitFileChange[] | undefined
    }
  | { repo: false }

/** A filename-search hit. */
export interface NameHit {
  name: string
  path: string
  /** Path relative to the search root, forward-slashed. */
  rel: string
  isDir?: boolean | undefined
}

/** One matching line inside a content-search hit. */
export interface ContentMatch {
  line: number
  preview: string
}

/** A content-search hit: one file plus its matching lines. */
export interface ContentHit {
  name: string
  path: string
  rel: string
  matches: ContentMatch[]
}

/** Options for a content search. */
export interface SearchOptions {
  caseSensitive: boolean
  regex: boolean
}

function authHeaders(): Record<string, string> {
  // localStorage throws in privacy modes; an anonymous request is the correct
  // fallback because the host answers unauthenticated reads on open profiles.
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    return token !== null && token.length > 0 ? { authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

/** Narrow an unknown JSON body to the host's failure shape. */
function errorOf(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const message = (body as { error: unknown }).error
    if (typeof message === 'string' && message.length > 0) return message
  }
  return fallback
}

async function request(path: string, init?: RequestInit): Promise<ApiResult<unknown>> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch (cause) {
    // Offline, host restarting, or the plugin was unloaded mid-flight.
    return { ok: false, error: cause instanceof Error ? cause.message : 'network error' }
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, error: `unreadable response (HTTP ${response.status})` }
  }
  if (!response.ok) return { ok: false, error: errorOf(body, `HTTP ${response.status}`) }
  if (typeof body === 'object' && body !== null && (body as { ok?: unknown }).ok === false) {
    return { ok: false, error: errorOf(body, 'request failed') }
  }
  return { ok: true, value: body }
}

async function get(
  route: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<ApiResult<unknown>> {
  const query = new URLSearchParams(params).toString()
  // exactOptionalPropertyTypes forbids handing RequestInit an explicit
  // undefined signal, so an absent one must be an absent key.
  const init: RequestInit = signal === undefined
    ? { headers: authHeaders() }
    : { headers: authHeaders(), signal }
  return request(`${BASE}/${route}?${query}`, init)
}

async function post(route: string, body: unknown): Promise<ApiResult<unknown>> {
  return request(`${BASE}/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
}

let cachedSandboxRoot = '/home/minhdn3'

export function expandUserPath(p: string): string {
  if (!p) return p
  if (p === '~' || p === '~/') {
    return cachedSandboxRoot
  }
  if (p.startsWith('~/')) {
    return `${cachedSandboxRoot.replace(/\/+$/, '')}/${p.slice(2)}`
  }
  if (p.startsWith('~')) {
    return `${cachedSandboxRoot.replace(/\/+$/, '')}/${p.slice(1)}`
  }
  return p
}

/** List one directory. */
export async function listDir(path: string): Promise<ApiResult<Listing>> {
  const resolvedPath = expandUserPath(path)
  const result = await get('list', { path: resolvedPath })
  if (!result.ok) return result
  const body = result.value as Partial<Listing>
  if (body.sandboxRoot) {
    cachedSandboxRoot = body.sandboxRoot
  }
  return {
    ok: true,
    value: {
      path: body.path ?? resolvedPath,
      sandboxRoot: body.sandboxRoot ?? resolvedPath,
      dirs: body.dirs ?? [],
      files: body.files ?? [],
    },
  }
}

/**
 * How the host classified a file it was asked to read.
 *
 * `too-large` still carries content — the leading slice the host was willing
 * to send — but the workbench must open it read-only: saving a truncated
 * buffer back would silently destroy the tail of the file.
 */
export type FileKind = 'text' | 'binary' | 'too-large'

/** A file the host read for us. */
export interface FileContent {
  kind: FileKind
  /** Empty for `binary`; truncated for `too-large`. */
  content: string
  /** Size on disk in bytes, which for `too-large` exceeds `content.length`. */
  size: number
}

/** Read one file. */
export async function readFile(path: string): Promise<ApiResult<FileContent>> {
  const result = await get('read', { path })
  if (!result.ok) return result
  const body = result.value as Partial<FileContent>
  return {
    ok: true,
    value: {
      kind: body.kind ?? 'text',
      content: body.content ?? '',
      size: body.size ?? 0,
    },
  }
}

/**
 * Write one file, replacing its contents.
 * @returns the byte length the host stored.
 */
export async function writeFile(path: string, content: string): Promise<ApiResult<number>> {
  const result = await post('write', { path, content })
  if (!result.ok) return result
  return { ok: true, value: (result.value as { size?: number }).size ?? 0 }
}

/**
 * The workspace root the host is serving.
 *
 * An empty `path` is how the host is asked for its default: it falls back to
 * the sandbox root, and the reply names that boundary. The explorer needs it
 * both as its starting directory and as the target of "reset to workspace".
 */
export async function workspaceRoot(): Promise<ApiResult<string>> {
  const result = await listDir('')
  if (!result.ok) return result
  return { ok: true, value: result.value.sandboxRoot }
}

/**
 * Read git status for a directory. A non-repository is a normal answer, not a
 * failure: the tree simply renders without badges.
 */
export async function gitStatus(path: string): Promise<ApiResult<GitStatus>> {
  const result = await get('git', { path })
  if (!result.ok) return { ok: true, value: { repo: false } }
  const body = result.value as {
    statuses?: GitStatuses
    branch?: string
    staged?: GitFileChange[]
    unstaged?: GitFileChange[]
  }
  return {
    ok: true,
    value: {
      repo: true,
      statuses: body.statuses ?? {},
      branch: body.branch,
      staged: body.staged ?? [],
      unstaged: body.unstaged ?? [],
    },
  }
}

/** Stage a file (git add). */
export async function gitStage(root: string, file: string): Promise<ApiResult<void>> {
  const result = await post('git/stage', { root, file })
  if (!result.ok) return result
  return { ok: true, value: undefined }
}

/** Unstage a file (git restore --staged). */
export async function gitUnstage(root: string, file: string): Promise<ApiResult<void>> {
  const result = await post('git/unstage', { root, file })
  if (!result.ok) return result
  return { ok: true, value: undefined }
}

/** Discard worktree changes (git restore / clean). */
export async function gitDiscard(root: string, file: string): Promise<ApiResult<void>> {
  const result = await post('git/discard', { root, file })
  if (!result.ok) return result
  return { ok: true, value: undefined }
}

/** Commit staged changes (git commit -m). */
export async function gitCommit(root: string, message: string): Promise<ApiResult<void>> {
  const result = await post('git/commit', { root, message })
  if (!result.ok) return result
  return { ok: true, value: undefined }
}

/** Search file *names* under a root. */
export async function searchNames(
  root: string,
  query: string,
  signal?: AbortSignal,
): Promise<ApiResult<NameHit[]>> {
  const resolvedRoot = expandUserPath(root)
  const result = await get('search', { path: resolvedRoot, q: query, type: 'filename' }, signal)
  if (!result.ok) return result
  return { ok: true, value: (result.value as { results?: NameHit[] }).results ?? [] }
}

/**
 * Search file *contents* under a root.
 *
 * Takes a signal because this walks the whole tree on the host: a superseded
 * query must actually stop the work, not merely have its answer discarded.
 */
export async function searchContent(
  root: string,
  query: string,
  options: SearchOptions,
  signal?: AbortSignal,
): Promise<ApiResult<ContentHit[]>> {
  const result = await get('search', {
    path: root,
    q: query,
    type: 'content',
    caseSensitive: String(options.caseSensitive),
    isRegex: String(options.regex),
  }, signal)
  if (!result.ok) return result
  return { ok: true, value: (result.value as { results?: ContentHit[] }).results ?? [] }
}

/** Create an empty file inside `parent`. Fails when the name is taken. */
export async function createFile(parent: string, name: string): Promise<ApiResult<string>> {
  const result = await post('mkfile', { path: parent, name })
  if (!result.ok) return result
  return { ok: true, value: (result.value as { path: string }).path }
}

/** Create a directory inside `parent`. Fails when the name is taken. */
export async function createFolder(parent: string, name: string): Promise<ApiResult<string>> {
  const result = await post('mkdir', { path: parent, name })
  if (!result.ok) return result
  return { ok: true, value: (result.value as { path: string }).path }
}

/** Rename in place; `newName` is a single path segment, not a path. */
export async function renameEntry(path: string, newName: string): Promise<ApiResult<string>> {
  const result = await post('rename', { path, newName })
  if (!result.ok) return result
  return { ok: true, value: (result.value as { path: string }).path }
}

/** Move a file or directory to the OS trash (recoverable — never an unlink). */
export async function trashEntry(path: string): Promise<ApiResult<void>> {
  const result = await post('delete', { path })
  if (!result.ok) return result
  return { ok: true, value: undefined }
}
