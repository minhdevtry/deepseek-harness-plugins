/**
 * Source Control Management (SCM) Panel.
 *
 * Provides branch status, commit box, and lists for Staged and Unstaged changes
 * with 1-click stage, unstage, discard, and diff navigation.
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

  const staged = status.staged || []
  const unstaged = status.unstaged || []

  return (
    <div className={css.wrap}>
      <div className={css.topBar}>
        <span className={css.branch}>🌿 {status.branch || 'main'}</span>
        <button
          type="button"
          className={css.refreshBtn}
          onClick={() => { void refresh() }}
          title="Refresh Git status"
        >
          {loading ? '⏳' : '🔄'}
        </button>
      </div>

      <div className={css.commitBox}>
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
        <button
          type="button"
          className={css.commitBtn}
          onClick={() => { void handleCommit() }}
          disabled={committing || commitMessage.trim().length === 0 || staged.length === 0}
        >
          {committing ? 'Committing…' : '✓ Commit'}
        </button>
      </div>

      <div className={css.lists}>
        {/* Staged Changes */}
        <div className={css.sectionHeader}>
          <span>Staged Changes</span>
          <span className={css.badgeCount}>{staged.length}</span>
          <div className={css.sectionActions}>
            {staged.length > 0 && (
              <button
                type="button"
                className={css.iconBtn}
                onClick={() => { void handleUnstageAll() }}
                title="Unstage All Changes"
              >
                −
              </button>
            )}
          </div>
        </div>

        {staged.length === 0 ? (
          <div className={css.emptyState}>No staged changes</div>
        ) : (
          staged.map((file: GitFileChange) => {
            const name = file.path.split('/').pop() || file.path
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
                  <button
                    type="button"
                    className={css.iconBtn}
                    onClick={e => { void handleUnstage(file.path, e) }}
                    title="Unstage"
                  >
                    −
                  </button>
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
              <button
                type="button"
                className={css.iconBtn}
                onClick={() => { void handleStageAll() }}
                title="Stage All Changes"
              >
                +
              </button>
            )}
          </div>
        </div>

        {unstaged.length === 0 ? (
          <div className={css.emptyState}>No working changes</div>
        ) : (
          unstaged.map((file: GitFileChange) => {
            const name = file.path.split('/').pop() || file.path
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
                  <button
                    type="button"
                    className={css.iconBtn}
                    onClick={e => { void handleStage(file.path, e) }}
                    title="Stage changes"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className={css.iconBtn}
                    onClick={e => { void handleDiscard(file.path, e) }}
                    title="Discard changes"
                  >
                    ↩
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
