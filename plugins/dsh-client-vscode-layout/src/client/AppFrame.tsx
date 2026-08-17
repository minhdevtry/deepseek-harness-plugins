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
import { computeColumns, SIDEBAR_AUTO_COLLAPSE, SIDEBAR_DEFAULT } from './columns.ts'
import type { createLayoutStore } from './stores.ts'
import type { FrameInjected } from './contract/slots.ts'
import { DragHandle } from './DragHandle.tsx'
import { RightColumn } from './RightColumn.tsx'
import { ExplorerPanel } from './explorer/ExplorerPanel.tsx'
import { Workbench } from './workbench/Workbench.tsx'
import { QuickOpen } from './ui/QuickOpen.tsx'
import { CommandPalette, type CommandItem } from './ui/CommandPalette.tsx'
import { InlineAI } from './ui/InlineAI.tsx'
import { Toast, type ToastItem, type ToastType } from './ui/Toast.tsx'
import { getLineRangeForSelection, insertMentionIntoChat } from './utils/chatComposer.ts'
import css from './AppFrame.module.css'

/** Full composed props: runtime share + child-slot render share + store share + injected face. */
export type AppFrameProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<'sidebar' | 'conversation' | 'details' | 'shell.overlay'>
  & PropsStore<ReturnType<typeof createLayoutStore>>
  & FrameInjected

/** The three-column workbench frame (see module doc). */
export function AppFrame({
  useStore, useSessions, actions, renderSlot, askAI, notify,
  openWorkspace, pickDirectory, listWorkspaces,
}: AppFrameProps) {
  const panels = useStore(s => s)
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
  const [viewport, setViewport] = useState(() => window.innerWidth)

  // Track the frame's own box (not the window): rAF-throttled ResizeObserver.
  useEffect(() => {
    const el = frameRef.current
    if (el === null) return
    let raf: number | null = null
    const observer = new ResizeObserver(() => {
      raf ??= requestAnimationFrame(() => {
        raf = null
        const width = el.getBoundingClientRect().width
        if (width > 0) setViewport(width)
      })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [])

  // Narrow viewports auto-collapse the sidebar; the store mirror keeps
  // toggleSidebar's semantics right (narrow toggles flip the manual re-expand
  // override, stores.ts). Collapsed is decided here so the solver stays
  // breakpoint-free.
  const narrow = viewport < SIDEBAR_AUTO_COLLAPSE
  useEffect(() => { actions.setNarrow(narrow) }, [actions, narrow])

  const sidebarCollapsed = narrow ? !panels.narrowExpanded : panels.sidebar === 0
  const sidebarPreference = sidebarCollapsed
    ? 0
    : panels.sidebar === 0 ? SIDEBAR_DEFAULT : panels.sidebar
  const cols = computeColumns(viewport, sidebarPreference, panels.right)
  const colsRef = useRef(cols)
  colsRef.current = cols

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

  // Modals and Overlays
  const [quickOpen, setQuickOpen] = useState(false)
  const [cmdPalette, setCmdPalette] = useState(false)
  const [inlineAIOpen, setInlineAIOpen] = useState(false)
  const [inlineSelection, setInlineSelection] = useState('')

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const mod = isMac ? e.metaKey : e.ctrlKey

      if (mod && e.key.toLowerCase() === 'p' && !e.shiftKey) {
        e.preventDefault()
        setQuickOpen(prev => !prev)
      } else if ((mod && e.key.toLowerCase() === 'p' && e.shiftKey) || e.key === 'F1') {
        e.preventDefault()
        setCmdPalette(prev => !prev)
      } else if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const sel = window.getSelection()?.toString() || ''
        setInlineSelection(sel.slice(0, 500))
        setInlineAIOpen(prev => !prev)
      } else if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        actions.toggleSidebar()
      } else if (mod && e.key.toLowerCase() === 'l' && !e.shiftKey) {
        e.preventDefault()
        if (panels.activePath) {
          actions.openRight()
          actions.setRightTab('chat')
          const filename = panels.activePath.split('/').pop() || panels.activePath
          const activeSel = (window as any).__dsh_active_selection
          let lineTag = ''
          if (activeSel && activeSel.path === panels.activePath && activeSel.rangeString) {
            lineTag = ` ${activeSel.rangeString}`
          } else {
            const sel = window.getSelection()?.toString() || ''
            if (sel.trim().length > 0) {
              const docText = (window as any).__dsh_get_active_text?.(panels.activePath) || ''
              if (docText) {
                const { rangeString } = getLineRangeForSelection(docText, sel)
                if (rangeString) lineTag = ` ${rangeString}`
              }
            }
          }
          const mention = `@${filename}${lineTag}`
          insertMentionIntoChat(mention)
        } else {
          if (colsRef.current.right === 0) {
            actions.openRight()
            actions.setRightTab('chat')
          } else {
            actions.closeRight()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown) }
  }, [actions, askAI, handleNotify, panels.activeLine, panels.activePath])

  // Commands for Command Palette
  const commands: CommandItem[] = useMemo(() => [
    {
      id: 'workbench.action.quickOpen',
      title: 'Go to File...',
      category: 'File',
      shortcut: 'Ctrl+P',
      action: () => { setQuickOpen(true) },
    },
    {
      id: 'workbench.action.toggleSidebar',
      title: 'Toggle Primary Sidebar',
      category: 'View',
      shortcut: 'Ctrl+B',
      action: () => { actions.toggleSidebar() },
    },
    {
      id: 'workbench.action.toggleRightPanel',
      title: 'Toggle AI Chat Panel',
      category: 'View',
      shortcut: 'Ctrl+L',
      action: () => {
        if (cols.right === 0) actions.openRight()
        else actions.closeRight()
      },
    },
    {
      id: 'workbench.action.inlineAI',
      title: 'Inline AI Assist',
      category: 'AI',
      shortcut: 'Ctrl+K',
      action: () => {
        const sel = window.getSelection()?.toString() || ''
        setInlineSelection(sel.slice(0, 500))
        setInlineAIOpen(true)
      },
    },
    {
      id: 'workbench.action.toggleAutoSave',
      title: 'Toggle Auto-Save',
      category: 'Settings',
      action: () => {
        actions.toggleAutoSave()
        handleNotify(`Auto-Save ${!panels.autoSave ? 'Enabled' : 'Disabled'}`, 'info')
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
          const filename = panels.activePath.split('/').pop() || panels.activePath
          const mention = `@${filename}`
          insertMentionIntoChat(mention)
        } else {
          handleNotify('No active file open', 'warning')
        }
      },
    },
  ], [actions, askAI, cols.right, handleNotify, panels.activePath, panels.autoSave])

  const handleInlineAISubmit = useCallback((prompt: string, contextSnippet?: string) => {
    actions.openRight()
    actions.setRightTab('chat')
    const filename = panels.activePath ? (panels.activePath.split('/').pop() || panels.activePath) : ''
    let mentionTag = filename ? `@${filename}` : ''
    if (filename && contextSnippet && contextSnippet.trim().length > 0) {
      const docText = (window as any).__dsh_get_active_text?.(panels.activePath!) || ''
      if (docText) {
        const { rangeString } = getLineRangeForSelection(docText, contextSnippet)
        if (rangeString) mentionTag = `@${filename} ${rangeString}`
      }
    }
    const fullMention = mentionTag ? `${mentionTag} ${prompt}` : prompt
    insertMentionIntoChat(fullMention)
  }, [actions, panels.activePath])

  return (
    <div
      ref={frameRef}
      className={css.frame}
      style={{ gridTemplateColumns: `${cols.sidebar}px minmax(0, 1fr) ${cols.right}px` }}
      data-sidebar-collapsed={sidebarCollapsed || undefined}
      data-right-collapsed={cols.right === 0 || undefined}
      data-dragging={dragging || undefined}
    >
      <div className={css.sidebarCol}>
        {/* The explorer column. The stock session-list slot renders inside it
            as one tab — re-placing that hole is the whole reason this package
            occupies 'root' (contract/slots.ts). */}
        <ExplorerPanel
          collapsed={sidebarCollapsed}
          activePath={panels.activePath}
          onOpenFile={actions.openFile}
          onAskAI={askAI}
          root={panels.explorerRoot}
          workspaceRoot={panels.workspaceRoot}
          onRootChange={actions.setExplorerRoot}
          onWorkspaceRootResolved={actions.setWorkspaceRoot}
          openWorkspace={openWorkspace}
          pickDirectory={pickDirectory}
          listWorkspaces={listWorkspaces}
          onNotify={handleNotify}
          onToggleCollapse={actions.toggleSidebar}
          sessions={renderSlot('sidebar', { collapsed: sidebarCollapsed, width: cols.sidebar })}
        />
      </div>

      {sidebarCollapsed && (
        <button
          type="button"
          className={css.sidebarRestoreBtn}
          onClick={actions.toggleSidebar}
          title="Restore Explorer (Ctrl+B)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
            <path d="m14 9 3 3-3 3" />
          </svg>
        </button>
      )}

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
          filePath={panels.activePath}
          onClose={() => { setInlineAIOpen(false) }}
          onSubmit={handleInlineAISubmit}
        />
        <Toast toasts={toasts} onDismiss={handleDismissToast} />
      </div>

      {/* A closed column has no edge to grab. */}
      {!sidebarCollapsed && (
        <DragHandle side="sidebar" left={cols.sidebar} onStart={onSidebarStart} onDrag={onSidebarDrag} onEnd={onDragEnd} />
      )}
      {cols.right > 0 && (
        <DragHandle side="right" left={cols.sidebar + cols.center} onStart={onRightStart} onDrag={onRightDrag} onEnd={onDragEnd} />
      )}
    </div>
  )
}
