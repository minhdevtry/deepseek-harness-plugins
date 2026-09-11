/**
 * Git Operations Service for @anoslide/dsh-vscode-workspace.
 *
 * Provides typed operations for Git porcelain status, commit log, staging,
 * discarding, committing, pushing, pulling, and fetching.
 */
import { execFile } from 'node:child_process'
import type { GitCommit, GitFileChange, GitLogResult, GitStatusResult, GitStatuses } from './types.ts'

const GIT_LOG_FIELD_SEP = '\x1f'
const GIT_LOG_RECORD_SEP = '\x1e'

/**
 * Execute a git command inside a repo root directory.
 */
export function gitExec(root: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-C', root, ...args],
      {
        timeout: 15000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) reject(new Error(stderr?.trim() || error.message))
        else resolve(stdout)
      },
    )
  })
}

/**
 * Parses git status --porcelain output and returns structured GitStatusResult.
 */
export function getGitStatus(root: string): Promise<GitStatusResult> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-C', root, 'status', '--porcelain=v1', '--branch', '--untracked-files=normal'],
      {
        timeout: 8000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          reject(new Error('not a git repository'))
          return
        }

        const statuses: GitStatuses = {}
        const staged: GitFileChange[] = []
        const unstaged: GitFileChange[] = []
        let branch = 'main'
        let upstream: string | undefined
        let ahead = 0
        let behind = 0

        for (const line of stdout.split(/\r?\n/)) {
          // --branch prepends one "## <name>...<upstream> [ahead N, behind M]" header line.
          if (line.startsWith('## ')) {
            const headerBody = line.slice(3)
            const bracket = headerBody.match(/ \[(.+)\]$/)
            const base = bracket ? headerBody.slice(0, bracket.index).trim() : headerBody.trim()

            if (bracket) {
              const aheadMatch = bracket[1]?.match(/ahead (\d+)/)
              const behindMatch = bracket[1]?.match(/behind (\d+)/)
              if (aheadMatch?.[1]) ahead = Number.parseInt(aheadMatch[1], 10)
              if (behindMatch?.[1]) behind = Number.parseInt(behindMatch[1], 10)
            }

            const [headPart, upstreamPart] = base.split('...')
            let head = headPart?.trim() ?? 'main'
            const freshMatch = head.match(/^No commits yet on (.+)$/)
            if (freshMatch?.[1]) head = freshMatch[1]
            branch = head.startsWith('HEAD ') ? 'HEAD' : head
            if (upstreamPart) upstream = upstreamPart.trim()
            continue
          }

          if (line.length < 4) continue
          const x = line[0] ?? ' '
          const y = line[1] ?? ' '
          const code = line.slice(0, 2).trim()
          let path = line.slice(3).trim()

          if (code === 'R' || x === 'R' || y === 'R') {
            const arrow = path.indexOf(' -> ')
            if (arrow !== -1) path = path.slice(arrow + 4).trim()
          }

          if (path.length === 0) continue
          if (!(path in statuses)) statuses[path] = code === 'R' ? 'R' : code

          if (x !== ' ' && x !== '?') {
            staged.push({ path, status: x })
          }
          if (y !== ' ' || x === '?') {
            unstaged.push({ path, status: x === '?' ? 'U' : y })
          }
        }

        resolve({
          statuses,
          branch,
          ...(upstream !== undefined ? { upstream } : {}),
          ahead,
          behind,
          staged,
          unstaged,
        })
      },
    )
  })
}

/**
 * Stages a single file (git add).
 */
export async function gitStage(root: string, file: string): Promise<void> {
  await gitExec(root, ['add', file])
}

/**
 * Unstages a single file (git restore --staged).
 */
export async function gitUnstage(root: string, file: string): Promise<void> {
  await gitExec(root, ['restore', '--staged', file])
}

/**
 * Discards worktree changes for a file (git restore or git clean).
 */
export async function gitDiscard(root: string, file: string): Promise<void> {
  try {
    await gitExec(root, ['restore', file])
  } catch {
    await gitExec(root, ['clean', '-fd', file])
  }
}

/**
 * Creates a git commit with message.
 */
export async function gitCommit(root: string, message: string): Promise<void> {
  const trimmed = message.trim()
  if (trimmed.length === 0) {
    throw new Error('missing message')
  }
  await gitExec(root, ['commit', '-m', trimmed])
}

/**
 * Pushes commits, automatically setting upstream if needed.
 */
export async function gitPush(root: string): Promise<void> {
  let hasUpstream = true
  try {
    await gitExec(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
  } catch {
    hasUpstream = false
  }

  if (hasUpstream) {
    await gitExec(root, ['push'])
  } else {
    const branch = (await gitExec(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
    await gitExec(root, ['push', '--set-upstream', 'origin', branch])
  }
}

/**
 * Pulls changes from current branch's upstream.
 */
export async function gitPull(root: string): Promise<void> {
  await gitExec(root, ['pull'])
}

/**
 * Fetches latest refs from remote.
 */
export async function gitFetch(root: string): Promise<void> {
  await gitExec(root, ['fetch'])
}

function parseGitLog(stdout: string): GitCommit[] {
  return stdout
    .split(GIT_LOG_RECORD_SEP)
    .map((s) => s.replace(/^\r?\n/, '').trim())
    .filter(Boolean)
    .map((record) => {
      const parts = record.split(GIT_LOG_FIELD_SEP)
      const hash = parts[0] ?? ''
      const parents = parts[1] ? parts[1].split(' ').filter(Boolean) : []
      const author = parts[2] ?? ''
      const date = parts[3] ?? ''
      const refs = parts[4] ? parts[4].split(',').map((r) => r.trim()).filter(Boolean) : []
      const subject = parts[5] ?? ''

      return {
        hash,
        parents,
        author,
        date,
        refs,
        subject,
      }
    })
}

/**
 * Returns commits newest-first for the Git Graph view.
 */
export function getGitLog(root: string, limit = 50): Promise<GitLogResult> {
  const format = ['%H', '%P', '%an', '%ad', '%D', '%s'].join(GIT_LOG_FIELD_SEP) + GIT_LOG_RECORD_SEP
  return new Promise((resolve) => {
    execFile(
      'git',
      ['-C', root, 'log', `--max-count=${limit}`, '--date=relative', `--pretty=format:${format}`],
      {
        timeout: 8000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          resolve({ commits: [] })
          return
        }
        resolve({ commits: parseGitLog(stdout) })
      },
    )
  })
}
