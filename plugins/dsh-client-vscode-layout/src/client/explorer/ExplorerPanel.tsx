/**
 * The left column: Explorer, Search, and Sessions as three tabs.
 *
 * "Sessions" is the stock session-list slot, re-hosted here as a tab. That
 * relocation is the reason this package occupies the shell's root slot at all
 * (contract/slots.ts) — the slot renders where the frame puts it, and the
 * frame hands the rendered subtree down as a prop.
 *
 * The panel owns the column's *chrome*: which tab shows, the workspace root,
 * the hidden-files preference, and the footer status line. The tree owns
 * listings and editing; the search panel owns its query. Tab subtrees stay
 * mounted so switching away and back keeps scroll position, expansion state
 * and search results.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { workspaceRoot as resolveWorkspaceRoot } from '../api/files.ts'
import type { WorkspaceItemInfo } from '../contract/slots.ts'
import { FileTree, type FileTreeHandle } from './FileTree.tsx'
import { SearchPanel } from './SearchPanel.tsx'
import { ScmPanel } from './ScmPanel.tsx'
import css from './ExplorerPanel.module.css'

/** Which tab the column is showing. */
export type ExplorerTab = 'explorer' | 'search' | 'scm' | 'sessions'

/** Explorer panel props. */
export interface ExplorerPanelProps {
  /** True when the frame solved this column to zero width. */
  collapsed: boolean
  /** Path of the file open in the editor, highlighted in the tree. */
  activePath: string | undefined
  /** Reveal a file, optionally at a 1-based line. */
  onOpenFile: (path: string, line?: number) => void
  /** Compose an "explain this file" prompt for the assistant. */
  onAskAI: (path: string) => void
  /** The re-hosted session-list slot, rendered as the Sessions tab. */
  sessions: ReactNode
  /**
   * The directory being browsed. Held by the frame rather than here because
   * the centre column's breadcrumb navigates it too.
   */
  root: string | undefined
  /** The sandbox boundary; the target of "reset to workspace folder". */
  workspaceRoot: string | undefined
  onRootChange: (path: string) => void
  /** Report the resolved sandbox root once the host names it. */
  onWorkspaceRootResolved: (path: string) => void
  /** Open/connect workspace and switch AI Chat session. */
  openWorkspace?: ((path: string) => Promise<void>) | undefined
  /** Open native directory picker. */
  pickDirectory?: (() => Promise<string | null>) | undefined
  /** List registered workspaces. */
  listWorkspaces?: (() => WorkspaceItemInfo[]) | undefined
  /** Toast notifier. */
  onNotify?: ((message: string, type?: 'info' | 'success' | 'warning' | 'error') => void) | undefined
}

/** How long a footer status message stays before clearing, in ms. */
const NOTICE_MS = 4000

/** The explorer column (see module doc). */
export function ExplorerPanel({
  collapsed, activePath, onOpenFile, onAskAI, sessions,
  root, workspaceRoot, onRootChange, onWorkspaceRootResolved,
  openWorkspace, pickDirectory, listWorkspaces, onNotify,
}: ExplorerPanelProps) {
  const [tab, setTab] = useState<ExplorerTab>('explorer')
  const [rootError, setRootError] = useState<string | undefined>(undefined)
  const [showHidden, setShowHidden] = useState(false)
  const [pathDraft, setPathDraft] = useState<string | undefined>(undefined)
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false)
  // Carries a sequence number: setting the identical message twice would
  // otherwise bail out of the re-render, leaving the first timer to clear the
  // second message early.
  const [notice, setNotice] = useState<{ text: string; seq: number } | undefined>(undefined)

  const treeRef = useRef<FileTreeHandle | null>(null)

  // Resolve the sandbox root once; everything below waits on it.
  useEffect(() => {
    if (workspaceRoot !== undefined) return
    let live = true
    void (async () => {
      const result = await resolveWorkspaceRoot()
      if (!live) return
      if (!result.ok) { setRootError(result.error); return }
      onWorkspaceRootResolved(result.value)
      onRootChange(result.value)
    })()
    return () => { live = false }
    // Runs once, when the frame has no root yet; the callbacks are stable
    // store actions and re-running on their identity would refetch needlessly.
  }, [workspaceRoot])

  const notify = useCallback((message: string) => {
    setNotice(prev => ({ text: message, seq: (prev?.seq ?? 0) + 1 }))
  }, [])

  // Auto-clear the footer: a stale "Path copied" three minutes later is noise.
  useEffect(() => {
    if (notice === undefined) return
    const timer = setTimeout(() => { setNotice(undefined) }, NOTICE_MS)
    return () => { clearTimeout(timer) }
  }, [notice])

  // A collapsed column stays mounted at zero width rather than unmounting:
  // the Sessions tab hosts another plugin's subtree, and dropping it would
  // discard its state and make it refetch on every collapse. aria-hidden keeps
  // the invisible column out of the accessibility tree.
  return (
    <div className={css.panel} data-collapsed={collapsed || undefined} aria-hidden={collapsed || undefined}>
      <div className={css.tabBar} role="tablist" aria-label="Explorer">
        {(['explorer', 'search', 'scm', 'sessions'] as const).map(id => (
          <button
            key={id}
            type="button"
            role="tab"
            className={css.tab}
            aria-selected={tab === id}
            data-active={tab === id || undefined}
            onClick={() => { setTab(id) }}
          >
            {id === 'explorer' ? 'Explorer' : id === 'search' ? 'Search' : id === 'scm' ? 'SCM' : 'Sessions'}
          </button>
        ))}
      </div>

      {tab === 'explorer' && (
        <div className={css.toolbar}>
          <button
            type="button"
            className={css.rootButton}
            title={root ? `Active Workspace: ${root}\nClick to switch workspace` : 'Select Workspace'}
            onClick={() => { setWorkspaceDropdownOpen(prev => !prev) }}
          >
            <span className={css.rootName}>
              {root === undefined ? 'Loading…' : baseName(root)}
            </span>
            <span className={css.rootChevron}>▾</span>
          </button>
          <button type="button" className={css.tool} title="New File" onClick={() => treeRef.current?.startCreate('file')}>＋</button>
          <button type="button" className={css.tool} title="New Folder" onClick={() => treeRef.current?.startCreate('folder')}>📁</button>
          <button type="button" className={css.tool} title="Refresh" onClick={() => treeRef.current?.refresh()}>⟳</button>
          <button
            type="button"
            className={css.tool}
            data-on={showHidden || undefined}
            aria-pressed={showHidden}
            title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
            onClick={() => { setShowHidden(v => !v) }}
          >
            👁
          </button>
          <button
            type="button"
            className={css.tool}
            title="Switch or Open Workspace Folder"
            onClick={() => { setWorkspaceDropdownOpen(prev => !prev) }}
          >
            📂
          </button>
          {root !== undefined && workspaceRoot !== undefined && root !== workspaceRoot && (
            <button type="button" className={css.tool} title="Reset to workspace folder" onClick={() => { onRootChange(workspaceRoot) }}>⌂</button>
          )}
        </div>
      )}

      {workspaceDropdownOpen && (
        <>
          <div className={css.dropdownBackdrop} onClick={() => { setWorkspaceDropdownOpen(false) }} />
          <div className={css.workspaceDropdown}>
            <div className={css.workspaceHeader}>Workspaces</div>
            <div className={css.workspaceList}>
              {(listWorkspaces?.() ?? []).map(ws => {
                const isActive = root === ws.path || workspaceRoot === ws.path
                return (
                  <button
                    key={ws.workspaceId}
                    type="button"
                    className={css.workspaceItem}
                    data-active={isActive || undefined}
                    onClick={async () => {
                      setWorkspaceDropdownOpen(false)
                      if (openWorkspace) {
                        await openWorkspace(ws.path)
                        onNotify?.(`Switched workspace to ${ws.name}`, 'success')
                      } else {
                        onRootChange(ws.path)
                      }
                    }}
                  >
                    <span>📁</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className={css.workspaceItemName}>{ws.name}</div>
                      <div className={css.workspaceItemPath}>{ws.path}</div>
                    </div>
                    {isActive && <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 700 }}>✓</span>}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className={css.workspaceAction}
              onClick={async () => {
                setWorkspaceDropdownOpen(false)
                if (pickDirectory) {
                  const picked = await pickDirectory()
                  if (picked && openWorkspace) {
                    await openWorkspace(picked)
                    onNotify?.(`Opened workspace: ${baseName(picked)}`, 'success')
                  } else if (picked) {
                    onRootChange(picked)
                  }
                } else {
                  setPathDraft(root ?? '')
                }
              }}
            >
              <span>📂</span>
              <span>Open Folder from Disk…</span>
            </button>
            <button
              type="button"
              className={css.workspaceAction}
              onClick={() => {
                setWorkspaceDropdownOpen(false)
                setPathDraft(root ?? '')
              }}
            >
              <span>⌖</span>
              <span>Enter Path Manually…</span>
            </button>
          </div>
        </>
      )}

      {pathDraft !== undefined && (
        <form
          className={css.pathBar}
          onSubmit={async (event) => {
            event.preventDefault()
            const next = pathDraft.trim()
            if (next.length > 0) {
              if (openWorkspace) {
                await openWorkspace(next)
                onNotify?.(`Opened workspace: ${baseName(next)}`, 'success')
              } else {
                onRootChange(next)
              }
            }
            setPathDraft(undefined)
          }}
        >
          <input
            className={css.pathInput}
            autoFocus
            value={pathDraft}
            placeholder="Enter directory path…"
            aria-label="Directory path"
            onChange={(event) => { setPathDraft(event.target.value) }}
            onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setPathDraft(undefined) } }}
          />
        </form>
      )}

      <div className={css.body}>
        {/* Panels hide rather than unmount: switching tabs must not discard
            tree expansion or a search result set. */}
        <div className={css.pane} hidden={tab !== 'explorer'}>
          {rootError !== undefined && <div className={css.notice} data-error>{rootError}</div>}
          {root !== undefined && (
            <FileTree
              ref={treeRef}
              root={root}
              showHidden={showHidden}
              activePath={activePath}
              onOpenFile={onOpenFile}
              onAskAI={onAskAI}
              onNotify={notify}
            />
          )}
        </div>
        <div className={css.pane} hidden={tab !== 'search'}>
          {root !== undefined && <SearchPanel root={root} onOpenFile={onOpenFile} />}
        </div>
        <div className={css.pane} hidden={tab !== 'scm'}>
          {root !== undefined && <ScmPanel root={root} onOpenFile={onOpenFile} onNotify={notify} />}
        </div>
        <div className={css.pane} hidden={tab !== 'sessions'}>{sessions}</div>
      </div>

      {notice !== undefined && <div className={css.footer} role="status">{notice.text}</div>}
    </div>
  )
}

/** Last path segment, for the toolbar's root label. */
function baseName(path: string): string {
  const parts = path.replace(/\\/g, '/').replace(/\/$/, '').split('/')
  return parts[parts.length - 1] ?? path
}
