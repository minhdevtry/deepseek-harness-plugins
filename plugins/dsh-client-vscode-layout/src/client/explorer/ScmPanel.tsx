/**
 * Git source control workspace panel.
 *
 * Segregates working tree modifications into Staged and Unstaged change-lists
 * for granular commit building, and gates file discard behind an explicit
 * confirmation dialog because uncommitted working-tree deletions cannot be undone.
 *
 * Mirrors Antigravity/VS Code's layout: the current branch is shown once, in
 * the editor's bottom status bar (see StatusBar.tsx) — not repeated here. An
 * outer "Changes" header carries the repository-level toolbar (commit,
 * refresh, more actions) and collapses the commit box and change lists as a
 * unit; the "Staged Changes" group only appears once something is staged.
 * Below that sits an independent Graph section (recent `git log`, newest on
 * top) with a branch pill on whichever commit HEAD currently points at.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  gitCommit,
  gitDiscard,
  gitFetch,
  gitLog,
  gitPull,
  gitPush,
  gitStage,
  gitStatus,
  gitUnstage,
  type GitCommit,
  type GitFileChange,
  type GitStatus,
} from '../api/files.ts'
import { basename } from '../utils/path.ts'
import { Button, IconButton, Tooltip, Spinner } from '../ui/primitives/index.ts'
import css from './ScmPanel.module.css'

export interface ScmPanelProps {
  root: string | undefined
  onOpenFile: (path: string) => void
  onNotify?: ((message: string) => void) | undefined
}

const AUTO_REFRESH_MS = 15000
const GRAPH_LIMIT = 50

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9L14 6m0-4v4h-4" />
    </svg>
  )
}

function CloudUploadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M4.5 12.5a3 3 0 0 1-.5-5.95 4 4 0 0 1 7.74-1.44A3.5 3.5 0 0 1 11.5 12.5h-7Z" />
      <path d="M8 6.2v4.6M6.1 8.3 8 6.2l1.9 2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SyncIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3 8a5 5 0 0 1 8.5-3.5M13 4v3h-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 8a5 5 0 0 1-8.5 3.5M3 12V9h3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
      <path d="M7 2.2 8.1 5.4 11.3 6.5 8.1 7.6 7 10.8 5.9 7.6 2.7 6.5 5.9 5.4z" />
      <path d="M12.3 8.8l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z" />
    </svg>
  )
}

function Chevron({ expanded }: { expanded: boolean }) {
  return <span className={css.chevron} data-expanded={expanded || undefined}>▾</span>
}

/** Local ref names worth badging on a commit; remote-tracking refs and tags are noise here. */
function localRefNames(refs: string[]): string[] {
  const names: string[] = []
  for (const ref of refs) {
    let name = ref
    if (name.startsWith('HEAD -> ')) name = name.slice(8)
    else if (name === 'HEAD' || name.startsWith('tag: ') || name.includes('/')) continue
    if (!names.includes(name)) names.push(name)
  }
  return names
}

/**
 * The last one or two segments of a file's parent directory, e.g.
 * "…/client/explorer" for "plugins/.../src/client/explorer/ScmPanel.tsx".
 * A deeply-nested repo makes the full parent path a different length on
 * every row, so CSS ellipsis truncates each one at a different point —
 * from a glance that reads as ragged, mismatched type rather than one
 * consistent line of text. Showing a fixed-depth tail keeps every row the
 * same shape; the full path is still one hover away via the row's title.
 */
function shortDirOf(filePath: string): string {
  const slash = filePath.lastIndexOf('/')
  if (slash === -1) return ''
  const dir = filePath.slice(0, slash)
  const parts = dir.split('/')
  return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : dir
}

export function ScmPanel({ root, onOpenFile, onNotify }: ScmPanelProps) {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [committing, setCommitting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [graphLoading, setGraphLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [commitMenuOpen, setCommitMenuOpen] = useState(false)
  const [graphMenuOpen, setGraphMenuOpen] = useState(false)
  const statusRef = useRef(status)
  statusRef.current = status

  // `silent` skips the loading-spinner toggle: the 15s auto-refresh polls in
  // the background and, most ticks, finds nothing new — flashing both
  // spinners on every tick regardless read as UI jitter, not "refreshing".
  // Manual clicks (the refresh buttons, the initial mount) still want the
  // spinner as real, visible feedback that something is happening.
  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!root) return
    if (!opts?.silent) setLoading(true)
    const res = await gitStatus(root)
    if (!opts?.silent) setLoading(false)
    if (res.ok) {
      setStatus(res.value)
    }
  }, [root])

  const refreshGraph = useCallback(async (opts?: { silent?: boolean }) => {
    if (!root) return
    if (!opts?.silent) setGraphLoading(true)
    const res = await gitLog(root, GRAPH_LIMIT)
    if (!opts?.silent) setGraphLoading(false)
    if (res.ok) setCommits(res.value)
  }, [root])

  useEffect(() => {
    void refresh()
    void refreshGraph()
  }, [refresh, refreshGraph])

  useEffect(() => {
    if (!autoRefresh || !root) return
    const id = window.setInterval(() => {
      void refresh({ silent: true })
      void refreshGraph({ silent: true })
    }, AUTO_REFRESH_MS)
    return () => { window.clearInterval(id) }
  }, [autoRefresh, root, refresh, refreshGraph])

  const toggleSection = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleStage = async (file: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!root) return
    const res = await gitStage(root, file)
    if (res.ok) {
      void refresh()
      onNotify?.(`Staged ${file}`)
    }
  }

  const handleUnstage = async (file: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!root) return
    const res = await gitUnstage(root, file)
    if (res.ok) {
      void refresh()
      onNotify?.(`Unstaged ${file}`)
    }
  }

  const handleDiscard = async (file: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!root) return
    if (!window.confirm(`Are you sure you want to discard changes in ${file}?`)) return
    const res = await gitDiscard(root, file)
    if (res.ok) {
      void refresh()
      onNotify?.(`Discarded changes in ${file}`)
    }
  }

  const handleStageAll = async () => {
    if (!root || !status || !status.repo || !status.unstaged) return
    for (const item of status.unstaged) {
      await gitStage(root, item.path)
    }
    void refresh()
    onNotify?.('Staged all changes')
  }

  const handleUnstageAll = async () => {
    if (!root || !status || !status.repo || !status.staged) return
    for (const item of status.staged) {
      await gitUnstage(root, item.path)
    }
    void refresh()
    onNotify?.('Unstaged all changes')
  }

  const handleDiscardAll = async () => {
    if (!root || !status || !status.repo || !status.unstaged || status.unstaged.length === 0) return
    if (!window.confirm(`Discard all ${status.unstaged.length} changes? This cannot be undone.`)) return
    for (const item of status.unstaged) {
      await gitDiscard(root, item.path)
    }
    void refresh()
    onNotify?.('Discarded all changes')
  }

  const handleCommit = async () => {
    if (!root || commitMessage.trim().length === 0) return
    const current = statusRef.current
    // "Smart commit": nothing staged is the common case (most users never
    // stage explicitly), and demanding a manual stage first before Commit
    // does anything is exactly the dead-end that made the button feel
    // broken. Only auto-stage when NOTHING is staged — once the user has
    // staged something on purpose, Commit respects that and commits only
    // what they chose.
    if (current?.repo === true && (current.staged ?? []).length === 0 && (current.unstaged ?? []).length > 0) {
      for (const item of current.unstaged ?? []) {
        await gitStage(root, item.path)
      }
    }
    setCommitting(true)
    const res = await gitCommit(root, commitMessage.trim())
    setCommitting(false)
    if (res.ok) {
      setCommitMessage('')
      void refresh()
      void refreshGraph()
      onNotify?.('Committed changes successfully!')
    } else {
      onNotify?.(`Commit failed: ${res.error}`)
    }
  }

  const handleCommitAll = async () => {
    if (!root || commitMessage.trim().length === 0) return
    const current = statusRef.current
    if (current?.repo === true && current.unstaged) {
      for (const item of current.unstaged) {
        await gitStage(root, item.path)
      }
    }
    await handleCommit()
  }

  const handleCommitAndPush = async () => {
    if (!root || commitMessage.trim().length === 0) return
    await handleCommit()
    const pushRes = await gitPush(root)
    if (pushRes.ok) {
      onNotify?.('Committed and pushed')
      void refresh()
    } else {
      onNotify?.(`Push failed: ${pushRes.error}`)
    }
  }

  const handlePublish = async () => {
    if (!root) return
    setSyncing(true)
    const res = await gitPush(root)
    setSyncing(false)
    if (res.ok) {
      onNotify?.('Branch published')
      void refresh()
      void refreshGraph()
    } else {
      onNotify?.(`Publish failed: ${res.error}`)
    }
  }

  const handleSync = async () => {
    if (!root) return
    const current = statusRef.current
    const wantsPull = current?.repo === true && (current.behind ?? 0) > 0
    const wantsPush = current?.repo === true && (current.ahead ?? 0) > 0
    setSyncing(true)
    if (wantsPull) {
      const pullRes = await gitPull(root)
      if (!pullRes.ok) {
        setSyncing(false)
        onNotify?.(`Pull failed: ${pullRes.error}`)
        return
      }
    }
    if (wantsPush || !wantsPull) {
      const pushRes = await gitPush(root)
      if (!pushRes.ok) {
        setSyncing(false)
        onNotify?.(`Push failed: ${pushRes.error}`)
        return
      }
    }
    setSyncing(false)
    onNotify?.('Synced changes')
    void refresh()
    void refreshGraph()
  }

  const handlePull = async () => {
    if (!root) return
    const res = await gitPull(root)
    if (res.ok) {
      onNotify?.('Pulled from remote')
      void refresh()
      void refreshGraph()
    } else {
      onNotify?.(`Pull failed: ${res.error}`)
    }
  }

  const handleFetch = async () => {
    if (!root) return
    const res = await gitFetch(root)
    if (res.ok) {
      onNotify?.('Fetched from remote')
      void refresh()
    } else {
      onNotify?.(`Fetch failed: ${res.error}`)
    }
  }

  const handleCopyHash = async (hash: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await navigator.clipboard.writeText(hash)
      onNotify?.(`Copied ${hash.slice(0, 7)}`)
    } catch {
      onNotify?.('Copy failed')
    }
  }

  if (!status || !status.repo) {
    return (
      <div className={css.wrap}>
        <div className={css.emptyState}>
          <p>No git repository detected in active workspace.</p>
        </div>
      </div>
    )
  }

  const handleGenerateCommitMessage = () => {
    const list = staged.length > 0 ? staged : unstaged
    if (list.length === 0) return

    const paths = list.map(f => f.path)
    let prefix = 'feat'
    let scope = 'workspace'

    if (paths.every(p => p.endsWith('.test.ts') || p.startsWith('tests/'))) {
      prefix = 'test'
      scope = 'unit'
    } else if (paths.every(p => p.endsWith('.css'))) {
      prefix = 'style'
      scope = 'ui'
    } else if (paths.every(p => p.endsWith('.md'))) {
      prefix = 'docs'
      scope = 'readme'
    } else if (paths.some(p => p.includes('tiptap/'))) {
      prefix = 'feat'
      scope = 'tiptap'
    } else if (paths.some(p => p.includes('explorer/'))) {
      prefix = 'feat'
      scope = 'explorer'
    } else if (paths.some(p => p.includes('workbench/'))) {
      prefix = 'feat'
      scope = 'workbench'
    } else if (paths.some(p => p.includes('utils/'))) {
      prefix = 'refactor'
      scope = 'utils'
    }

    const firstNames = paths.slice(0, 3).map(p => basename(p)).join(', ')
    const extraCount = paths.length > 3 ? ` and ${paths.length - 3} more files` : ''
    const generated = `${prefix}(${scope}): update ${firstNames}${extraCount}`
    setCommitMessage(generated)
  }

  const staged = status.staged || []
  const unstaged = status.unstaged || []
  const hasUpstream = status.upstream !== undefined
  const ahead = status.ahead ?? 0
  const behind = status.behind ?? 0
  const branch = status.branch || 'main'
  const headHash = commits.find(c => c.refs.some(r => r === 'HEAD' || r.startsWith('HEAD -> ')))?.hash
  // Committable means "there's a change to commit at all" — staged or not —
  // since handleCommit auto-stages everything when nothing was staged on
  // purpose. Gating this on staged.length alone left Commit dead-clicking
  // whenever the user had only unstaged edits, which is the common case.
  const hasAnythingToCommit = staged.length > 0 || unstaged.length > 0
  const canCommit = commitMessage.trim().length > 0 && hasAnythingToCommit
  const needsSync = !hasUpstream || ahead > 0 || behind > 0
  // Commit and Sync/Publish are one slot, not two stacked buttons: showing
  // both invites clicking the wrong one when only one is actually possible.
  // Any pending change takes priority (committing is the immediate next
  // step); Sync/Publish only surfaces once the working tree is clean.
  const showSyncPrimary = !hasAnythingToCommit && needsSync

  return (
    <div className={css.wrap}>
      {/* Outer "Changes" header: repository-level toolbar, collapses the commit box + lists as a unit. */}
      <div className={css.sectionHeader} onClick={() => { toggleSection('outer') }}>
        <Chevron expanded={!collapsed.outer} />
        <span>Changes</span>
        <div className={css.sectionActions}>
          <Tooltip content="Commit">
            <IconButton
              size="xs"
              variant="ghost"
              onClick={e => { e.stopPropagation(); void handleCommit() }}
              disabled={!canCommit}
              aria-label="Commit"
            >
              ✓
            </IconButton>
          </Tooltip>
          <Tooltip content="Refresh">
            <IconButton
              size="xs"
              variant="ghost"
              onClick={e => { e.stopPropagation(); void refresh(); void refreshGraph() }}
              disabled={loading}
              aria-label="Refresh"
            >
              {loading ? <Spinner size="xs" /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip content="More Actions...">
            <IconButton
              size="xs"
              variant="ghost"
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
              aria-label="More Actions"
            >
              ⋯
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {menuOpen && (
        <>
          <div className={css.menuBackdrop} onClick={() => { setMenuOpen(false) }} />
          <div className={css.menu}>
            <button type="button" className={css.menuItem} onClick={() => { setMenuOpen(false); void handleFetch() }}>Fetch</button>
            <button type="button" className={css.menuItem} onClick={() => { setMenuOpen(false); void handlePull() }}>Pull</button>
            <button type="button" className={css.menuItem} onClick={() => { setMenuOpen(false); void handlePublish() }}>{hasUpstream ? 'Push' : 'Publish Branch'}</button>
            <div className={css.menuDivider} />
            <button
              type="button"
              className={css.menuItem}
              disabled={unstaged.length === 0}
              onClick={() => { setMenuOpen(false); void handleDiscardAll() }}
            >
              Discard All Changes
            </button>
          </div>
        </>
      )}

      {!collapsed.outer && (
        <>
          <div className={css.commitBox}>
            <div className={css.inputRow}>
              <textarea
                className={css.commitInput}
                placeholder={`Message (Ctrl+Enter to commit on "${branch}")`}
                value={commitMessage}
                onChange={e => { setCommitMessage(e.target.value) }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    void handleCommit()
                  }
                }}
              />
              <div className={css.generateBtnSlot}>
                <Tooltip content="Generate Commit Message with AI" placement="left">
                  <IconButton
                    size="xs"
                    variant="default"
                    onClick={handleGenerateCommitMessage}
                    disabled={staged.length === 0 && unstaged.length === 0}
                    aria-label="Generate Commit Message with AI"
                  >
                    <SparkleIcon />
                  </IconButton>
                </Tooltip>
              </div>
            </div>
            {showSyncPrimary ? (
              !hasUpstream ? (
                <Button
                  size="sm"
                  variant="primary"
                  className={css.fullWidthBtn}
                  onClick={() => { void handlePublish() }}
                  loading={syncing}
                >
                  <span className={css.btnIcon}><CloudUploadIcon /></span> Publish Branch
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  className={css.fullWidthBtn}
                  onClick={() => { void handleSync() }}
                  loading={syncing}
                >
                  <span className={css.btnIcon}><SyncIcon /></span>
                  Sync Changes{behind > 0 ? ` ↓${behind}` : ''}{ahead > 0 ? ` ↑${ahead}` : ''}
                </Button>
              )
            ) : (
              <div className={css.commitRow}>
                <Button
                  size="sm"
                  variant="primary"
                  className={css.commitMainBtn}
                  onClick={() => { void handleCommit() }}
                  loading={committing}
                  disabled={!canCommit}
                >
                  ✓ Commit
                </Button>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className={css.commitMenuBtn}
                    onClick={() => { setCommitMenuOpen(v => !v) }}
                    aria-label="More Commit Actions"
                  >
                    ▾
                  </button>
                  {commitMenuOpen && (
                    <>
                      <div className={css.menuBackdrop} onClick={() => { setCommitMenuOpen(false) }} />
                      <div className={css.menu} style={{ top: 30, right: 0 }}>
                        <button
                          type="button"
                          className={css.menuItem}
                          disabled={!canCommit}
                          onClick={() => { setCommitMenuOpen(false); void handleCommitAndPush() }}
                        >
                          Commit &amp; Push
                        </button>
                        <button
                          type="button"
                          className={css.menuItem}
                          disabled={commitMessage.trim().length === 0 || unstaged.length === 0}
                          onClick={() => { setCommitMenuOpen(false); void handleCommitAll() }}
                        >
                          Commit All Changes
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div className={css.lists}>
        {/* Staged Changes: hidden entirely when empty, matching VS Code. */}
        {!collapsed.outer && staged.length > 0 && (
          <>
            <div className={css.sectionHeader} onClick={() => { toggleSection('staged') }}>
              <Chevron expanded={!collapsed.staged} />
              <span>Staged Changes</span>
              <span className={css.badgeCount}>{staged.length}</span>
              <div className={css.sectionActions}>
                <Tooltip content="Unstage All Changes">
                  <IconButton
                    size="xs"
                    variant="ghost"
                    onClick={e => { e.stopPropagation(); void handleUnstageAll() }}
                    aria-label="Unstage All Changes"
                  >
                    −
                  </IconButton>
                </Tooltip>
              </div>
            </div>

            {!collapsed.staged && staged.map((file: GitFileChange) => {
              const name = basename(file.path) || file.path
              const dir = shortDirOf(file.path)
              const statusClass =
                file.status === 'M' ? css.statusM : file.status === 'A' ? css.statusA : css.statusD
              return (
                <div
                  key={`staged-${file.path}`}
                  className={css.fileItem}
                  title={file.path}
                  onClick={() => { onOpenFile(`${root}/${file.path}`) }}
                >
                  <span className={css.fileName}>{name}</span>
                  {dir && <span className={css.fileDir}>{dir}</span>}
                  <span className={`${css.fileBadge} ${statusClass}`}>{file.status}</span>
                  <div className={css.fileActions}>
                    <Tooltip content="Unstage">
                      <IconButton
                        size="xs"
                        variant="ghost"
                        onClick={e => { void handleUnstage(file.path, e) }}
                        aria-label="Unstage"
                      >
                        −
                      </IconButton>
                    </Tooltip>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* Changes (Unstaged) */}
        {!collapsed.outer && (
          <>
            <div className={css.sectionHeader} onClick={() => { toggleSection('changes') }}>
              <Chevron expanded={!collapsed.changes} />
              <span>Changes</span>
              <span className={css.badgeCount}>{unstaged.length}</span>
              <div className={css.sectionActions}>
                {unstaged.length > 0 && (
                  <Tooltip content="Stage All Changes">
                    <IconButton
                      size="xs"
                      variant="ghost"
                      onClick={e => { e.stopPropagation(); void handleStageAll() }}
                      aria-label="Stage All Changes"
                    >
                      +
                    </IconButton>
                  </Tooltip>
                )}
              </div>
            </div>

            {!collapsed.changes && (unstaged.length === 0 ? (
              <div className={css.emptyState}>No working changes</div>
            ) : (
              unstaged.map((file: GitFileChange) => {
                const name = basename(file.path) || file.path
                const dir = shortDirOf(file.path)
                const statusClass =
                  file.status === 'M'
                    ? css.statusM
                    : file.status === 'D'
                      ? css.statusD
                      : file.status === 'U'
                        ? css.statusU
                        : css.statusA
                return (
                  <div
                    key={`unstaged-${file.path}`}
                    className={css.fileItem}
                    title={file.path}
                    onClick={() => { onOpenFile(`${root}/${file.path}`) }}
                  >
                    <span className={css.fileName}>{name}</span>
                    {dir && <span className={css.fileDir}>{dir}</span>}
                    <span className={`${css.fileBadge} ${statusClass}`}>{file.status}</span>
                    <div className={css.fileActions}>
                      <Tooltip content="Stage changes">
                        <IconButton
                          size="xs"
                          variant="ghost"
                          onClick={e => { void handleStage(file.path, e) }}
                          aria-label="Stage changes"
                        >
                          +
                        </IconButton>
                      </Tooltip>
                      <Tooltip content="Discard changes">
                        <IconButton
                          size="xs"
                          variant="ghost"
                          onClick={e => { void handleDiscard(file.path, e) }}
                          aria-label="Discard changes"
                        >
                          ↩
                        </IconButton>
                      </Tooltip>
                    </div>
                  </div>
                )
              })
            ))}
          </>
        )}

        {/* Graph: independent of the outer "Changes" collapse — always available. */}
        <div className={css.sectionHeader} style={{ marginTop: 12 }} onClick={() => { toggleSection('graph') }}>
          <Chevron expanded={!collapsed.graph} />
          <span>Graph</span>
          <div className={css.sectionActions}>
            <button
              type="button"
              className={css.autoToggle}
              data-on={autoRefresh || undefined}
              onClick={e => { e.stopPropagation(); setAutoRefresh(v => !v) }}
              title={autoRefresh ? 'Auto-refresh is on' : 'Auto-refresh is off'}
            >
              Auto
            </button>
            <Tooltip content="Fetch">
              <IconButton
                size="xs"
                variant="ghost"
                onClick={e => { e.stopPropagation(); void handleFetch() }}
                aria-label="Fetch"
              >
                <CloudUploadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip content="Refresh Graph">
              <IconButton
                size="xs"
                variant="ghost"
                onClick={e => { e.stopPropagation(); void refreshGraph() }}
                disabled={graphLoading}
                aria-label="Refresh Graph"
              >
                {graphLoading ? <Spinner size="xs" /> : <RefreshIcon />}
              </IconButton>
            </Tooltip>
            <div style={{ position: 'relative' }}>
              <Tooltip content="More Actions...">
                <IconButton
                  size="xs"
                  variant="ghost"
                  onClick={e => { e.stopPropagation(); setGraphMenuOpen(v => !v) }}
                  aria-label="More Actions"
                >
                  ⋯
                </IconButton>
              </Tooltip>
              {graphMenuOpen && (
                <>
                  <div className={css.menuBackdrop} onClick={() => { setGraphMenuOpen(false) }} />
                  <div className={css.menu} style={{ top: 26, right: 0 }}>
                    <button type="button" className={css.menuItem} onClick={() => { setGraphMenuOpen(false); void handlePull() }}>Pull</button>
                    <button type="button" className={css.menuItem} onClick={() => { setGraphMenuOpen(false); void handlePublish() }}>{hasUpstream ? 'Push' : 'Publish Branch'}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {!collapsed.graph && (
          commits.length === 0 ? (
            <div className={css.emptyState}>No commits yet</div>
          ) : (
            <div className={css.graphList}>
              {commits.map((c, idx) => {
                const badges = localRefNames(c.refs)
                const isHead = c.hash === headHash
                return (
                  <div
                    key={c.hash}
                    className={css.graphRow}
                    title={`${c.hash.slice(0, 7)} • ${c.author} • ${c.date}\nClick to copy commit hash`}
                    onClick={() => { void handleCopyHash(c.hash) }}
                  >
                    <div className={css.graphRail}>
                      {idx !== 0 && <span className={css.railLine} data-pos="top" />}
                      <span className={css.graphDot} data-head={isHead || undefined} />
                      {idx !== commits.length - 1 && <span className={css.railLine} data-pos="bottom" />}
                    </div>
                    <div className={css.graphContent}>
                      <span className={css.graphHash}>{c.hash.slice(0, 7)}</span>
                      <span className={css.graphSubject}>{c.subject}</span>
                      <span className={css.graphAuthor}>{c.author}</span>
                      {badges.length > 0 && (
                        <span className={css.graphBadges}>
                          {badges.map(b => (
                            <span key={b} className={css.branchPill}>
                              <span className={css.branchPillDot} />
                              {b}
                            </span>
                          ))}
                        </span>
                      )}
                      <div className={css.graphActions}>
                        <Tooltip content="Copy commit hash">
                          <IconButton
                            size="xs"
                            variant="ghost"
                            onClick={e => { void handleCopyHash(c.hash, e) }}
                            aria-label="Copy commit hash"
                          >
                            ⧉
                          </IconButton>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
