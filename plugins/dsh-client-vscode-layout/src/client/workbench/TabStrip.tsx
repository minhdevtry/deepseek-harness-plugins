/**
 * The open-tab strip: selection, dirty marks, drag reordering, and the
 * per-tab context menu.
 *
 * All list arithmetic lives in `model/tabs.ts`; this component turns gestures
 * into those calls. Memoised because the caret moves on every keystroke and
 * the strip has no reason to re-render when it does.
 */
import { memo, useState } from 'react'
import { ContextMenu, type MenuItem } from '../ui/ContextMenu.tsx'
import { FileIcon } from '../explorer/FileIcon.tsx'
import { fileIconId } from '../explorer/icons/index.ts'
import css from './TabStrip.module.css'

/** Which tab the context menu is open on. */
type MenuState = { x: number; y: number; path: string }

/** Tab strip props. */
export interface TabStripProps {
  tabs: readonly string[]
  active: string | undefined
  /** Paths with unsaved edits. */
  dirty: ReadonlySet<string>
  onSelect: (path: string) => void
  onClose: (path: string) => void
  onCloseOthers: (path: string) => void
  onCloseToLeft: (path: string) => void
  onCloseToRight: (path: string) => void
  onCloseAll: () => void
  onMove: (from: number, to: number) => void
  onCopyPath: (path: string) => void
}

/** Last path segment. */
function baseName(path: string): string {
  return path.split('/').pop() ?? path
}

/** The open-tab strip (see module doc). */
export const TabStrip = memo(function TabStrip({
  tabs, active, dirty, onSelect, onClose, onCloseOthers,
  onCloseToLeft, onCloseToRight, onCloseAll, onMove, onCopyPath,
}: TabStripProps) {
  const [menu, setMenu] = useState<MenuState | undefined>(undefined)
  const [dragFrom, setDragFrom] = useState<number | undefined>(undefined)
  const [dropTo, setDropTo] = useState<number | undefined>(undefined)

  // Two tabs can share a base name (`src/index.ts`, `lib/index.ts`); the ones
  // that do show enough of their parent directory to tell them apart.
  const ambiguous = new Set<string>()
  const seen = new Set<string>()
  for (const path of tabs) {
    const name = baseName(path)
    if (seen.has(name)) ambiguous.add(name)
    seen.add(name)
  }

  const items = (path: string): MenuItem[] => [
    { kind: 'item', label: 'Close', hint: 'Ctrl+W', onSelect: () => { onClose(path) } },
    { kind: 'item', label: 'Close Others', onSelect: () => { onCloseOthers(path) } },
    { kind: 'item', label: 'Close to the Left', onSelect: () => { onCloseToLeft(path) } },
    { kind: 'item', label: 'Close to the Right', onSelect: () => { onCloseToRight(path) } },
    { kind: 'item', label: 'Close All', onSelect: onCloseAll },
    { kind: 'separator' },
    { kind: 'item', label: 'Copy Path', onSelect: () => { onCopyPath(path) } },
  ]

  return (
    <div className={css.strip} role="tablist" aria-label="Open editors">
      {tabs.map((path, index) => {
        const name = baseName(path)
        const parent = ambiguous.has(name) ? path.split('/').slice(-2, -1)[0] : undefined
        return (
          <div
            key={path}
            role="tab"
            aria-selected={path === active}
            className={css.tab}
            data-active={path === active || undefined}
            data-dirty={dirty.has(path) || undefined}
            data-drop={dropTo === index && dragFrom !== index || undefined}
            title={path}
            draggable
            onClick={() => { onSelect(path) }}
            onAuxClick={(event) => {
              // Middle click closes, as in every browser and VS Code.
              if (event.button === 1) { event.preventDefault(); onClose(path) }
            }}
            onContextMenu={(event) => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY, path }) }}
            onDragStart={(event) => {
              setDragFrom(index)
              event.dataTransfer.effectAllowed = 'move'
              // Firefox ignores a drag that carries no payload.
              event.dataTransfer.setData('text/plain', path)
            }}
            onDragOver={(event) => {
              if (dragFrom === undefined) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              setDropTo(index)
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (dragFrom !== undefined && dragFrom !== index) onMove(dragFrom, index)
              setDragFrom(undefined)
              setDropTo(undefined)
            }}
            onDragEnd={() => { setDragFrom(undefined); setDropTo(undefined) }}
          >
            <FileIcon symbolId={fileIconId(name)} />
            <span className={css.name}>{name}</span>
            {parent !== undefined && <span className={css.parent}>{parent}</span>}
            <button
              type="button"
              className={css.close}
              aria-label={`Close ${name}`}
              onClick={(event) => { event.stopPropagation(); onClose(path) }}
            >
              {/* The dot replaces the ✕ until hover, so an unsaved tab reads as
                  unsaved without costing it its close button. */}
              <span className={css.dot} aria-hidden />
              <span className={css.cross} aria-hidden>✕</span>
            </button>
          </div>
        )
      })}

      {menu !== undefined && (
        <ContextMenu x={menu.x} y={menu.y} items={items(menu.path)} onClose={() => { setMenu(undefined) }} />
      )}
    </div>
  )
})
