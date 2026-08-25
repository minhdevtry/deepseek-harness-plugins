/**
 * The view pane beside the host's rail: Explorer, Search, or Source Control.
 *
 * Deliberately NOT the column. The column belongs to ui-sidebar's SidebarRoot,
 * which draws the brand row, New Session, the workspace controls and Settings
 * at the width the frame hands it (contract/slots.ts); this panel fills the
 * space left over. Sessions is therefore absent here — selecting it hands the
 * column back to the host rather than nesting the host inside a tab.
 *
 * The panel owns only what is genuinely ours: the workspace root, the
 * hidden-files preference, and the footer status line. Which view shows is the
 * frame's (explorer/views.ts), because the rail switcher writes it from a
 * different registration. There is no collapse control here either — the host
 * rail's own toggle is the one affordance, routed through ctx.layout.
 *
 * View subtrees stay mounted so switching away and back keeps scroll position,
 * expansion state and search results.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { workspaceRoot as resolveWorkspaceRoot } from '../api/files.ts'
import type { WorkspaceItemInfo } from '../contract/slots.ts'
import type { ExplorerView } from './views.ts'
import { FileTree, type FileTreeHandle } from './FileTree.tsx'
import { SearchPanel } from './SearchPanel.tsx'
import { ScmPanel } from './ScmPanel.tsx'
import css from './ExplorerPanel.module.css'

/** Explorer panel props. */
export interface ExplorerPanelProps {
  /** Which of this panel's views is showing (never `sessions` — that is the host's). */
  view: Exclude<ExplorerView, 'sessions'>
  /** Path of the file open in the editor, highlighted in the tree. */
  activePath: string | undefined
  /** Reveal a file, optionally at a 1-based line. */
  onOpenFile: (path: string, line?: number) => void
  /** A file was renamed in the tree; forwarded from FileTree (see its own doc). */
  onFileRenamed?: ((oldPath: string, newPath: string) => void) | undefined
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
  view, activePath, onOpenFile, onFileRenamed,
  root, workspaceRoot, onRootChange, onWorkspaceRootResolved,
  openWorkspace, pickDirectory, listWorkspaces, onNotify,
}: ExplorerPanelProps) {
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

  return (
    <div className={css.panel}>
      {/* The view's own name, matching VS Code's section header. The host's
          brand row sits in the rail beside this, so the pane names itself
          rather than competing with it. */}
      <div className={css.viewTitle}>
        {view === 'explorer' ? 'Explorer' : view === 'search' ? 'Search' : 'Source Control'}
      </div>

      {view === 'explorer' && (
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
        {/* Views hide rather than unmount: switching must not discard tree
            expansion or a search result set. */}
        <div className={css.pane} hidden={view !== 'explorer'}>
          {rootError !== undefined && <div className={css.notice} data-error>{rootError}</div>}
          {root !== undefined && (
            <FileTree
              ref={treeRef}
              root={root}
              showHidden={showHidden}
              activePath={activePath}
              onOpenFile={onOpenFile}
              onFileRenamed={onFileRenamed}
              onNotify={notify}
            />
          )}
        </div>
        <div className={css.pane} hidden={view !== 'search'}>
          {root !== undefined && <SearchPanel root={root} onOpenFile={onOpenFile} />}
        </div>
        <div className={css.pane} hidden={view !== 'scm'}>
          {root !== undefined && <ScmPanel root={root} onOpenFile={onOpenFile} onNotify={notify} />}
        </div>
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
