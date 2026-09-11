/**
 * Type definitions for DSH Host Subsystem (@anoslide/dsh-vscode-workspace).
 */

export type ApiSuccess<T> = { ok: true } & T
export type ApiFailure = { ok: false; error: string }
export type ApiResult<T> = ApiSuccess<T> | ApiFailure

export interface DirEntry {
  name: string
  path: string
  hidden: boolean
}

export interface FileEntry extends DirEntry {
  size: number
  mtimeMs: number
}

export interface Listing {
  path: string
  sandboxRoot: string
  dirs: DirEntry[]
  files: FileEntry[]
}

export type GitStatuses = Record<string, string>

export interface GitFileChange {
  path: string
  status: string
}

export interface GitBranchInfo {
  branch: string
  upstream?: string
  ahead: number
  behind: number
}

export interface GitStatusResult extends GitBranchInfo {
  statuses: GitStatuses
  staged: GitFileChange[]
  unstaged: GitFileChange[]
}

export interface GitCommit {
  hash: string
  parents: string[]
  author: string
  date: string
  refs: string[]
  subject: string
}

export interface GitLogResult {
  commits: GitCommit[]
}

export type FileKind = 'text' | 'binary' | 'too-large'

export interface FileReadResult {
  kind: FileKind
  content: string
  size: number
  binary: boolean
}

export interface SearchNameHit {
  name: string
  path: string
  rel: string
  isDir?: boolean
}

export interface SearchContentHit {
  name: string
  path: string
  rel: string
  line: number
  preview: string
}

export interface R2Config {
  accountId?: string
  accessKeyId?: string
  secretAccessKey?: string
  bucket?: string
  publicDomain?: string
  pathPrefix?: string
}

export interface RenameResult {
  path: string
  healedFiles: string[]
}

export interface SandboxInfo {
  sandboxed: boolean
  sandboxRoot: string
  projectName: string
}

export interface SandboxFolder {
  name: string
  path: string
  rel: string
}

export interface AuthUser {
  name: string
  color: string
  avatar: string
}

export interface AuthStatus {
  requiresAuth: boolean
  authenticated: boolean
  user: AuthUser | null
}
