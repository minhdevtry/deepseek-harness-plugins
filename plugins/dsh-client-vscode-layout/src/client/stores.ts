/**
 * The root entry's layout store: panel geometry as plain widths in px
 * (0 = closed), plus the narrow-viewport pair.
 *
 * Module level exports the factory only — a module-level handle would pin the
 * store identity in the module cache (a de-facto singleton surviving plugin
 * reloads). register() receives the factory, AppFrame derives its PropsStore
 * share from the return type, and the service face receives the bound actions
 * through the registration's inject hook.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import {
  clampWidth, RIGHT_DEFAULT, RIGHT_MIN, SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, rightMax,
} from './columns.ts'

/** Which surface the right column currently shows. */
export type RightTab = 'chat' | 'details'

/**
 * Layout store state: panel width preferences in px (0 = closed).
 *
 * `narrow` mirrors AppFrame's breakpoint reading (viewport < SIDEBAR_AUTO_COLLAPSE)
 * so toggleSidebar can pick its semantics, and `narrowExpanded` is the manual
 * override that re-expands the auto-collapsed sidebar over the squeezed editor
 * without rewriting the width preference.
 */
export type LayoutState = {
  sidebar: number
  right: number
  rightTab: RightTab
  narrow: boolean
  narrowExpanded: boolean
  /**
   * The explorer ⟷ editor seam: which file the workbench is showing.
   *
   * It lives here rather than inside either column because both read it — the
   * explorer highlights the row, the editor renders the content — and it must
   * survive a column remount. The editor milestone extends this into a tab
   * list; `activeLine` carries a search hit's target line along with the path.
   */
  activePath: string | undefined
  activeLine: number | undefined
  /** Open editors, in rendered (drag-reordered) order. */
  tabs: string[]
  /** Persist edits automatically after a short idle. */
  autoSave: boolean
  /**
   * The directory the explorer is showing. Shared because the breadcrumb
   * navigates it from the centre column, and the tree renders it in the left
   * one — neither owns it alone.
   */
  explorerRoot: string | undefined
  /** The sandbox boundary; the target of "reset to workspace folder". */
  workspaceRoot: string | undefined
}

/**
 * Annotation twin of the actions literal below (the export needs a declared
 * return type); drift fails assignability at the defineStore call.
 */
type LayoutActions = {
  setSidebar: (draft: LayoutState, px: number) => void
  setRight: (draft: LayoutState, px: number, viewport: number) => void
  toggleSidebar: (draft: LayoutState) => void
  openSidebar: (draft: LayoutState) => void
  setNarrow: (draft: LayoutState, narrow: boolean) => void
  openRight: (draft: LayoutState) => void
  closeRight: (draft: LayoutState) => void
  toggleRight: (draft: LayoutState) => void
  setRightTab: (draft: LayoutState, tab: RightTab) => void
  openFile: (draft: LayoutState, path: string, line?: number) => void
  setTabs: (draft: LayoutState, tabs: string[], active: string | undefined) => void
  moveTab: (draft: LayoutState, from: number, to: number) => void
  toggleAutoSave: (draft: LayoutState) => void
  setExplorerRoot: (draft: LayoutState, path: string) => void
  setWorkspaceRoot: (draft: LayoutState, path: string) => void
}

/**
 * Create the layout panel store handle.
 *
 * The preference IS the width, so closing a panel forgets its drag width and
 * reopening restores the contract default. Actions are the complete write set:
 * drag writes clamp into the panel's contract range and never cross the
 * open/closed line, while open/close transitions write 0 / the default
 * explicitly. Below the auto-collapse breakpoint (AppFrame feeds setNarrow)
 * the sidebar toggle flips the narrowExpanded override instead of the
 * preference.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createLayoutStore(): EngineStoreHandle<LayoutState, LayoutActions> {
  return defineStore({
    init: (): LayoutState => {
      let initialRight = RIGHT_DEFAULT
      let initialSidebar = SIDEBAR_DEFAULT
      if (typeof window !== 'undefined') {
        try {
          const rVal = localStorage.getItem('dsh_vscode_right_width')
          if (rVal) {
            const parsed = parseInt(rVal, 10)
            if (!isNaN(parsed) && parsed >= RIGHT_MIN) initialRight = parsed
          }
          const sVal = localStorage.getItem('dsh_vscode_sidebar_width')
          if (sVal) {
            const parsed = parseInt(sVal, 10)
            if (!isNaN(parsed) && parsed >= SIDEBAR_MIN) initialSidebar = parsed
          }
        } catch {}
      }
      return {
        sidebar: initialSidebar,
        right: initialRight,
        rightTab: 'chat',
        narrow: false,
        narrowExpanded: false,
        activePath: undefined,
        activeLine: undefined,
        tabs: [],
        autoSave: false,
        explorerRoot: undefined,
        workspaceRoot: undefined,
      }
    },
    actions: {
      setSidebar: (d, px: number) => {
        if (px < 80) {
          d.sidebar = 0
          return
        }
        const clamped = clampWidth(px, SIDEBAR_MIN, SIDEBAR_MAX)
        d.sidebar = clamped
        if (typeof window !== 'undefined' && clamped > 0) {
          try { localStorage.setItem('dsh_vscode_sidebar_width', String(clamped)) } catch {}
        }
      },
      // The right column's ceiling is viewport-derived (see columns.rightMax),
      // so the drag write needs the frame width the gesture happened in.
      setRight: (d, px: number, viewport: number) => {
        const clamped = clampWidth(px, RIGHT_MIN, rightMax(viewport))
        d.right = clamped
        if (typeof window !== 'undefined' && clamped > 0) {
          try { localStorage.setItem('dsh_vscode_right_width', String(clamped)) } catch {}
        }
      },
      // Narrow toggles flip only the override: the width preference survives
      // untouched, so re-widening restores the pre-squeeze layout.
      toggleSidebar: (d) => {
        if (d.narrow) {
          d.narrowExpanded = !d.narrowExpanded
        } else {
          if (d.sidebar === 0) {
            let saved = SIDEBAR_DEFAULT
            if (typeof window !== 'undefined') {
              try {
                const val = localStorage.getItem('dsh_vscode_sidebar_width')
                if (val) {
                  const parsed = parseInt(val, 10)
                  if (!isNaN(parsed) && parsed >= SIDEBAR_MIN) saved = parsed
                }
              } catch {}
            }
            d.sidebar = saved
          } else {
            d.sidebar = 0
          }
        }
      },
      // Reveal without toggling. The host's sidebar asks for this when one of
      // its rail icons wants room (ui-sidebar's expandSidebar), where a plain
      // toggle would close an already-open column instead.
      openSidebar: (d) => {
        if (d.narrow) {
          d.narrowExpanded = true
          return
        }
        if (d.sidebar !== 0) return
        let saved = SIDEBAR_DEFAULT
        if (typeof window !== 'undefined') {
          try {
            const val = localStorage.getItem('dsh_vscode_sidebar_width')
            if (val) {
              const parsed = parseInt(val, 10)
              if (!isNaN(parsed) && parsed >= SIDEBAR_MIN) saved = parsed
            }
          } catch {}
        }
        d.sidebar = saved
      },
      // Crossing the breakpoint in either direction drops the override: the
      // narrow default is auto-collapsed, the wide state is the preference.
      setNarrow: (d, narrow: boolean) => {
        if (d.narrow === narrow) return
        d.narrow = narrow
        d.narrowExpanded = false
      },
      openRight: (d) => {
        if (d.right === 0) {
          let saved = RIGHT_DEFAULT
          if (typeof window !== 'undefined') {
            try {
              const val = localStorage.getItem('dsh_vscode_right_width')
              if (val) {
                const parsed = parseInt(val, 10)
                if (!isNaN(parsed) && parsed >= RIGHT_MIN) saved = parsed
              }
            } catch {}
          }
          d.right = saved
        }
      },
      closeRight: (d) => { d.right = 0 },
      toggleRight: (d) => {
        if (d.right === 0) {
          let saved = RIGHT_DEFAULT
          if (typeof window !== 'undefined') {
            try {
              const val = localStorage.getItem('dsh_vscode_right_width')
              if (val) {
                const parsed = parseInt(val, 10)
                if (!isNaN(parsed) && parsed >= RIGHT_MIN) saved = parsed
              }
            } catch {}
          }
          d.right = saved
        } else {
          d.right = 0
        }
      },
      setRightTab: (d, tab: RightTab) => { d.rightTab = tab },
      // Reopening the same file at no particular line must not keep an old
      // search hit's line, so the line is always written — cleared or set.
      openFile: (d, path: string, line?: number) => {
        // Reopening must not reorder the strip under the operator's cursor.
        if (!d.tabs.includes(path)) d.tabs.push(path)
        d.activePath = path
        d.activeLine = line
      },
      // The list arithmetic lives in model/tabs.ts; the store just adopts the
      // result, so closing rules stay assertable without a store.
      setTabs: (d, tabs: string[], active: string | undefined) => { d.tabs = tabs; d.activePath = active; d.activeLine = undefined },
      moveTab: (d, from: number, to: number) => {
        const [moved] = d.tabs.splice(from, 1)
        if (moved === undefined) return
        d.tabs.splice(Math.min(Math.max(to, 0), d.tabs.length), 0, moved)
      },
      toggleAutoSave: (d) => { d.autoSave = !d.autoSave },
      setExplorerRoot: (d, path: string) => { d.explorerRoot = path },
      setWorkspaceRoot: (d, path: string) => { d.workspaceRoot = path },
    },
  })
}
