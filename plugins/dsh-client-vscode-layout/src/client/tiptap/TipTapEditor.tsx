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
import { TableControls } from './TableControls.tsx'
import { MediaModal, type MediaModalType } from './MediaModal.tsx'
import { TableOfContents } from './toc/TableOfContents.tsx'
import { FindBar } from './findBar/FindBar.tsx'
import { FrontmatterWidget } from './frontmatter/FrontmatterWidget.tsx'
import css from './TipTapEditor.module.css'

export interface TipTapEditorProps {
  path: string
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
  documents,
  onSave,
  onViewRaw,
}: TipTapEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [slashState, setSlashState] = useState<SlashState | null>(null)
  const [mediaModal, setMediaModal] = useState<MediaModalType | null>(null)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [findBarOpen, setFindBarOpen] = useState(false)

  const isDirty = documents.isDirty(path)

  useEffect(() => {
    try {
      localStorage.removeItem('dsh_toc_pinned')
    } catch {}
  }, [])

  // Borrow the document for as long as this view is on screen.
  useEffect(() => {
    const el = containerRef.current
    if (el === null) return

    const instance = documents.attach(path, el)
    if (instance === undefined) return

    // Listeners are added per mount and removed on the way out. The editor
    // outlives this component, so leaving them attached would stack a fresh
    // pair on every tab switch.
    const onUpdate = (): void => { detectSlashCommand(instance) }
    const onSelection = (): void => {
      detectSlashCommand(instance)
      const { from, to, empty } = instance.state.selection
      if (empty) {
        ;(window as any).__dsh_active_selection = null
        return
      }
      // Selected text only. The line range used to be computed here, on every
      // cursor move, which meant serialising the document to search it — and
      // now that markdown is a save-time projection it would cost even more.
      // The two consumers (Ctrl+L and the bubble menu's Mention button) resolve
      // the range when they act, which is a click rather than a keystroke.
      ;(window as any).__dsh_active_selection = {
        path,
        selectedText: instance.state.doc.textBetween(from, to, '\n'),
      }
    }
    instance.on('update', onUpdate)
    instance.on('selectionUpdate', onSelection)

    setEditor(instance)

    // Global click handler to attach copy buttons to code blocks
    const handlePreClicks = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('copy-code-btn')) {
        const pre = target.closest('pre')
        const code = pre?.querySelector('code')?.innerText ?? pre?.innerText ?? ''
        navigator.clipboard.writeText(code).then(() => {
          const original = target.innerText
          target.innerText = '✓ Copied'
          setTimeout(() => { target.innerText = original }, 1500)
        })
      }
    }

    // Attach copy buttons dynamically to <pre> blocks
    const addCopyButtons = () => {
      const pres = el.querySelectorAll('pre')
      pres.forEach(pre => {
        if (!pre.querySelector('.copy-code-btn')) {
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.className = 'copy-code-btn'
          btn.innerText = 'Copy'
          pre.appendChild(btn)
        }
      })
    }

    addCopyButtons()
    instance.on('update', addCopyButtons)
    el.addEventListener('click', handlePreClicks)

    return () => {
      el.removeEventListener('click', handlePreClicks)
      instance.off('update', onUpdate)
      instance.off('selectionUpdate', onSelection)
      instance.off('update', addCopyButtons)
      // `detach`, never `destroy`: the document — and with it the undo history —
      // belongs to the registry and has to survive this view going away.
      documents.detach(path)
      setEditor(null)
    }
  }, [documents, path])

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

  /**
   * Document-scoped shortcuts that are not already bound inside the editor.
   *
   * Undo/redo are deliberately absent. They used to live here, on `window`,
   * calling `editor.commands.undo()` without checking `defaultPrevented` or
   * where focus was — which broke undo in two ways at once. Inside the editor
   * ProseMirror's own keymap had already run `undo` and called
   * `preventDefault()`; preventDefault does not stop propagation, so the event
   * reached this listener and undid a *second* step. And outside the editor —
   * the chat composer, a rename box, the raw CodeMirror view — this fired
   * anyway, silently rewinding a document nobody was looking at (and
   * preventDefault killed the native undo of plain inputs).
   *
   * Every surface already ships a correct, focus-scoped undo: ProseMirror's
   * keymap here, `historyKeymap` in CodeMirror, the host's own handler in the
   * composer. The fix is to bind nothing globally and let focus decide. The
   * toolbar's Undo/Redo buttons stay: those name their target explicitly.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Someone closer to the focus already claimed this chord (CodeMirror
      // binds Mod-s itself, for one). A window listener is the last to hear an
      // event and must never be the second to act on it.
      if (e.defaultPrevented) return
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        onSave(path)
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setFindBarOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onSave, path])

  return (
    <div className={css.wrapper}>
      {/* Top action bar */}
      <div className={css.topBar}>
        <button
          type="button"
          className={`${css.actionBtn} ${outlineOpen ? css.actionBtnActive : ''}`}
          onClick={() => { setOutlineOpen((open) => !open) }}
          title="Document Outline / Table of Contents"
        >
          📑 Outline
        </button>

        <button
          type="button"
          className={`${css.actionBtn} ${findBarOpen ? css.actionBtnActive : ''}`}
          onClick={() => { setFindBarOpen((open) => !open) }}
          title="Find in document (Ctrl+F)"
        >
          🔍 Find
        </button>

        <span style={{ width: 1, height: 16, background: 'var(--dsw-alias-border-l2, #cbd5e1)', margin: '0 4px' }} />

        <button
          type="button"
          className={css.actionBtn}
          onClick={() => { editor?.commands.undo() }}
          disabled={!editor?.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          ↩ Undo
        </button>

        <button
          type="button"
          className={css.actionBtn}
          onClick={() => { editor?.commands.redo() }}
          disabled={!editor?.can().redo()}
          title="Redo (Ctrl+Y)"
        >
          ↪ Redo
        </button>

        <span style={{ width: 1, height: 16, background: 'var(--dsw-alias-border-l2, #cbd5e1)', margin: '0 4px' }} />

        <button
          type="button"
          className={css.actionBtn}
          onClick={() => { (editor?.commands as any).setMermaid?.() }}
          title="Insert Mermaid Diagram"
        >
          📊 Mermaid
        </button>

        <button
          type="button"
          className={css.actionBtn}
          onClick={() => { (editor?.commands as any).setMathBlock?.() }}
          title="Insert LaTeX Math"
        >
          ∑ Math
        </button>

        <button
          type="button"
          className={css.actionBtn}
          onClick={() => { editor?.chain().focus().toggleCallout({ type: 'info' }).run() }}
          title="Insert Callout"
        >
          💡 Callout
        </button>

        <span className={css.spacer} />

        <button
          type="button"
          className={css.actionBtn}
          onClick={() => {
            const md = documents.preview(path)
            if (md === undefined) return
            navigator.clipboard.writeText(md).then(() => alert('Markdown copied to clipboard!'))
          }}
          title="Copy Clean Markdown"
        >
          📋 Copy MD
        </button>

        <button
          type="button"
          className={css.actionBtn}
          onClick={onViewRaw}
          title="View the markdown source (read-only)"
        >
          {'</> Raw'}
        </button>

        <button
          type="button"
          className={css.actionBtn}
          onClick={() => { window.print() }}
          title="Print / Export PDF"
        >
          📄 Print
        </button>

        <button
          type="button"
          className={css.actionBtn}
          onClick={() => { onSave(path) }}
          title="Save (Ctrl+S)"
        >
          <span className={`${css.saveDot} ${!isDirty ? css.saveDotSaved : ''}`} />
          {isDirty ? 'Save' : 'Saved ✓'}
        </button>
      </div>

      {/* Contextual Table Controls */}
      {editor && <TableControls editor={editor} />}

      {/* Main Document Canvas with Frontmatter Widget */}
      <div className={css.canvas} onClick={() => { editor?.commands.focus() }}>
        {/* The file's own text, not a re-serialisation: frontmatter is a
            file-level header this surface renders as a card rather than as
            editable nodes, so the tree is not where it lives. */}
        <FrontmatterWidget rawMarkdown={documents.source(path) ?? ''} />
        <div ref={containerRef} className={css.container} />
      </div>

      {/* Floating Bubble Menu on Selection */}
      {editor && <BubbleMenu editor={editor} path={path} markdown={() => documents.preview(path) ?? ''} />}

      {/* In-Editor FindBar */}
      {editor && (
        <FindBar
          editor={editor}
          isOpen={findBarOpen}
          onClose={() => setFindBarOpen(false)}
        />
      )}

      {/* Slash Command Menu */}
      {editor && slashState && (
        <SlashMenu
          editor={editor}
          query={slashState.query}
          range={slashState.range}
          position={slashState.position}
          onClose={() => { setSlashState(null) }}
          onOpenMediaModal={type => { setMediaModal(type) }}
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

      {/* Upgraded Table of Contents / Outline Panel */}
      {editor && (
        <TableOfContents
          editor={editor}
          isOpen={outlineOpen}
          onOpen={() => setOutlineOpen(true)}
          onClose={() => setOutlineOpen(false)}
        />
      )}
    </div>
  )
}
