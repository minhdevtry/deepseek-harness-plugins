import { useEffect, useRef, useState, useMemo } from 'react'
import type { Editor } from '@tiptap/core'
import css from './TableOfContents.module.css'

export interface HeadingEntry {
  id: string
  level: number
  text: string
  pos: number
}

export interface TableOfContentsProps {
  editor: Editor
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}

const MIN_WIDTH = 200
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 250

// Inline SVG Icons
const IconPin = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
  </svg>
)

const IconChevronsUp = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 11 12 6 7 11" />
    <polyline points="17 18 12 13 7 18" />
  </svg>
)

const IconChevronsDown = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="7 13 12 18 17 13" />
    <polyline points="7 6 12 11 17 6" />
  </svg>
)

const IconChevronRight = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

const IconChevronDown = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const IconX = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const IconToc = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="7" y1="12" x2="21" y2="12" />
    <line x1="11" y1="18" x2="21" y2="18" />
  </svg>
)

/** Find the heading DOM element by pos in the TipTap editor */
function findHeadingElement(editor: Editor, pos: number): HTMLElement | null {
  try {
    if (!editor || editor.isDestroyed) return null
    const dom = editor.view?.nodeDOM(pos) as HTMLElement | null
    if (dom && dom.matches && dom.matches('h1,h2,h3,h4,h5,h6')) return dom
    const { node } = editor.view.domAtPos(pos + 1)
    let el: HTMLElement | null =
      node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)
    const rootDom = editor.view.dom
    while (el && !el.matches('h1,h2,h3,h4,h5,h6') && el !== rootDom) {
      el = el.parentElement
    }
    return el && el.matches('h1,h2,h3,h4,h5,h6') ? el : null
  } catch {
    return null
  }
}

export function TableOfContents({ editor, isOpen, onOpen, onClose }: TableOfContentsProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const tocListRef = useRef<HTMLDivElement | null>(null)
  const isProgrammaticScroll = useRef<boolean>(false)
  const isUserWheelingToc = useRef<boolean>(false)
  const lastWheelTimeRef = useRef<number>(0)
  const tocWheelTimeoutRef = useRef<any>(null)

  const [headings, setHeadings] = useState<HeadingEntry[]>([])
  const [activePos, setActivePos] = useState<number | null>(null)
  const [collapsedPos, setCollapsedPos] = useState<Set<number>>(new Set())
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dsh_toc_pinned') === 'true'
    } catch {
      return false
    }
  })
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('dsh_toc_width')
      return saved ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(saved))) : DEFAULT_WIDTH
    } catch {
      return DEFAULT_WIDTH
    }
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(panelWidth)

  // Clean up wheel timer on unmount
  useEffect(() => () => {
    if (tocWheelTimeoutRef.current) clearTimeout(tocWheelTimeoutRef.current)
  }, [])

  // Parse Headings from Document AST
  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const updateHeadings = () => {
      if (!editor || editor.isDestroyed) return
      const list: HeadingEntry[] = []
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = (node.attrs.level as number) || 1
          const text = node.textContent.trim()
          if (text.length > 0) {
            list.push({
              id: `toc-h-${pos}`,
              level,
              text,
              pos,
            })
          }
        }
      })
      setHeadings(list)
    }

    updateHeadings()
    editor.on('update', updateHeadings)
    return () => {
      editor.off('update', updateHeadings)
    }
  }, [editor])

  // Direction A (Document Canvas -> TOC ScrollSpy):
  // When scrolling the document, highlight active heading and keep it visible in TOC
  useEffect(() => {
    let canvas: HTMLElement | null = null
    try {
      if (editor && !editor.isDestroyed && editor.view && editor.view.dom) {
        canvas = editor.view.dom.closest('[class*="canvas"]') as HTMLElement | null
      }
    } catch {
      return
    }
    if (!canvas || headings.length === 0) return

    let rafId: number | null = null

    const handleScroll = () => {
      if (isProgrammaticScroll.current || isUserWheelingToc.current) return
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const canvasRect = canvas.getBoundingClientRect()
        let currentActive: number | null = null

        for (let i = 0; i < headings.length; i++) {
          const h = headings[i]
          if (!h) continue
          const el = findHeadingElement(editor, h.pos)
          if (!el) continue
          const elRect = el.getBoundingClientRect()
          const relativeTop = elRect.top - canvasRect.top

          if (relativeTop <= 80) {
            currentActive = h.pos
          } else {
            break
          }
        }

        const targetPos = currentActive ?? (headings[0] ? headings[0].pos : null)
        setActivePos((prev) => {
          if (targetPos !== null && targetPos !== prev) {
            if (tocListRef.current && !isUserWheelingToc.current) {
              const itemEl = tocListRef.current.querySelector<HTMLElement>(`[data-toc-pos="${targetPos}"]`)
              if (itemEl) {
                itemEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
              }
            }
            return targetPos
          }
          return prev
        })
      })
    }

    canvas.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      canvas.removeEventListener('scroll', handleScroll)
    }
  }, [editor, headings])

  // Direction B (TOC Wheel Scrub -> Document Navigation):
  // When rolling mouse wheel inside TOC, advance active heading and scroll document in sync
  const handleTocWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const now = Date.now()
    if (now - lastWheelTimeRef.current < 110) return
    lastWheelTimeRef.current = now

    isUserWheelingToc.current = true
    isProgrammaticScroll.current = true
    if (tocWheelTimeoutRef.current) clearTimeout(tocWheelTimeoutRef.current)

    const currentIndex = headings.findIndex(h => h.pos === activePos)
    const direction = e.deltaY > 0 ? 1 : -1
    const nextIndex = Math.max(0, Math.min(headings.length - 1, (currentIndex === -1 ? 0 : currentIndex) + direction))
    const targetHeading = headings[nextIndex]

    if (targetHeading && targetHeading.pos !== activePos) {
      setActivePos(targetHeading.pos)
      scrollToHeading(targetHeading, { moveCaret: false })

      if (tocListRef.current) {
        const itemEl = tocListRef.current.querySelector<HTMLElement>(`[data-toc-pos="${targetHeading.pos}"]`)
        if (itemEl) {
          itemEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
      }
    }

    tocWheelTimeoutRef.current = setTimeout(() => {
      isUserWheelingToc.current = false
      isProgrammaticScroll.current = false
    }, 600)
  }

  // Keyboard listener: Escape always closes panel (even when pinned)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Outside click listener: close when unpinned and clicked outside
  useEffect(() => {
    if (!isOpen || isPinned) return

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (panelRef.current && !panelRef.current.contains(target)) {
        const isToggleBtn = target.closest?.('[title*="Outline"]') || target.closest?.(`.${css.pillBtn}`)
        if (!isToggleBtn) {
          onClose()
        }
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick)
    }, 60)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen, isPinned, onClose])

  // Drag-to-resize listener
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = dragStartX.current - e.clientX
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidth.current + delta))
      setPanelWidth(newWidth)
      localStorage.setItem('dsh_toc_width', String(newWidth))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const startDragResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragStartX.current = e.clientX
    dragStartWidth.current = panelWidth
    setIsDragging(true)
  }

  // Scroll to heading position smoothly to TOP of canvas
  const scrollToHeading = (
    entry: HeadingEntry,
    options: { moveCaret?: boolean } = {},
  ) => {
    const { moveCaret = true } = options
    setActivePos(entry.pos)
    isProgrammaticScroll.current = true

    const el = findHeadingElement(editor, entry.pos)
    if (el) {
      const canvas = el.closest('[class*="canvas"]') as HTMLElement | null
      if (canvas) {
        const canvasRect = canvas.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        const targetScrollTop = canvas.scrollTop + (elRect.top - canvasRect.top) - 16
        canvas.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' })
      } else {
        const topbar = document.querySelector('[class*="topBar"]') as HTMLElement | null
        const topbarH = topbar?.getBoundingClientRect().height ?? 38
        const top = el.getBoundingClientRect().top + window.scrollY - topbarH - 16
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      }
      if (moveCaret) {
        try {
          editor.commands.setTextSelection(entry.pos + 1)
        } catch {
          // ignore
        }
      }
    } else if (moveCaret) {
      editor.chain().focus().setTextSelection(entry.pos + 1).run()
    }

    setTimeout(() => {
      isProgrammaticScroll.current = false
    }, 600)
  }

  // Toggle Collapse on a single heading node
  const toggleCollapse = (pos: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setCollapsedPos((prev) => {
      const next = new Set(prev)
      if (next.has(pos)) {
        next.delete(pos)
      } else {
        next.add(pos)
      }
      return next
    })
  }

  // Collapse All / Expand All
  const hasSubheadings = headings.some((h, i) => {
    const next = headings[i + 1]
    return next ? next.level > h.level : false
  })
  const isAnyExpanded = headings.some((h, i) => {
    const next = headings[i + 1]
    return next ? next.level > h.level && !collapsedPos.has(h.pos) : false
  })

  const handleToggleAll = () => {
    if (isAnyExpanded) {
      const allParentPos = new Set<number>()
      headings.forEach((h, i) => {
        const next = headings[i + 1]
        if (next && next.level > h.level) {
          allParentPos.add(h.pos)
        }
      })
      setCollapsedPos(allParentPos)
    } else {
      setCollapsedPos(new Set())
    }
  }

  // Visibility check based on ancestor collapsed state
  const isVisible = (idx: number): boolean => {
    const target = headings[idx]
    if (!target) return true
    let ancestorLevel = target.level
    for (let i = idx - 1; i >= 0; i--) {
      const current = headings[i]
      if (current && current.level < ancestorLevel) {
        if (collapsedPos.has(current.pos)) return false
        ancestorLevel = current.level
      }
    }
    return true
  }

  // Calculate Document Stats
  const stats = useMemo(() => {
    const fullText = editor.state.doc.textContent || ''
    const words = fullText.trim() ? fullText.trim().split(/\s+/).length : 0
    const chars = fullText.length
    const readTimeMinutes = Math.max(1, Math.ceil(words / 200))
    return { words, chars, readTimeMinutes }
  }, [editor.state.doc])

  const filteredHeadings = headings.filter((h) => {
    if (!searchQuery.trim()) return true
    return h.text.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleClose = () => {
    setIsPinned(false)
    onClose()
  }

  return (
    <>
      {/* Floating Designer Capsule Pill Button (When panel is closed) */}
      {!isOpen && (
        <button
          type="button"
          className={css.pillBtn}
          onClick={onOpen}
          title="Open Table of Contents (Outline)"
        >
          {IconToc}
          <div className={css.pillGrip} />
        </button>
      )}

      {/* Main TOC Panel (Floating Slide-out Drawer) */}
      {isOpen && (
        <div
          ref={panelRef}
          className={`${css.tocPanel} ${css.tocPanelOpen}`}
          style={{ width: `${panelWidth}px` }}
        >
          {/* Left resize handle */}
          <div
            className={css.resizeHandle}
            onMouseDown={startDragResize}
            title="Drag to resize Table of Contents"
          />

          {/* Header */}
          <div className={css.tocHeader}>
            <div className={css.tocHeaderTitle}>
              <span>Table of Contents</span>
              {headings.length > 0 && (
                <span className={css.headingCountBadge}>{headings.length}</span>
              )}
            </div>

            {hasSubheadings && (
              <button
                type="button"
                className={css.tocHeaderBtn}
                onClick={handleToggleAll}
                title={isAnyExpanded ? 'Collapse all' : 'Expand all'}
              >
                {isAnyExpanded ? IconChevronsUp : IconChevronsDown}
              </button>
            )}

            {/* Pin Button */}
            <button
              type="button"
              className={`${css.tocHeaderBtn} ${isPinned ? css.tocHeaderBtnActive : ''}`}
              onClick={() => {
                setIsPinned(p => {
                  const next = !p
                  try { localStorage.setItem('dsh_toc_pinned', String(next)) } catch {}
                  return next
                })
              }}
              title={isPinned ? 'Unpin Table of Contents (Click outside to close)' : 'Pin Table of Contents (Keep open)'}
            >
              {IconPin}
            </button>

            <button
              type="button"
              className={css.tocHeaderBtn}
              onClick={handleClose}
              title="Close panel (Esc)"
            >
              {IconX}
            </button>
          </div>

          {/* Search Input */}
          {headings.length > 5 && (
            <div className={css.searchBox}>
              <input
                type="text"
                className={css.searchInput}
                placeholder="Search headings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {/* Headings List with Two-Way Wheel Navigation */}
          <div
            ref={tocListRef}
            className={css.tocList}
            onWheel={handleTocWheel}
          >
            {filteredHeadings.length === 0 ? (
              <div className={css.tocEmpty}>
                {searchQuery ? 'No matching headings' : 'No headings'}
              </div>
            ) : (
              filteredHeadings.map((item, idx) => {
                if (!searchQuery && !isVisible(idx)) return null

                const nextHeading = headings[idx + 1]
                const hasKids = Boolean(nextHeading && nextHeading.level > item.level)
                const isFolded = collapsedPos.has(item.pos)
                const isActive = activePos === item.pos

                const levelClass =
                  item.level === 1
                    ? css.tocItemH1
                    : item.level === 2
                      ? css.tocItemH2
                      : css.tocItemH3

                return (
                  <div
                    key={item.id}
                    data-toc-pos={item.pos}
                    className={`${css.tocItem} ${levelClass} ${isActive ? css.tocItemActive : ''}`}
                    style={{ paddingLeft: `${Math.max(0, (item.level - 1) * 12 + 8)}px` }}
                  >
                    {hasKids ? (
                      <button
                        type="button"
                        className={css.collapseToggle}
                        onClick={(e) => toggleCollapse(item.pos, e)}
                        title={isFolded ? 'Expand' : 'Collapse'}
                      >
                        {isFolded ? IconChevronRight : IconChevronDown}
                      </button>
                    ) : (
                      <span className={css.collapsePlaceholder}>–</span>
                    )}

                    <button
                      type="button"
                      className={css.itemLabel}
                      onClick={() => scrollToHeading(item)}
                      title={item.text}
                    >
                      {item.text}
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer with Reading Time & Stats */}
          <div className={css.tocFooter}>
            <span>{stats.words.toLocaleString()} words</span>
            <span>~{stats.readTimeMinutes} min read</span>
          </div>
        </div>
      )}
    </>
  )
}
