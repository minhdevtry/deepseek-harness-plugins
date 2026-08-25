/**
 * The workspace file tree.
 *
 * Owns the loaded directory listings, the expansion set, the git status
 * overlay, and the inline edit (rename / create) affordance. Row ordering,
 * indentation and badge derivation are decided by the pure model in `tree.ts`;
 * this component holds state and renders.
 *
 * Directories load lazily on first expand and are cached, so collapsing and
 * re-expanding costs nothing. Git status is fetched per root and refreshed
 * after any mutation, since a create or rename changes it.
 *
 * Scope: the tree reports intent outward (`onOpenFile`) and never decides what
 * opening a file means — that belongs to the editor. Mentioning a file to the
 * assistant is not in this menu on purpose: the composer's own `@` menu does
 * it, in the place the operator is already typing.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import {
  createFile, createFolder, gitStatus, listDir, renameEntry, trashEntry,
  type GitStatuses, type Listing,
} from '../api/files.ts'
import { creationParent, flatten, normalize, relativeTo, type TreeRow } from './tree.ts'
import { dirIconId, fileIconId } from './icons/index.ts'
import { FileIcon } from './FileIcon.tsx'
import { ContextMenu, type MenuItem } from '../ui/ContextMenu.tsx'
import { Dialog } from '../ui/Dialog.tsx'
import css from './FileTree.module.css'

/** Tree props: what to show, and where intent goes. */
export interface FileTreeProps {
  /** Absolute path of the tree root. */
  root: string
  showHidden: boolean
  /** Path of the file currently open in the editor, highlighted in the tree. */
  activePath: string | undefined
  onOpenFile: (path: string) => void
  /**
   * Reported after any successful rename, whether or not the renamed path is
   * open — the caller owns the tab strip and its editor registries, so it
   * decides what a rename means for them (swap the tab in place if one
   * exists; do nothing otherwise). Without this, a renamed *open* file kept
   * its tab pointed at a path that no longer exists on disk, with no way to
   * close it short of quitting.
   */
  onFileRenamed?: ((oldPath: string, newPath: string) => void) | undefined
  /** Transient status for the panel footer (copied path, failure reason). */
  onNotify: (message: string) => void
}

/** An in-progress inline edit: renaming a row, or naming a new entry. */
type Edit =
  | { kind: 'rename'; path: string; initial: string }
  | { kind: 'create'; parent: string; type: 'file' | 'folder' }

/**
 * The last failed commit. `attempt` makes each failure a distinct identity so
 * the inline input can tell a repeat of the same message from a new one.
 */
type EditError = { message: string; attempt: number }

/** A row awaiting trash confirmation. */
type PendingTrash = { path: string; name: string }

/** Where the context menu is open, and on what. */
type MenuState = { x: number; y: number; row: TreeRow }

/**
 * Commands the panel toolbar issues to the tree. The tree owns the listings
 * and the edit affordance, so "create at the root" and "reload" are its verbs
 * to perform — a ref is the idiomatic way for the toolbar to ask, without
 * lifting tree-private state into the panel.
 */
export interface FileTreeHandle {
  /** Open the inline naming input for a new entry at the tree root. */
  startCreate: (type: 'file' | 'folder') => void
  /** Re-list every open directory and refresh git badges. */
  refresh: () => void
}

/** The workspace file tree (see module doc). */
export const FileTree = forwardRef<FileTreeHandle, FileTreeProps>(function FileTree(
  { root, showHidden, activePath, onOpenFile, onFileRenamed, onNotify }: FileTreeProps,
  ref,
) {
  const [listings, setListings] = useState<ReadonlyMap<string, Listing>>(new Map())
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [statuses, setStatuses] = useState<GitStatuses | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [rootError, setRootError] = useState<string | undefined>(undefined)
  const [edit, setEdit] = useState<Edit | undefined>(undefined)
  const [editError, setEditError] = useState<EditError | undefined>(undefined)
  const [menu, setMenu] = useState<MenuState | undefined>(undefined)
  const [pendingTrash, setPendingTrash] = useState<PendingTrash | undefined>(undefined)
  const [trashBusy, setTrashBusy] = useState(false)
  const [trashError, setTrashError] = useState<string | undefined>(undefined)

  // Guards every async settle: a root switch or unmount must not let a stale
  // response overwrite fresher state.
  const generation = useRef(0)

  const loadDir = useCallback(async (dir: string): Promise<void> => {
    const mine = generation.current
    const result = await listDir(dir)
    if (generation.current !== mine) return
    if (!result.ok) {
      if (normalize(dir) === normalize(root)) setRootError(result.error)
      else onNotify(`Cannot read ${dir}: ${result.error}`)
      return
    }
    setListings((prev) => new Map(prev).set(normalize(dir), result.value))
  }, [onNotify, root])

  const refreshGit = useCallback(async (): Promise<void> => {
    const mine = generation.current
    const result = await gitStatus(root)
    if (generation.current !== mine || !result.ok) return
    setStatuses(result.value.repo ? result.value.statuses : undefined)
  }, [root])

  /** Re-list every directory currently on screen, then refresh badges. */
  const refreshAll = useCallback(async (): Promise<void> => {
    const open = [normalize(root), ...expanded]
    await Promise.all(open.map(loadDir))
    await refreshGit()
  }, [expanded, loadDir, refreshGit, root])

  useImperativeHandle(ref, () => ({
    startCreate: (type) => {
      setEditError(undefined)
      setEdit({ kind: 'create', parent: normalize(root), type })
    },
    refresh: () => { void refreshAll() },
  }), [refreshAll, root])

  // Root switch: drop all cached state, then load fresh. Bumping the guard
  // first invalidates every in-flight response from the previous root.
  useEffect(() => {
    generation.current += 1
    setListings(new Map())
    setExpanded(new Set())
    setStatuses(undefined)
    setEdit(undefined)
    setRootError(undefined)
    setLoading(true)
    void (async () => {
      const mine = generation.current
      await Promise.all([loadDir(root), refreshGit()])
      if (generation.current === mine) setLoading(false)
    })()
    return () => { generation.current += 1 }
    // Deliberately keyed to `root` alone. loadDir and refreshGit are themselves
    // derived from `root`, but loadDir also closes over `onNotify` — including
    // it would reload the whole tree whenever the panel re-created that
    // callback, which is not what a root switch means.
  }, [root])

  const toggleDir = useCallback((path: string): void => {
    const key = normalize(path)
    const opening = !expanded.has(key)
    // The fetch is deliberately outside the updater: a state updater must stay
    // pure, and React invokes it twice under StrictMode — which would issue the
    // listing request twice in development. Lazy first load only; cached
    // listings make re-expansion free.
    if (opening && !listings.has(key)) void loadDir(key)
    setExpanded((prev) => {
      const next = new Set(prev)
      if (opening) next.add(key)
      else next.delete(key)
      return next
    })
  }, [expanded, listings, loadDir])

  const rows = useMemo(
    () => flatten(normalize(root), listings, expanded, statuses === undefined ? { showHidden } : { showHidden, statuses }),
    [root, listings, expanded, showHidden, statuses],
  )

  // Stable identity: ContextMenu re-subscribes its document listeners whenever
  // this changes, and an inline arrow would do that on every tree render.
  const closeMenu = useCallback(() => { setMenu(undefined) }, [])

  const copy = useCallback((text: string, label: string): void => {
    navigator.clipboard.writeText(text).then(
      () => { onNotify(`${label} copied`) },
      () => { onNotify('Clipboard unavailable') },
    )
  }, [onNotify])

  const commitEdit = useCallback(async (value: string): Promise<void> => {
    if (edit === undefined) return
    const name = value.trim()
    if (name.length === 0) { setEdit(undefined); return }

    const result = edit.kind === 'rename'
      ? await renameEntry(edit.path, name)
      : edit.type === 'file'
        ? await createFile(edit.parent, name)
        : await createFolder(edit.parent, name)

    if (!result.ok) {
      // Keep the input open with the typed name so a conflict can be corrected
      // in place rather than retyped from scratch.
      // A fresh object per failure: the input latch keys off this identity to
      // re-arm, so a second Enter can retry a corrected name.
      setEditError(prev => ({ message: result.error, attempt: (prev?.attempt ?? 0) + 1 }))
      return
    }

    setEdit(undefined)
    setEditError(undefined)
    if (edit.kind === 'create') {
      // Reveal the new entry: its parent must be expanded to show it.
      setExpanded(prev => new Set(prev).add(edit.parent))
      await loadDir(edit.parent)
      if (edit.type === 'file') onOpenFile(result.value)
    } else {
      await refreshAll()
      // Report the rename regardless of whether it's the active tab — a
      // renamed *background* tab would otherwise go stale exactly the same
      // way the active one used to.
      onFileRenamed?.(edit.path, result.value)
    }
    await refreshGit()
  }, [edit, loadDir, onFileRenamed, onOpenFile, refreshAll, refreshGit])

  const confirmTrash = useCallback(async (): Promise<void> => {
    if (pendingTrash === undefined) return
    setTrashBusy(true)
    setTrashError(undefined)
    const result = await trashEntry(pendingTrash.path)
    setTrashBusy(false)
    if (!result.ok) { setTrashError(result.error); return }
    setPendingTrash(undefined)
    onNotify(`Moved ${pendingTrash.name} to Trash`)
    await refreshAll()
  }, [onNotify, pendingTrash, refreshAll])

  const menuItems = useCallback((row: TreeRow): MenuItem[] => {
    const rel = relativeTo(normalize(root), row.path) ?? row.path
    const parent = creationParent(row)
    const items: MenuItem[] = []
    if (row.kind === 'file') {
      items.push({ kind: 'item', label: 'Open', onSelect: () => { onOpenFile(row.path) } })
      items.push({ kind: 'separator' })
    }
    items.push(
      { kind: 'item', label: 'New File…', onSelect: () => { setEditError(undefined); setExpanded(p => new Set(p).add(parent)); setEdit({ kind: 'create', parent, type: 'file' }) } },
      { kind: 'item', label: 'New Folder…', onSelect: () => { setEditError(undefined); setExpanded(p => new Set(p).add(parent)); setEdit({ kind: 'create', parent, type: 'folder' }) } },
      { kind: 'separator' },
      { kind: 'item', label: 'Rename', hint: 'F2', onSelect: () => { setEditError(undefined); setEdit({ kind: 'rename', path: row.path, initial: row.name }) } },
      { kind: 'item', label: 'Move to Trash', danger: true, onSelect: () => { setTrashError(undefined); setPendingTrash({ path: row.path, name: row.name }) } },
      { kind: 'separator' },
      { kind: 'item', label: 'Copy Path', onSelect: () => { copy(row.path, 'Path') } },
      { kind: 'item', label: 'Copy Relative Path', onSelect: () => { copy(rel, 'Relative path') } },
    )
    return items
  }, [copy, onOpenFile, root])

  if (loading) return <div className={css.notice}>Loading files…</div>
  if (rootError !== undefined) return <div className={css.notice} data-error>Unable to read directory: {rootError}</div>

  const createRow = edit?.kind === 'create' ? edit : undefined

  return (
    <div className={css.tree} role="tree" aria-label="Workspace files">
      {/* A create started from the toolbar targets the root, so its input has
          no row to sit under — render it at the top instead. */}
      {createRow !== undefined && normalize(createRow.parent) === normalize(root) && (
        <EditRow
          depth={0}
          placeholder={createRow.type === 'file' ? 'File name' : 'Folder name'}
          error={editError}
          onCommit={commitEdit}
          onCancel={() => { setEdit(undefined); setEditError(undefined) }}
        />
      )}

      {rows.map((row) => {
        const renaming = edit?.kind === 'rename' && normalize(edit.path) === normalize(row.path)
        if (renaming) {
          return (
            <EditRow
              key={row.path}
              depth={row.depth}
              initial={edit.initial}
              placeholder="New name"
              error={editError}
              onCommit={commitEdit}
              onCancel={() => { setEdit(undefined); setEditError(undefined) }}
            />
          )
        }
        return (
          <div key={row.path}>
            <Row
              row={row}
              active={activePath !== undefined && normalize(activePath) === normalize(row.path)}
              onActivate={() => { row.kind === 'dir' ? toggleDir(row.path) : onOpenFile(row.path) }}
              onRename={() => { setEditError(undefined); setEdit({ kind: 'rename', path: row.path, initial: row.name }) }}
              onMenu={(x, y) => { setMenu({ x, y, row }) }}
            />
            {/* A create targeting this expanded directory renders as its first child. */}
            {createRow !== undefined && row.kind === 'dir' && row.expanded
              && normalize(createRow.parent) === normalize(row.path) && (
              <EditRow
                depth={row.depth + 1}
                placeholder={createRow.type === 'file' ? 'File name' : 'Folder name'}
                error={editError}
                onCommit={commitEdit}
                onCancel={() => { setEdit(undefined); setEditError(undefined) }}
              />
            )}
          </div>
        )
      })}

      {/* Suppressed while naming a new entry: the input is already the
          answer to "there is nothing here". */}
      {rows.length === 0 && edit === undefined && <div className={css.notice}>This folder is empty</div>}

      {menu !== undefined && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.row)} onClose={closeMenu} />
      )}

      {pendingTrash !== undefined && (
        <Dialog
          title="Move to Trash?"
          message={`"${pendingTrash.name}" will be moved to your system Trash. You can restore it from there.`}
          busy={trashBusy}
          error={trashError}
          actions={[
            { label: 'Cancel', cancel: true, onSelect: () => { setPendingTrash(undefined); setTrashError(undefined) } },
            { label: 'Move to Trash', primary: true, danger: true, onSelect: () => { void confirmTrash() } },
          ]}
        />
      )}
    </div>
  )
})

/** One tree row: chevron, icon, name, git badge. */
function Row({ row, active, onActivate, onRename, onMenu }: {
  row: TreeRow
  active: boolean
  onActivate: () => void
  onRename: () => void
  onMenu: (x: number, y: number) => void
}) {
  return (
    <div
      className={css.row}
      role="treeitem"
      tabIndex={0}
      aria-selected={active}
      aria-expanded={row.kind === 'dir' ? row.expanded : undefined}
      data-active={active || undefined}
      data-hidden={row.hidden || undefined}
      // Indent by depth; the chevron column keeps files aligned with folders.
      style={{ paddingLeft: 6 + row.depth * 12 }}
      onClick={onActivate}
      onContextMenu={(event) => { event.preventDefault(); onMenu(event.clientX, event.clientY) }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); onActivate() }
        else if (event.key === 'F2') { event.preventDefault(); onRename() }
      }}
    >
      <span className={css.chevron} aria-hidden>
        {row.kind === 'dir' ? (row.expanded ? '▾' : '▸') : ''}
      </span>
      <FileIcon symbolId={row.kind === 'dir' ? dirIconId(row.expanded) : fileIconId(row.name)} />
      <span className={css.name}>{row.name}</span>
      {row.badge !== undefined && (
        <span className={css.badge} data-code={row.badge} title={badgeTitle(row.badge)}>
          {row.badge === '??' ? 'U' : row.badge}
        </span>
      )}
    </div>
  )
}

/** Inline text input used for both rename and create. */
function EditRow({ depth, initial, placeholder, error, onCommit, onCancel }: {
  depth: number
  initial?: string
  placeholder: string
  error: EditError | undefined
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLInputElement | null>(null)
  // Escape unmounts this input, and the browser fires `blur` on the way out —
  // which would run the commit path and create or rename the very thing the
  // operator just cancelled. One latch settles it: whoever finishes first wins.
  const settled = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (el === null) return
    el.focus()
    // Select the base name only, so renaming `notes.md` lands the caret ready
    // to retype `notes` without clobbering the extension.
    const dot = el.value.lastIndexOf('.')
    if (dot > 0) el.setSelectionRange(0, dot)
    else el.select()
  }, [])

  // A rejected name (already exists, refused by the sandbox) keeps the input
  // open, so the latch has to re-arm or the correction could never be
  // submitted. Each failure is a fresh object, so a repeat of the same message
  // still re-arms.
  useEffect(() => {
    if (error === undefined) return
    settled.current = false
    // The rejection may have arrived from a blur commit, which by definition
    // left the caret somewhere else — take it back so the fix can be typed.
    ref.current?.focus()
  }, [error])

  return (
    <div className={css.editRow} style={{ paddingLeft: 6 + depth * 12 }}>
      <input
        ref={ref}
        className={css.editInput}
        defaultValue={initial ?? ''}
        placeholder={placeholder}
        data-invalid={error !== undefined || undefined}
        // Blur commits rather than discards: clicking away from a typed name
        // and losing it is the more expensive mistake.
        onBlur={(event) => {
          if (settled.current) return
          settled.current = true
          onCommit(event.currentTarget.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            if (settled.current) return
            settled.current = true
            onCommit(event.currentTarget.value)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            settled.current = true
            onCancel()
          }
        }}
      />
      {error !== undefined && <span className={css.editError}>{error.message}</span>}
    </div>
  )
}

/** Human-readable meaning of a porcelain letter, for the badge tooltip. */
function badgeTitle(code: string): string {
  switch (code) {
    case 'M': return 'Modified'
    case 'A': return 'Added'
    case 'D': return 'Deleted'
    case 'R': return 'Renamed'
    case '??': return 'Untracked'
    default: return code
  }
}
