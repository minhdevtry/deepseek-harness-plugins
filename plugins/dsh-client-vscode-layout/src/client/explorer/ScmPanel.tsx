/**
 * Git source control workspace panel.
 *
 * Segregates working tree modifications into Staged and Unstaged change-lists
 * for granular commit building, and gates file discard behind an explicit
 * confirmation dialog because uncommitted working-tree deletions cannot be undone.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  gitCommit,
  gitDiscard,
  gitStage,
  gitStatus,
  gitUnstage,
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

export function ScmPanel({ root, onOpenFile, onNotify }: ScmPanelProps) {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [committing, setCommitting] = useState(false)

  const refresh = useCallback(async () => {
    if (!root) return
    setLoading(true)
    const res = await gitStatus(root)
    setLoading(false)
    if (res.ok) {
      setStatus(res.value)
    }
  }, [root])

  useEffect(() => {
    void refresh()
  }, [refresh])

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

  const handleCommit = async () => {
    if (!root || commitMessage.trim().length === 0) return
    setCommitting(true)
    const res = await gitCommit(root, commitMessage.trim())
    setCommitting(false)
    if (res.ok) {
      setCommitMessage('')
      void refresh()
      onNotify?.('Committed changes successfully!')
    } else {
      onNotify?.(`Commit failed: ${res.error}`)
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

  return (
    <div className={css.wrap}>
      <div className={css.topBar}>
        <span className={css.branch}>🌿 {status.branch || 'main'}</span>
        <Tooltip content="Refresh Git Status">
          <IconButton
            size="xs"
            variant="ghost"
            onClick={() => { void refresh() }}
            disabled={loading}
            className={css.refreshBtn}
            aria-label="Refresh Git Status"
          >
            {loading ? (
              <Spinner size="xs" />
            ) : (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9L14 6m0-4v4h-4" />
              </svg>
            )}
          </IconButton>
        </Tooltip>
      </div>

      <div className={css.commitBox}>
        <div style={{ position: 'relative' }}>
          <textarea
            className={css.commitInput}
            placeholder="Commit message (Ctrl+Enter to commit)..."
            value={commitMessage}
            onChange={e => { setCommitMessage(e.target.value) }}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                void handleCommit()
              }
            }}
          />
          <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
            <Tooltip content="Generate Commit Message with AI" placement="left">
              <IconButton
                size="xs"
                variant="ghost"
                onClick={handleGenerateCommitMessage}
                disabled={staged.length === 0 && unstaged.length === 0}
                aria-label="Generate Commit Message with AI"
              >
                🪄
              </IconButton>
            </Tooltip>
          </div>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => { void handleCommit() }}
          loading={committing}
          disabled={commitMessage.trim().length === 0 || staged.length === 0}
        >
          ✓ Commit
        </Button>
      </div>

      <div className={css.lists}>
        {/* Staged Changes */}
        <div className={css.sectionHeader}>
          <span>Staged Changes</span>
          <span className={css.badgeCount}>{staged.length}</span>
          <div className={css.sectionActions}>
            {staged.length > 0 && (
              <Tooltip content="Unstage All Changes">
                <IconButton
                  size="xs"
                  variant="ghost"
                  onClick={() => { void handleUnstageAll() }}
                  aria-label="Unstage All Changes"
                >
                  −
                </IconButton>
              </Tooltip>
            )}
          </div>
        </div>

        {staged.length === 0 ? (
          <div className={css.emptyState}>No staged changes</div>
        ) : (
          staged.map((file: GitFileChange) => {
            const name = basename(file.path) || file.path
            const dir = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : ''
            const statusClass =
              file.status === 'M' ? css.statusM : file.status === 'A' ? css.statusA : css.statusD
            return (
              <div
                key={`staged-${file.path}`}
                className={css.fileItem}
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
          })
        )}

        {/* Changes (Unstaged) */}
        <div className={css.sectionHeader} style={{ marginTop: 12 }}>
          <span>Changes</span>
          <span className={css.badgeCount}>{unstaged.length}</span>
          <div className={css.sectionActions}>
            {unstaged.length > 0 && (
              <Tooltip content="Stage All Changes">
                <IconButton
                  size="xs"
                  variant="ghost"
                  onClick={() => { void handleStageAll() }}
                  aria-label="Stage All Changes"
                >
                  +
                </IconButton>
              </Tooltip>
            )}
          </div>
        </div>

        {unstaged.length === 0 ? (
          <div className={css.emptyState}>No working changes</div>
        ) : (
          unstaged.map((file: GitFileChange) => {
            const name = basename(file.path) || file.path
            const dir = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : ''
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
        )}
      </div>
    </div>
  )
}
