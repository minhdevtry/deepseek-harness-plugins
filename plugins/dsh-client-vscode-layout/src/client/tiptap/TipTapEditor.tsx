/**
 * TipTap Notion WYSIWYG Editor Host.
 *
 * Full-featured Notion suite: slash menu, bubble menu, interactive table toolbar,
 * callouts, task lists, code blocks with 1-click copy, media modals, and TOC outline.
 *
 * Synchronizes with BufferRegistry via serializeStable (fixed-point guarantee).
 */
import { useEffect, useRef, useState } from 'react'
import { Editor } from '@tiptap/core'
import type { BufferRegistry } from '../workbench/buffers.ts'
import { documentExtensions } from './extensions.ts'
import { serializeStable } from './markdown.ts'
import { SlashMenu } from './SlashMenu.tsx'
import { BubbleMenu } from './BubbleMenu.tsx'
import { TableControls } from './TableControls.tsx'
import { MediaModal, type MediaModalType } from './MediaModal.tsx'
import { TableOfContents } from './toc/TableOfContents.tsx'
import { FindBar } from './findBar/FindBar.tsx'
import { FrontmatterWidget } from './frontmatter/FrontmatterWidget.tsx'
import { getLineRangeForSelection } from '../utils/chatComposer.ts'
import css from './TipTapEditor.module.css'

export interface TipTapEditorProps {
  path: string
  registry: BufferRegistry
  onSave: (path: string) => void
}

interface SlashState {
  query: string
  range: { from: number; to: number }
  position: { top: number; left: number; bottom: number }
}

export function TipTapEditor({
  path,
  registry,
  onSave,
}: TipTapEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [slashState, setSlashState] = useState<SlashState | null>(null)
  const [mediaModal, setMediaModal] = useState<MediaModalType | null>(null)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [findBarOpen, setFindBarOpen] = useState(false)

  const isDirty = registry.isDirty(path)

  useEffect(() => {
    try {
      localStorage.removeItem('dsh_toc_pinned')
    } catch {}
  }, [])

  // Initialize TipTap Editor with shared extension set
  useEffect(() => {
    const el = containerRef.current
    if (el === null) return

    const initialContent = registry.getText(path) ?? ''

    const instance = new Editor({
      element: el,
      extensions: documentExtensions(),
      content: initialContent,
      onUpdate: ({ editor: ed }) => {
        // Sync stable markdown back to BufferRegistry
        const md = serializeStable(ed)
        registry.setText(path, md)

        // Check for slash menu trigger
        detectSlashCommand(ed)
      },
      onSelectionUpdate: ({ editor: ed }) => {
        detectSlashCommand(ed)
        const { from, to, empty } = ed.state.selection
        if (!empty) {
          const selectedText = ed.state.doc.textBetween(from, to, '\n')
          const docText = registry.getText(path) || ''
          const { startLine, endLine, rangeString } = getLineRangeForSelection(docText, selectedText)
          ;(window as any).__dsh_active_selection = {
            path,
            selectedText,
            startLine,
            endLine,
            rangeString,
          }
        } else {
          ;(window as any).__dsh_active_selection = null
        }
      },
    })

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
      instance.destroy()
      setEditor(null)
    }
  }, [path, registry])

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

  // Handle hotkeys (Ctrl+S, Ctrl+F, Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        onSave(path)
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setFindBarOpen((prev) => !prev)
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        editor?.commands.undo()
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        e.preventDefault()
        editor?.commands.redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, onSave, path])

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
            if (editor) {
              const md = serializeStable(editor)
              navigator.clipboard.writeText(md).then(() => alert('Markdown copied to clipboard!'))
            }
          }}
          title="Copy Clean Markdown"
        >
          📋 Copy MD
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
        <FrontmatterWidget rawMarkdown={registry.getText(path) || ''} />
        <div ref={containerRef} className={css.container} />
      </div>

      {/* Floating Bubble Menu on Selection */}
      {editor && <BubbleMenu editor={editor} path={path} registry={registry} />}

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
