/**
 * Three-column workbench frame, registered into the built-in 'root' slot (the
 * web shell renders only 'root').
 *
 * Owns the grid tracks (explorer | editor | chat), the drag handles (pointer
 * capture + rAF throttle), the concession chain (columns.ts), and the
 * child-slot render decisions. Column roles differ from the stock shell: the
 * session-list slot renders as a tab inside the explorer column, the editor
 * takes the center, and the chat/details slots share the right column.
 *
 * Pure component: everything arrives through the framework shares — zero
 * cordis imports, zero self-made hooks.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { computeColumns, RAIL_WIDTH, SIDEBAR_AUTO_COLLAPSE, SIDEBAR_DEFAULT } from './columns.ts'
import type { createLayoutStore } from './stores.ts'
import type { FrameInjected } from './contract/slots.ts'
import { DragHandle } from './DragHandle.tsx'
import { RightColumn } from './RightColumn.tsx'
import { ExplorerPanel } from './explorer/ExplorerPanel.tsx'
import type { ExplorerView } from './explorer/views.ts'
import { Workbench } from './workbench/Workbench.tsx'
import { rename as renameTab } from './workbench/model/tabs.ts'
import { QuickOpen } from './ui/QuickOpen.tsx'
import { CommandPalette, type CommandItem } from './ui/CommandPalette.tsx'
import { InlineAI } from './ui/InlineAI.tsx'
import { Toast, type ToastItem, type ToastType } from './ui/Toast.tsx'
import { getLineRangeForSelection } from './utils/chatComposer.ts'
import { basename } from './utils/path.ts'
import { appendToComposer, appendMentionToComposer, focusComposer } from './composer.ts'
import { installWorkbenchOpener } from './fileOpener.ts'
import css from './AppFrame.module.css'

/**
 * Send a file mention with optional range to the chat composer.
 * Formats as pure filename without directory path: e.g. @ARCHITECTURE.md#L2-5 or @ARCHITECTURE.md
 */
function sendReferenceToComposer(path: string, sel?: any): boolean {
  const filename = basename(path) || path
  let range = ''
  if (sel?.rangeString) {
    range = sel.rangeString
  } else if (sel?.selectedText && typeof sel.selectedText === 'string' && sel.selectedText.trim().length > 0) {
    const docText = (window as any).__dsh_get_active_text?.(path) || ''
    if (docText) {
      const offsets = { from: sel.fromOffset ?? sel.from, to: sel.toOffset ?? sel.to }
      const res = getLineRangeForSelection(docText, sel.selectedText, offsets)
      if (res.rangeString) range = res.rangeString
    }
  }
  return appendMentionToComposer(filename, range)
}

/**
 * Ctrl/Cmd+Shift chords that select a left-column view, keyed by the letter.
 * The `sessions` view is deliberately absent: it is the host's surface and
 * reachable from the rail, and VS Code binds no viewlet key to it.
 */
const VIEW_KEYS: Record<string, ExplorerView | undefined> = {
  e: 'explorer',
  f: 'search',
  g: 'scm',
}

/** Full composed props: runtime share + child-slot render share + store share + injected face. */
export type AppFrameProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<'sidebar' | 'conversation' | 'details' | 'shell.overlay'>
  & PropsStore<ReturnType<typeof createLayoutStore>>
  & FrameInjected

/** The three-column workbench frame (see module doc). */
export function AppFrame({
  useStore, useSessions, actions, renderSlot, notify,
  openWorkspace, pickDirectory, listWorkspaces,
  useExplorerView, setExplorerView,
}: AppFrameProps) {
  const panels = useStore(s => s)

  // Modals and Overlays
  const [quickOpen, setQuickOpen] = useState(false)
  const [cmdPalette, setCmdPalette] = useState(false)
  const [inlineAIOpen, setInlineAIOpen] = useState(false)
  const [inlineSelection, setInlineSelection] = useState('')
  // The details surface is session-strict: it has nothing to show until a real
  // (non-blank) session is current.
  const detailsSession = useSessions((s) => {
    const current = s.current
    return current !== undefined && s.byId[current]?.blank === false ? current : undefined
  })

  // ── Two-Way Workspace Sync: Chat Session CWD -> Explorer Root ──
  const activeSessionCwd = useSessions((s) => {
    const current = s.current
    return current !== undefined ? s.byId[current]?.cwd : undefined
  })

  useEffect(() => {
    if (!activeSessionCwd) return
    if (panels.workspaceRoot !== activeSessionCwd) {
      actions.setWorkspaceRoot(activeSessionCwd)
      actions.setExplorerRoot(activeSessionCwd)
    }
  }, [actions, activeSessionCwd, panels.workspaceRoot])

  const frameRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200))
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1024 : false))

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 1023px)')
    const update = () => { setIsMobile(mq.matches) }
    update()
    mq.addEventListener('change', update)
    return () => { mq.removeEventListener('change', update) }
  }, [])

  // Track the frame's own box, not the window: the column solve is about the
  // space this frame actually got.
  useEffect(() => {
    const el = frameRef.current
    if (el === null) return
    const measure = (): void => {
      const width = el.getBoundingClientRect().width
      if (width > 0) setViewport(width)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    measure()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  // Narrow viewports auto-collapse the sidebar; the store mirror keeps
  // toggleSidebar's semantics right (narrow toggles flip the manual re-expand
  // override, stores.ts). Collapsed is decided here so the solver stays
  // breakpoint-free.
  const narrow = viewport < SIDEBAR_AUTO_COLLAPSE
  useEffect(() => { actions.setNarrow(narrow) }, [actions, narrow])

  // Seat the workbench opener the file-click interception delegates to
  // (fileOpener.ts). In mobile mode, let native navigation handle it.
  useEffect(() => {
    if (isMobile) return
    return installWorkbenchOpener((path) => {
      actions.openFile(path)
      return true
    })
  }, [actions, isMobile])

  /**
   * A file was renamed in the explorer. If it was open, its tab is swapped
   * to the new path in place (not closed-and-reopened, which would drop it
   * to the end of the strip) — otherwise the tab kept pointing at a path
   * that no longer exists on disk, with no way to close it.
   */
  const handleFileRenamed = useCallback((oldPath: string, newPath: string) => {
    if (!panels.tabs.includes(oldPath)) return
    actions.setTabs(
      renameTab(panels.tabs, oldPath, newPath),
      panels.activePath === oldPath ? newPath : panels.activePath,
    )
  }, [actions, panels.activePath, panels.tabs])

  const sidebarCollapsed = narrow ? !panels.narrowExpanded : panels.sidebar === 0
  const sidebarPreference = sidebarCollapsed
    ? 0
    : panels.sidebar === 0 ? SIDEBAR_DEFAULT : panels.sidebar
  const cols = computeColumns(viewport, sidebarPreference, panels.right)
  const colsRef = useRef(cols)
  colsRef.current = cols

  // Which view fills the column beside the host rail. `sessions` is the host's
  // own surface, so it takes the column whole rather than sitting in a pane.
  const view = useExplorerView()

  // A collapsed sidebar is RAIL_WIDTH here, not zero: the host's rail is the
  // permanent affordance (its toggle re-expands through ctx.layout), which is
  // why this frame ships no restore button of its own.
  const leftWidth = sidebarCollapsed ? RAIL_WIDTH : cols.sidebar
  const stockCollapsed = sidebarCollapsed || view !== 'sessions'
  const stockWidth = stockCollapsed ? RAIL_WIDTH : leftWidth

  // The drag base is the rendered width captured at drag start (grabbing a
  // concession-clamped panel must not jump back to the stored preference); it
  // stays frozen for the whole gesture so dx deltas do not compound.
  const sidebarBase = useRef(0)
  const rightBase = useRef(0)
  // Track-level transitions pause for the whole gesture: eased tracks would
  // detach the column edge from the pointer (AppFrame.module.css).
  const [dragging, setDragging] = useState(false)
  const onDragEnd = useCallback(() => { setDragging(false) }, [])
  const onSidebarStart = useCallback(() => { sidebarBase.current = colsRef.current.sidebar; setDragging(true) }, [])
  const onRightStart = useCallback(() => { rightBase.current = colsRef.current.right; setDragging(true) }, [])
  const onSidebarDrag = useCallback((dx: number) => { actions.setSidebar(sidebarBase.current + dx) }, [actions])
  // The right column's ceiling is viewport-derived, so the drag write carries
  // the frame width the gesture happened in (stores.setRight).
  const onRightDrag = useCallback((dx: number) => {
    actions.setRight(rightBase.current - dx, colsRef.current.sidebar + colsRef.current.center + colsRef.current.right)
  }, [actions])

  // Toasts notification queue
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const handleNotify = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setToasts(prev => [...prev.slice(-4), { id, message, type }])
    notify(message)
  }, [notify])
  const handleDismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Global keyboard shortcuts.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const mod = isMac ? e.metaKey : e.ctrlKey

      if (mod && e.key.toLowerCase() === 'p' && !e.shiftKey) {
        e.preventDefault()
        setQuickOpen(prev => !prev)
      } else if (mod && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        if (panels.activePath) {
          const remaining = panels.tabs.filter(t => t !== panels.activePath)
          const nextActive = remaining.length > 0 ? remaining[remaining.length - 1] : undefined
          actions.setTabs(remaining, nextActive)
        }
      } else if (mod && (e.key === 'Tab' || e.key === 'PageDown' || e.key === 'PageUp')) {
        if (panels.tabs.length > 1 && panels.activePath) {
          e.preventDefault()
          const tabs = panels.tabs
          const currentIdx = tabs.indexOf(panels.activePath)
          const isPrev = e.shiftKey || e.key === 'PageUp'
          const nextIdx = isPrev
            ? (currentIdx - 1 + tabs.length) % tabs.length
            : (currentIdx + 1) % tabs.length
          actions.openFile(tabs[nextIdx]!)
        }
      } else if ((mod && e.key.toLowerCase() === 'p' && e.shiftKey) || e.key === 'F1') {
        e.preventDefault()
        setCmdPalette(prev => !prev)
      } else if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const activeSel = (window as any).__dsh_active_selection
        const reported = activeSel?.path === panels.activePath
          ? (activeSel.selectedText as string | undefined)
          : undefined
        const winSel = window.getSelection()
        const inEditor =
          winSel !== null && !winSel.isCollapsed &&
          winSel.anchorNode !== null &&
          document.querySelector('.ProseMirror, .cm-content')?.contains(winSel.anchorNode) === true
        const sel = reported ?? (inEditor ? winSel!.toString() : '')
        setInlineSelection(sel.slice(0, 500))
        setInlineAIOpen(prev => !prev)
      } else if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        actions.toggleSidebar()
      } else if (mod && e.shiftKey && VIEW_KEYS[e.key.toLowerCase()] !== undefined) {
        e.preventDefault()
        setExplorerView(VIEW_KEYS[e.key.toLowerCase()]!)
      } else if (mod && e.key.toLowerCase() === 'l' && !e.shiftKey) {
        e.preventDefault()

        const activeSel = (window as any).__dsh_active_selection
        const hasSelection =
          panels.activePath !== undefined &&
          activeSel != null &&
          activeSel.path === panels.activePath &&
          typeof activeSel.selectedText === 'string' &&
          activeSel.selectedText.trim().length > 0

        if (hasSelection) {
          actions.openRight()
          actions.setRightTab('chat')
          if (sendReferenceToComposer(panels.activePath!, activeSel)) focusComposer()
          else handleNotify('Open a session first', 'warning')
        } else if (colsRef.current.right === 0) {
          actions.openRight()
          actions.setRightTab('chat')
        } else {
          actions.closeRight()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown) }
  }, [actions, handleNotify, isMobile, panels.activeLine, panels.activePath, panels.tabs, setExplorerView])

  const commands: CommandItem[] = useMemo(() => [
    {
      id: 'workbench.action.quickOpen',
      title: 'Go to File...',
      category: 'File',
      keybinding: 'Ctrl+P',
      action: () => { setQuickOpen(true) },
    },
    {
      id: 'workbench.action.toggleChat',
      title: 'Toggle AI Chat',
      category: 'View',
      keybinding: 'Ctrl+L',
      action: () => {
        if (colsRef.current.right === 0) {
          actions.openRight()
          actions.setRightTab('chat')
        } else {
          actions.closeRight()
        }
      },
    },
    {
      id: 'workbench.action.toggleSidebar',
      title: 'Toggle Primary Sidebar',
      category: 'View',
      keybinding: 'Ctrl+B',
      action: () => { actions.toggleSidebar() },
    },
    {
      id: 'workbench.action.showExplorer',
      title: 'Show Explorer',
      category: 'View',
      keybinding: 'Ctrl+Shift+E',
      action: () => { setExplorerView('explorer') },
    },
    {
      id: 'workbench.action.showSearch',
      title: 'Show Search in Files',
      category: 'View',
      keybinding: 'Ctrl+Shift+F',
      action: () => { setExplorerView('search') },
    },
    {
      id: 'workbench.action.showSCM',
      title: 'Show Source Control',
      category: 'View',
      keybinding: 'Ctrl+Shift+G',
      action: () => { setExplorerView('scm') },
    },
    {
      id: 'workbench.action.toggleAutoSave',
      title: 'Toggle Auto Save',
      category: 'File',
      action: () => {
        actions.toggleAutoSave()
        handleNotify(`Auto save ${!panels.autoSave ? 'enabled' : 'disabled'}`)
      },
    },
    {
      id: 'workbench.action.closeAllTabs',
      title: 'Close All Tabs',
      category: 'View',
      action: () => { actions.setTabs([], undefined) },
    },
    {
      id: 'workbench.action.askAIAboutFile',
      title: 'Ask AI About Active File',
      category: 'AI',
      action: () => {
        if (panels.activePath) {
          actions.openRight()
          actions.setRightTab('chat')
          const activeSel = (window as any).__dsh_active_selection
          const selObj = activeSel?.path === panels.activePath ? activeSel : undefined
          if (sendReferenceToComposer(panels.activePath, selObj)) focusComposer()
          else handleNotify('Open a session first', 'warning')
        } else {
          handleNotify('No active file open', 'warning')
        }
      },
    },
  ], [actions, handleNotify, panels.activePath, panels.autoSave, setExplorerView])

  const handleInlineAISubmit = useCallback((prompt: string, contextSnippet?: string) => {
    actions.openRight()
    actions.setRightTab('chat')
    if (panels.activePath) {
      const activeSel = (window as any).__dsh_active_selection
      const selObj = activeSel?.path === panels.activePath && activeSel.selectedText?.trim() === contextSnippet?.trim()
        ? activeSel
        : contextSnippet ? { selectedText: contextSnippet } : undefined
      sendReferenceToComposer(panels.activePath, selObj)
    }
    if (appendToComposer(prompt)) focusComposer()
    else handleNotify('Open a session first', 'warning')
  }, [actions, handleNotify, panels.activePath])

  if (isMobile) {
    const mobileSidebarCollapsed = narrow ? !panels.narrowExpanded : panels.sidebar === 0
    return (
      <div
        ref={frameRef}
        className={css.frame}
        data-sidebar-collapsed={mobileSidebarCollapsed || undefined}
        data-details-collapsed={true}
        data-dragging={dragging || undefined}
      >
        <div className={css.sidebarCol}>
          {renderSlot('sidebar', {
            collapsed: mobileSidebarCollapsed,
            width: mobileSidebarCollapsed ? RAIL_WIDTH : SIDEBAR_DEFAULT,
          })}
        </div>

        <div className={css.centerCol}>
          {renderSlot('conversation', {})}
        </div>

        <div className={css.detailsCol} style={{ width: 0, display: 'none' }}>
          {renderSlot('details', {})}
        </div>

        <div className={css.overlayLayer} data-shell-overlay>
          {renderSlot('shell.overlay', {})}
          <Toast toasts={toasts} onDismiss={handleDismissToast} />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={frameRef}
      className={css.frame}
      style={{ gridTemplateColumns: `${leftWidth}px minmax(0, 1fr) ${cols.right}px` }}
      data-sidebar-collapsed={sidebarCollapsed || undefined}
      data-right-collapsed={cols.right === 0 || undefined}
      data-dragging={dragging || undefined}
    >
      <div className={css.sidebarCol}>
        {/* The host's sidebar IS the column, at its stock width and with its
            stock collapse semantics — that is what keeps its brand row, New
            Session, workspace controls and Settings working (contract/slots.ts).
            On the `sessions` view it takes the column whole; on ours it renders
            its 56px rail and our panel fills the rest. Either way the subtree
            stays mounted, so switching views never refetches its session list. */}
        {renderSlot('sidebar', { collapsed: stockCollapsed, width: stockWidth })}
        {!sidebarCollapsed && (
          <div className={css.viewPane} hidden={view === 'sessions'}>
            <ExplorerPanel
              view={view === 'sessions' ? 'explorer' : view}
              activePath={panels.activePath}
              onOpenFile={actions.openFile}
              onFileRenamed={handleFileRenamed}
              root={panels.explorerRoot}
              workspaceRoot={panels.workspaceRoot}
              onRootChange={actions.setExplorerRoot}
              onWorkspaceRootResolved={actions.setWorkspaceRoot}
              openWorkspace={openWorkspace}
              pickDirectory={pickDirectory}
              listWorkspaces={listWorkspaces}
              onNotify={handleNotify}
            />
          </div>
        )}
      </div>

      <div className={css.centerCol}>
        <Workbench
          tabs={panels.tabs}
          activePath={panels.activePath}
          activeLine={panels.activeLine}
          autoSave={panels.autoSave}
          explorerRoot={panels.explorerRoot}
          onOpenFile={actions.openFile}
          onSetTabs={actions.setTabs}
          onMoveTab={actions.moveTab}
          onToggleAutoSave={actions.toggleAutoSave}
          onRevealDir={actions.setExplorerRoot}
          onNotify={handleNotify}
        />
      </div>

      {/* Width 0 keeps the subtree mounted: closing the chat must not discard
          its scroll position or in-flight composer draft. */}
      <RightColumn
        collapsed={cols.right === 0}
        tab={panels.rightTab}
        hasDetails={detailsSession !== undefined}
        onTab={actions.setRightTab}
        onClose={actions.closeRight}
        chat={renderSlot('conversation', {})}
        details={renderSlot('details', {})}
      />

      <div className={css.overlayLayer} data-shell-overlay>
        {renderSlot('shell.overlay', {})}
        <QuickOpen
          open={quickOpen}
          root={panels.explorerRoot}
          tabs={panels.tabs}
          onOpenFile={actions.openFile}
          onClose={() => { setQuickOpen(false) }}
        />
        <CommandPalette
          open={cmdPalette}
          commands={commands}
          onClose={() => { setCmdPalette(false) }}
        />
        <InlineAI
          open={inlineAIOpen}
          selectionText={inlineSelection}
          path={panels.activePath}
          onClose={() => { setInlineAIOpen(false) }}
          onSubmit={handleInlineAISubmit}
        />
        <Toast toasts={toasts} onDismiss={handleDismissToast} />
      </div>

      {/* A closed column has no edge to grab. */}
      {!sidebarCollapsed && (
        <DragHandle side="sidebar" left={leftWidth} onStart={onSidebarStart} onDrag={onSidebarDrag} onEnd={onDragEnd} />
      )}
      {/* The right column's left edge is derived from the frame, not summed
          from the left tracks: the rail floor decouples the rendered left
          width from the solver's `sidebar`, so the sum would drift. */}
      {cols.right > 0 && (
        <DragHandle side="right" left={viewport - cols.right} onStart={onRightStart} onDrag={onRightDrag} onEnd={onDragEnd} />
      )}
    </div>
  )
}
