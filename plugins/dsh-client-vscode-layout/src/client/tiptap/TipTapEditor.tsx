/**
 * TipTap Notion WYSIWYG editor host — a *view*, not an owner.
 *
 * Full-featured Notion suite: slash menu, bubble menu, interactive table
 * toolbar, callouts, task lists, code blocks with 1-click copy, media modals,
 * and TOC outline.
 *
 * The document itself belongs to `tiptap/documents.ts`. This component borrows
 * it: attach on mount, detach on unmount, never construct and never destroy.
 * That is what makes the undo history survive a tab switch — it used to build
 * its own `Editor` in an effect keyed on the path, so every switch destroyed
 * the ProseMirror state and every edit you had made became unreachable.
 *
 * Nothing here serialises markdown. The registry projects it at save time.
 */
import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import type { DocumentRegistry } from './documents.ts'
import { SlashMenu } from './SlashMenu.tsx'
import { BubbleMenu } from './BubbleMenu.tsx'
import { LinkBubble } from './LinkBubble.tsx'
import { DocLinkMenu, type DocLinkState } from './DocLinkMenu.tsx'
import { TableControls } from './TableControls.tsx'
import { MediaModal, type MediaModalType } from './MediaModal.tsx'
import { TableOfContents } from './toc/TableOfContents.tsx'
import { FindBar } from './findBar/FindBar.tsx'
import { FrontmatterWidget } from './frontmatter/FrontmatterWidget.tsx'
import { DragHandleMenu } from './dragHandle/DragHandleMenu.tsx'
import { InlineAIPopover } from './ai/InlineAIPopover.tsx'
import type { AIState } from './ai/types.ts'
import { useEditorSnapshot } from './useEditorSnapshot.ts'
import { Button, IconButton, Tooltip } from '../ui/primitives/index.ts'
import { resolveRelativePath } from '../utils/path.ts'
import { openInWorkbench } from '../fileOpener.ts'
import css from './TipTapEditor.module.css'

export interface TipTapEditorProps {
  path: string
  root?: string | undefined
  openTabs?: readonly string[] | undefined
  /** Owner of the document; this component only borrows it. */
  documents: DocumentRegistry
  onSave: (path: string) => void
  /**
   * Show the markdown source instead of this editor.
   *
   * The counterpart of the raw view's "Switch to Notion WYSIWYG" button, which
   * had no way in from this side. Read-only over there — the tree is the
   * document — so this is a viewer, not a second editor.
   */
  onViewRaw: () => void
}

interface SlashState {
  query: string
  range: { from: number; to: number }
  position: { top: number; left: number; bottom: number }
}

export function TipTapEditor({
  path,
  root,
  openTabs,
  documents,
  onSave,
  onViewRaw,
}: TipTapEditorProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [slashState, setSlashState] = useState<SlashState | null>(null)
  const [docLinkState, setDocLinkState] = useState<DocLinkState | null>(null)
  const [mediaModal, setMediaModal] = useState<MediaModalType | null>(null)
  const [outlineOpen, setOutlineOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dsh_toc_open') === 'true'
    } catch {
      return false
    }
  })
  const [findBarOpen, setFindBarOpen] = useState(false)
  const [copiedMd, setCopiedMd] = useState(false)
  const [aiState, setAiState] = useState<AIState | null>(null)

  useEditorSnapshot(editor)

  const isDirty = documents.isDirty(path)

  const openAI = (customInitialPrompt?: string) => {
    if (!editor) return
    const { selection } = editor.state
    const { from, to, empty } = selection
    const originalText = empty ? '' : editor.state.doc.textBetween(from, to, ' ')
    const promptStr = typeof customInitialPrompt === 'string' ? customInitialPrompt : ''

    try {
      const coords = editor.view.coordsAtPos(from)
      setAiState({
        status: 'prompting',
        pos: { top: coords.bottom + 4, left: coords.left },
        range: { from, to },
        originalText,
        generatedText: '',
        customPrompt: promptStr || undefined,
      })
    } catch {
      setAiState({
        status: 'prompting',
        pos: { top: 120, left: 240 },
        range: { from, to },
        originalText,
        generatedText: '',
        customPrompt: promptStr || undefined,
      })
    }
  }

  const toggleOutline = () => {
    setOutlineOpen(prev => {
      const next = !prev
      try {
        localStorage.setItem('dsh_toc_open', String(next))
      } catch {}
      return next
    })
  }

  /** Detect if the cursor is directly after a "/" trigger for slash menu */
  const detectSlashCommand = (ed: Editor) => {
    const { selection } = ed.state
    const { $from, empty } = selection
    if (!empty) {
      setSlashState(null)
      return
    }

    // Look at text in current node before caret
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')
    const slashMatch = textBefore.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/)

    if (slashMatch && slashMatch.index !== undefined) {
      const matchStartInParent = slashMatch.index + (slashMatch[0].startsWith(' ') ? 1 : 0)
      const from = $from.start() + matchStartInParent
      const to = $from.pos
      const query = slashMatch[1] ?? ''

      try {
        const coords = ed.view.coordsAtPos(from)
        setSlashState({
          query,
          range: { from, to },
          position: {
            top: coords.top,
            left: coords.left,
            bottom: coords.bottom,
          },
        })
      } catch {
        setSlashState(null)
      }
    } else {
      setSlashState(null)
    }
  }

  /** Detect if the cursor is directly after "@" or "[[" for document/section mention completion */
  const detectDocLinkCommand = (ed: Editor) => {
    const { selection } = ed.state
    const { $from, empty } = selection
    if (!empty) {
      setDocLinkState(null)
      return
    }

    const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')

    // Match [[query or @query
    const bracketMatch = textBefore.match(/\[\[([^\]]*)$/)
    const atMatch = textBefore.match(/(?:^|\s)@([a-zA-Z0-9_./#-]*)$/)

    if (bracketMatch && bracketMatch.index !== undefined) {
      const from = $from.start() + bracketMatch.index
      const to = $from.pos
      const query = bracketMatch[1] ?? ''

      try {
        const coords = ed.view.coordsAtPos(from)
        setDocLinkState({
          query,
          range: { from, to },
          position: {
            top: coords.top,
            left: coords.left,
            bottom: coords.bottom,
          },
        })
      } catch {
        setDocLinkState(null)
      }
    } else if (atMatch && atMatch.index !== undefined) {
      const matchStartInParent = atMatch.index + (atMatch[0].startsWith(' ') ? 1 : 0)
      const from = $from.start() + matchStartInParent
      const to = $from.pos
      const query = atMatch[1] ?? ''

      try {
        const coords = ed.view.coordsAtPos(from)
        setDocLinkState({
          query,
          range: { from, to },
          position: {
            top: coords.top,
            left: coords.left,
            bottom: coords.bottom,
          },
        })
      } catch {
        setDocLinkState(null)
      }
    } else {
      setDocLinkState(null)
    }
  }

  // Borrow the document for as long as this view is on screen.
  useEffect(() => {
    const el = containerRef.current
    if (el === null) return

    const instance = documents.attach(path, el)
    if (instance === undefined) return

    // Listeners are added per mount and removed on the way out. The editor
    // outlives this component, so leaving them attached would stack a fresh
    // pair on every tab switch.
    const onUpdate = (): void => {
      detectSlashCommand(instance)
      detectDocLinkCommand(instance)
    }
    const onSelection = (): void => {
      detectSlashCommand(instance)
      detectDocLinkCommand(instance)
      const { from, to, empty } = instance.state.selection
      if (empty) {
        ;(window as any).__dsh_active_selection = null
        return
      }
      const textBefore = instance.state.doc.textBetween(0, from, '\n')
      const selectedText = instance.state.doc.textBetween(from, to, '\n')
      const startLine = (textBefore.match(/\n/g)?.length ?? 0) + 1
      const newlineCount = selectedText.match(/\n/g)?.length ?? 0
      const endLine = startLine + newlineCount
      const rangeString = startLine === endLine ? `#L${startLine}` : `#L${startLine}-L${endLine}`

      ;(window as any).__dsh_active_selection = {
        path,
        from,
        to,
        fromOffset: textBefore.length,
        toOffset: textBefore.length + selectedText.length,
        startLine,
        endLine,
        rangeString,
        selectedText,
      }
    }
    instance.on('update', onUpdate)
    instance.on('selectionUpdate', onSelection)

    setEditor(instance)

    // Global click handler to intercept doc links and mentions
    const handleLinkClicks = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const mention = target.closest('.tiptap-mention') as HTMLElement | null
      if (mention) {
        const id = mention.getAttribute('data-id')
        if (id && (id.startsWith('/') || id.startsWith('./') || id.startsWith('../'))) {
          e.preventDefault()
          e.stopPropagation()
          const resolved = resolveRelativePath(path, id)
          const opened = openInWorkbench(resolved)
          if (!opened) openInWorkbench(id)
          return
        }
      }

      const link = target.closest('a')
      if (!link) return

      const href = link.getAttribute('href')
      if (!href) return

      // Ignore external web links (http, https, mailto)
      if (/^(https?:|mailto:|ftp:)/i.test(href)) return

      // Internal doc link: open in workbench tab
      e.preventDefault()
      e.stopPropagation()
      const resolved = resolveRelativePath(path, href)
      const opened = openInWorkbench(resolved)
      if (!opened) {
        openInWorkbench(href)
      }
    }

    el.addEventListener('click', handleLinkClicks)

    return () => {
      el.removeEventListener('click', handleLinkClicks)
      instance.off('update', onUpdate)
      instance.off('selectionUpdate', onSelection)
      delete (window as any).__dsh_active_selection
      // `detach`, never `destroy`: the document — and with it the undo history —
      // belongs to the registry and has to survive this view going away.
      documents.detach(path)
      setEditor(null)
    }
  }, [documents, path])

  /**
   * Document-scoped shortcuts that are not already bound inside the editor.
   *
   * Note: Mod-z (Undo) and Mod-y / Mod-Shift-z (Redo) are deliberately NOT bound here
   * at the window level. ProseMirror's `history` plugin natively captures and processes
   * undo/redo transactions when the editor is focused. Intercepting them globally would
   * hijack focus or risk double-firing history actions across active components.
   */
  useEffect(() => {
    const insideThisEditor = (): boolean => {
      const el = wrapperRef.current
      const active = document.activeElement
      return el !== null && active instanceof globalThis.Node && el.contains(active)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Someone closer to the focus already claimed this chord (CodeMirror
      // binds Mod-s itself, for one). A window listener is the last to hear an
      // event and must never be the second to act on it.
      if (e.defaultPrevented) return
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        onSave(path)
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        if (!insideThisEditor()) return
        e.preventDefault()
        setFindBarOpen((prev) => !prev)
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        if (!insideThisEditor()) return
        e.preventDefault()
        openAI()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onSave, path, editor])

  return (
    <div ref={wrapperRef} className={css.wrapper}>
      {/* Top action bar */}
      <div className={css.topBar}>
        <Tooltip content="Ask AI / In-line AI Assistant (Ctrl+K)">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => openAI()}
            style={{
              color: '#c084fc',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              background: 'rgba(168, 85, 247, 0.12)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              borderRadius: '6px',
            }}
          >
            <span>✨</span>
            <span>Ask AI</span>
          </Button>
        </Tooltip>

        <span style={{ width: 1, height: 16, background: 'var(--dsw-alias-border-l2, #cbd5e1)', margin: '0 4px' }} />

        <Tooltip content="Document Outline / Table of Contents">
          <IconButton
            size="xs"
            variant="ghost"
            active={outlineOpen}
            onClick={toggleOutline}
          >
            📑
          </IconButton>
        </Tooltip>

        <Tooltip content="Find in document (Ctrl+F)">
          <IconButton
            size="xs"
            variant="ghost"
            active={findBarOpen}
            onClick={() => { setFindBarOpen((open) => !open) }}
          >
            🔍
          </IconButton>
        </Tooltip>

        <span style={{ width: 1, height: 16, background: 'var(--dsw-alias-border-l2, #cbd5e1)', margin: '0 4px' }} />

        <Tooltip content="Undo (Ctrl+Z)">
          <IconButton
            size="xs"
            variant="ghost"
            disabled={!editor?.can().undo()}
            onClick={() => { editor?.commands.undo() }}
          >
            ↩
          </IconButton>
        </Tooltip>

        <Tooltip content="Redo (Ctrl+Y)">
          <IconButton
            size="xs"
            variant="ghost"
            disabled={!editor?.can().redo()}
            onClick={() => { editor?.commands.redo() }}
          >
            ↪
          </IconButton>
        </Tooltip>

        <span style={{ width: 1, height: 16, background: 'var(--dsw-alias-border-l2, #cbd5e1)', margin: '0 4px' }} />

        <Tooltip content="Insert Mermaid Diagram">
          <IconButton
            size="xs"
            variant="ghost"
            onClick={() => { (editor?.commands as any).setMermaid?.() }}
          >
            📊
          </IconButton>
        </Tooltip>

        <Tooltip content="Insert LaTeX Math">
          <IconButton
            size="xs"
            variant="ghost"
            onClick={() => { (editor?.commands as any).setMathBlock?.() }}
          >
            ∑
          </IconButton>
        </Tooltip>

        <Tooltip content="Insert Callout Alert">
          <IconButton
            size="xs"
            variant="ghost"
            onClick={() => { editor?.chain().focus().toggleCallout({ type: 'info' }).run() }}
          >
            💡
          </IconButton>
        </Tooltip>

        <Tooltip content="Insert Toggle / Details Block">
          <IconButton
            size="xs"
            variant="ghost"
            onClick={() => { (editor?.commands as any).insertDetails?.() }}
          >
            ▶
          </IconButton>
        </Tooltip>

        <span className={css.spacer} />

        <Tooltip content="Copy Markdown (as saved)">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              const md = documents.markdown(path, { forSave: false })
              if (md === undefined) return
              void navigator.clipboard.writeText(md).then(() => {
                setCopiedMd(true)
                setTimeout(() => { setCopiedMd(false) }, 1500)
              })
            }}
          >
            {copiedMd ? '✓ Copied' : '📋 Copy MD'}
          </Button>
        </Tooltip>

        <Tooltip content="View the markdown source (read-only)">
          <Button size="xs" variant="ghost" onClick={onViewRaw}>
            {'</> Raw'}
          </Button>
        </Tooltip>

        <Tooltip content="Print / Export PDF">
          <IconButton size="xs" variant="ghost" onClick={() => { window.print() }}>
            📄
          </IconButton>
        </Tooltip>

        <Button
          size="xs"
          variant={isDirty ? 'primary' : 'secondary'}
          onClick={() => { onSave(path) }}
        >
          <span className={`${css.saveDot} ${!isDirty ? css.saveDotSaved : ''}`} />
          {isDirty ? 'Save' : 'Saved ✓'}
        </Button>
      </div>

      {/* Contextual Table Controls */}
      {editor && <TableControls editor={editor} />}

      {/* Main Document Canvas with Frontmatter Widget */}
      <div
        className={css.canvas}
        onClick={(e) => {
          if (!editor || editor.isDestroyed) return
          if (e.target !== e.currentTarget) return

          // 1. If user just selected text via mouse drag, do NOT alter the selection!
          const winSel = window.getSelection()
          if (winSel && !winSel.isCollapsed && winSel.toString().trim().length > 0) {
            return
          }

          const containerEl = containerRef.current
          if (!containerEl) return
          const containerRect = containerEl.getBoundingClientRect()

          // 2. If clicked in empty space BELOW the document container -> focus end of document
          if (e.clientY > containerRect.bottom) {
            const { doc } = editor.state
            const lastChild = doc.lastChild
            const lastStart = lastChild ? doc.content.size - lastChild.nodeSize : 0
            const dom = editor.view.nodeDOM(lastStart) as HTMLElement | null
            // A folded (display:none) tail has no box; focusing it would put the caret
            // somewhere the operator cannot see.
            if (dom instanceof HTMLElement && dom.offsetParent === null) return
            editor.commands.focus('end')
            return
          }

          // 3. If clicked in left/right gutters next to a line -> focus nearest text position at that Y height
          try {
            const targetLeft = e.clientX < containerRect.left
              ? containerRect.left + 15
              : containerRect.right - 15
            const coordsPos = editor.view.posAtCoords({ left: targetLeft, top: e.clientY })
            if (coordsPos && typeof coordsPos.pos === 'number') {
              editor.commands.setTextSelection(coordsPos.pos)
              editor.commands.focus()
            }
          } catch {
            // fallback: do nothing rather than jumping blindly to end
          }
        }}
      >
        {/* The file's own text, not a re-serialisation: frontmatter is a
            file-level header this surface renders as a card rather than as
            editable nodes, so the tree is not where it lives. */}
        <FrontmatterWidget rawMarkdown={documents.source(path) ?? ''} />
        <div ref={containerRef} className={css.container} />
      </div>

      {/* Floating Link Bubble when resting caret inside a link */}
      {editor && <LinkBubble editor={editor} currentPath={path} />}

      {/* Floating Bubble Menu on Selection */}
      {editor && <BubbleMenu editor={editor} path={path} markdown={() => documents.preview(path) ?? ''} onOpenAI={openAI} />}

      {/* In-Editor FindBar */}
      {editor && (
        <FindBar
          editor={editor}
          isOpen={findBarOpen}
          onClose={() => setFindBarOpen(false)}
        />
      )}

      {/* In-Line AI Assistant Popover & Review Bar */}
      {editor && aiState && (
        <InlineAIPopover
          editor={editor}
          aiState={aiState}
          onClose={() => setAiState(null)}
        />
      )}

      {/* Double-Bracket Wiki-Links Autocomplete Menu */}
      {editor && docLinkState && (
        <DocLinkMenu
          editor={editor}
          state={docLinkState}
          currentPath={path}
          root={root}
          openTabs={openTabs}
          onClose={() => { setDocLinkState(null) }}
        />
      )}

      {/* Slash Command Menu */}
      {editor && slashState && docLinkState === null && (
        <SlashMenu
          editor={editor}
          query={slashState.query}
          range={slashState.range}
          position={slashState.position}
          onClose={() => { setSlashState(null) }}
          onOpenMediaModal={type => { setMediaModal(type) }}
          onToggleToc={() => { setOutlineOpen(true) }}
          onOpenAI={openAI}
        />
      )}

      {/* Media & Embed Modal */}
      {editor && mediaModal && (
        <MediaModal
          type={mediaModal}
          editor={editor}
          onClose={() => { setMediaModal(null) }}
        />
      )}

      {/* Block Drag Handle & Action Menu */}
      {editor && <DragHandleMenu editor={editor} />}

      {/* Upgraded Table of Contents / Outline Panel */}
      {editor && (
        <TableOfContents
          editor={editor}
          isOpen={outlineOpen}
          onOpen={() => {
            setOutlineOpen(true)
            try { localStorage.setItem('dsh_toc_open', 'true') } catch {}
          }}
          onClose={() => {
            setOutlineOpen(false)
            try { localStorage.setItem('dsh_toc_open', 'false') } catch {}
          }}
        />
      )}
    </div>
  )
}
