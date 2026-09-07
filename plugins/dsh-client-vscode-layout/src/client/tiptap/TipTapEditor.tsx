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
import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef, type ForwardedRef } from 'react'
import type { Editor } from '@tiptap/core'
import type { DocumentRegistry } from './documents.ts'
import type { ReviewStats } from '../workbench/CodeEditor.tsx'
import { reviewPluginKey, rejectHunksBatch } from './TipTapReviewPlugin.ts'
import { findTextPosition } from './blockMap.ts'
import { SlashMenu } from './SlashMenu.tsx'
import { BubbleMenu } from './BubbleMenu.tsx'
import { LinkBubble } from './LinkBubble.tsx'
import { DocLinkMenu, type DocLinkState } from './DocLinkMenu.tsx'
import { TableControls } from './TableControls.tsx'
import { TableCellHandles } from './table/TableCellHandles.tsx'
import { MediaModal, type MediaModalType } from './MediaModal.tsx'
import { TableOfContents } from './toc/TableOfContents.tsx'
import { FindBar } from './findBar/FindBar.tsx'
import { FrontmatterWidget } from './frontmatter/FrontmatterWidget.tsx'
import { GutterControls } from './dragHandle/GutterControls.tsx'
import { InlineAIPopover } from './ai/InlineAIPopover.tsx'
import type { AIState, AIActionId } from './ai/types.ts'
import { useEditorSnapshot } from './useEditorSnapshot.ts'
import { resolveRelativePath } from '../utils/path.ts'
import { openInWorkbench } from '../fileOpener.ts'
import { createModeSwitchPositionResolver, type BlockAnchor } from '../workbench/modeSwitchPositionResolver.ts'
import css from './TipTapEditor.module.css'

export interface TipTapEditorHandle {
  acceptAll: () => void
  rejectAll: () => void
  undoReview: () => boolean
  redoReview: () => boolean
  nextChunk: () => boolean
  prevChunk: () => boolean
  getChunkCount: () => number
  captureBlockAnchor: () => BlockAnchor | null
}

export interface TipTapEditorProps {
  path: string
  root?: string | undefined
  openTabs?: readonly string[] | undefined
  /** Owner of the document; this component only borrows it. */
  documents: DocumentRegistry
  onSave: (path: string) => void
  /**
   * Show the markdown source instead of this editor.
   * Optionally accepts a targetLine in the raw source.
   */
  onViewRaw?: (targetLine?: number) => void
  /**
   * A 1-based line number in the file's raw source to scroll to and select —
   * a search hit's target line, same input CodeEditor's `revealLine` takes.
   * The tree has no line numbers of its own (a WYSIWYG document, not text),
   * so this maps the source line's own text to wherever that text landed in
   * the parsed document, via `documents.source(path)`.
   */
  revealLine?: number | undefined
  /** Active baseline for Notion WYSIWYG AI review */
  diffBaseline?: string | undefined
  /**
   * Pre-write frontmatter block (fences included, or `''`) while a review is
   * active, `undefined` otherwise. Frontmatter lives outside the tree
   * (`splitFrontmatter` strips it before the parser ever sees it), so it is
   * invisible to `diffBaseline`'s block-level diff — this is the whole
   * baseline `FrontmatterWidget` needs to notice a frontmatter-only change.
   */
  frontmatterBaseline?: string | undefined
  /** Frontmatter already holds the AI's version — stop tracking it as changed. */
  onAcceptFrontmatter?: (() => void) | undefined
  /** Revert frontmatter to `frontmatterBaseline` and persist it. */
  onRejectFrontmatter?: (() => void) | undefined
  /** Notified on every transaction that could have changed review state. */
  onReviewStatsChange?: ((stats: ReviewStats) => void) | undefined
}

interface SlashState {
  query: string
  range: { from: number; to: number }
  position: { top: number; left: number; bottom: number }
}

export const TipTapEditor = forwardRef(function TipTapEditor({
  path,
  root,
  openTabs,
  documents,
  onSave,
  onViewRaw: _onViewRaw,
  revealLine,
  diffBaseline,
  frontmatterBaseline,
  onAcceptFrontmatter,
  onRejectFrontmatter,
  onReviewStatsChange,
}: TipTapEditorProps, ref: ForwardedRef<TipTapEditorHandle>) {
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
  const [aiState, setAiState] = useState<AIState | null>(null)

  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  useEditorSnapshot(editor)

  // Keep the floating bar's stats in sync with EVERY plugin-state change —
  // not only the ones this component's own imperative handle triggers. A
  // per-hunk accept/reject clicked from the in-document widget
  // (TipTapReviewPlugin's renderHunkWidget) dispatches straight into the
  // plugin and never goes through acceptAll/rejectAll/undoReview below, so
  // without this the bar's count and Undo availability never moved for it —
  // the count would read "4 changes" forever after accepting all 4 by hand.
  //
  // `'transaction'` fires for every dispatched transaction, including a
  // meta-only one that carries no document change (an accept, per the
  // measured invariant that accept never touches the document) — `'update'`
  // is gated on `docChanged` and would miss exactly that case.
  useEffect(() => {
    if (!editor || !onReviewStatsChange) return
    const report = () => {
      const pState = reviewPluginKey.getState(editor.state)
      onReviewStatsChange({
        count: pState?.hunks.length ?? 0,
        // A rejected hunk is a real, tracked ProseMirror transaction (unlike
        // accept, which never touches the document) — the History extension
        // already carries it, so "can undo" also has to look there, not
        // only at the accept-snapshot stack, or the "↺ Hoàn tác" button
        // would stay disabled right after a reject.
        canUndo: (pState?.snapshots.length ?? 0) > 0 || editor.can().undo(),
        // The markdown baseline, not baselineBlocks/baseNodes — this is the
        // whole-file text Workbench needs to re-arm `diffBaseline` from on a
        // remount, so an already-resolved hunk does not come back.
        baseline: pState?.baselineMarkdown ?? '',
        snapshots: pState?.snapshots ?? [],
      })
    }
    editor.on('transaction', report)
    return () => { editor.off('transaction', report) }
  }, [editor, onReviewStatsChange])

  // Keep the review plugin's own save hook current — a per-hunk reject is
  // dispatched from inside `renderHunkWidget`'s button, which only has
  // `view` in scope, not this component's `onSave`/`path`. See
  // `SET_ON_REJECT` in TipTapReviewPlugin.ts. Keyed on `[editor, path]`
  // (not `onSave`, a fresh closure every Workbench render) via a ref so this
  // dispatches once per mount rather than on every parent re-render.
  useEffect(() => {
    if (!editor) return
    editor.view.dispatch(
      editor.state.tr.setMeta(reviewPluginKey, {
        type: 'SET_ON_REJECT',
        onReject: () => { onSaveRef.current(path) },
      })
    )
  }, [editor, path])

  // Synchronize AI Review Baseline. The transaction listener above reports
  // the resulting stats once this dispatches — no separate report call
  // needed here.
  useEffect(() => {
    if (!editor) return
    editor.view.dispatch(
      editor.state.tr.setMeta(reviewPluginKey, {
        type: 'SET_BASELINE',
        // `??`, not `||`: a genuine create's baseline is the empty string,
        // which must still arm the review (as "the whole file is new") —
        // `||` collapses it to `null`, which disarms instead.
        baseline: diffBaseline ?? null,
      })
    )
  }, [editor, diffBaseline])

  // Expose Review Actions to Workbench Toolbar
  useImperativeHandle(ref, () => ({
    acceptAll: () => {
      if (!editor) return
      const pState = reviewPluginKey.getState(editor.state)
      if (!pState || pState.hunks.length === 0) return
      const currentBase = pState.baselineMarkdown
      if (currentBase) {
        editor.view.dispatch(
          editor.state.tr.setMeta(reviewPluginKey, {
            type: 'PUSH_SNAPSHOT',
            snapshot: currentBase,
          })
        )
      }
      editor.view.dispatch(
        editor.state.tr.setMeta(reviewPluginKey, {
          type: 'SET_BASELINE',
          baseline: editor.getMarkdown(),
        })
      )
      // The transaction listener above reports the resulting stats — this
      // dispatch already triggered it synchronously.
    },
    rejectAll: () => {
      if (!editor) return
      const pState = reviewPluginKey.getState(editor.state)
      if (!pState || pState.hunks.length === 0) return
      // One transaction for every hunk, not N — see rejectHunksBatch's doc:
      // fewer freezes on a large review, and an accidental Ctrl+Z undoes the
      // whole Reject All in one step instead of only its last hunk.
      rejectHunksBatch(editor.view, pState.hunks, pState)
    },
    undoReview: () => {
      if (!editor) return false
      const pState = reviewPluginKey.getState(editor.state)
      if (pState && pState.snapshots.length > 0) {
        editor.view.dispatch(
          editor.state.tr.setMeta(reviewPluginKey, {
            type: 'POP_SNAPSHOT',
          })
        )
        onSaveRef.current(path)
        return true
      }
      // Nothing on the accept-snapshot stack to pop — the last review action
      // was a reject (a real, history-tracked transaction), so fall back to
      // the editor's own undo instead of a bespoke reject-undo stack.
      if (!editor.commands.undo()) return false
      onSaveRef.current(path)
      return true
    },
    redoReview: () => {
      if (!editor) return false
      const pState = reviewPluginKey.getState(editor.state)
      if (pState && pState.redoSnapshots.length > 0) {
        editor.view.dispatch(
          editor.state.tr.setMeta(reviewPluginKey, {
            type: 'POP_REDO_SNAPSHOT',
          })
        )
        onSaveRef.current(path)
        return true
      }
      // Nothing on our own accept-redo stack — fall through to the editor's
      // native redo, which correctly redoes a previously-undone reject.
      if (!editor.commands.redo()) return false
      onSaveRef.current(path)
      return true
    },
    // Both previously always jumped to hunks[0]/hunks[last] — a second press
    // of "next" landed on the exact same hunk instead of advancing, because
    // neither read where the caret actually was. Using the live selection as
    // the cursor (CodeMirror's goToNextChunk/goToPreviousChunk do the same,
    // relative to `view.state.selection`) makes repeated presses walk the
    // list, and it self-corrects after an accept/reject reindexes `hunks`.
    nextChunk: () => {
      if (!editor) return false
      const pState = reviewPluginKey.getState(editor.state)
      if (!pState || pState.hunks.length === 0) return false
      const pos = editor.state.selection.from
      const target = pState.hunks.find(h => h.fromPos > pos) ?? pState.hunks[0]
      if (!target) return false
      try {
        const domNode = editor.view.nodeDOM(target.fromPos) as HTMLElement | null
        domNode?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } catch {}
      editor.commands.setTextSelection(Math.min(target.fromPos, editor.state.doc.content.size))
      return true
    },
    prevChunk: () => {
      if (!editor) return false
      const pState = reviewPluginKey.getState(editor.state)
      if (!pState || pState.hunks.length === 0) return false
      const pos = editor.state.selection.from
      let target = pState.hunks[pState.hunks.length - 1]
      for (let i = pState.hunks.length - 1; i >= 0; i--) {
        const h = pState.hunks[i]
        if (h && h.fromPos < pos) { target = h; break }
      }
      if (!target) return false
      try {
        const domNode = editor.view.nodeDOM(target.fromPos) as HTMLElement | null
        domNode?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } catch {}
      editor.commands.setTextSelection(Math.min(target.fromPos, editor.state.doc.content.size))
      return true
    },
    getChunkCount: () => {
      if (!editor) return 0
      const pState = reviewPluginKey.getState(editor.state)
      return pState?.hunks.length ?? 0
    },
    captureBlockAnchor: () => {
      if (!editor) return null
      return createModeSwitchPositionResolver().captureFromWysiwyg(
        editor.state.doc,
        editor.state.selection.from,
        { refine: true }
      )
    },
  }), [editor, onReviewStatsChange])

  const openAI = (customInitialPrompt?: string, actionId?: AIActionId, executeNow = false) => {
    if (!editor) return
    const { selection } = editor.state
    const { from, to, empty } = selection
    const originalText = empty ? '' : editor.state.doc.textBetween(from, to, ' ')
    const promptStr = typeof customInitialPrompt === 'string' ? customInitialPrompt : ''

    try {
      const coords = editor.view.coordsAtPos(from)
      setAiState({
        status: executeNow ? 'generating' : 'prompting',
        pos: { top: coords.bottom + 4, left: coords.left },
        range: { from, to },
        originalText,
        generatedText: '',
        customPrompt: promptStr || undefined,
        action: actionId,
      })
    } catch {
      setAiState({
        status: executeNow ? 'generating' : 'prompting',
        pos: { top: 120, left: 240 },
        range: { from, to },
        originalText,
        generatedText: '',
        customPrompt: promptStr || undefined,
        action: actionId,
      })
    }
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
      const rangeString = startLine === endLine ? `#L${startLine}` : `#L${startLine}-${endLine}`

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

  // Own effect, not folded into the mount effect above, so a second search
  // hit landing on an already-open file (same path, new `revealLine`) is
  // not silently ignored — same reasoning as CodeEditor.tsx's own fix.
  //
  // No line-to-block mapping is built for this: the tree has no source line
  // numbers of its own, and approximating one by splitting the raw source on
  // blank lines would agree with the parsed document's actual block
  // boundaries only some of the time (a nested list, a multi-line
  // blockquote). Instead this reads that source line's own text out of
  // `documents.source(path)` (the exact bytes the tree was parsed from) and
  // finds *that text* in the live document — precise wherever the text
  // survived parsing unchanged, and a silent no-op rather than a
  // confidently-wrong jump everywhere else.
  useEffect(() => {
    if (!editor || revealLine === undefined || revealLine < 1) return
    const source = documents.source(path)
    if (source === undefined) return
    const target = source.split('\n')[revealLine - 1]?.trim()
    if (!target) return

    const matchPos = findTextPosition(editor.state.doc, target)
    if (matchPos === undefined) return

    const clampedPos = Math.min(matchPos, editor.state.doc.content.size)
    editor.commands.setTextSelection(clampedPos)
    try {
      const domNode = editor.view.domAtPos(clampedPos).node as Node | null
      const el = domNode instanceof HTMLElement ? domNode : domNode?.parentElement
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch {}
    // Unlike a mount's own focus (which cannot tell a user's click from an
    // agent-initiated open), landing here always means a real click on a
    // search hit — a ProseMirror selection set without focus updates state
    // correctly (proven directly) but draws no visible cursor, since
    // ProseMirror renders selection through the real contenteditable rather
    // than an owned decoration the way CodeMirror does. Same composer guard
    // as everywhere else that focuses on a gesture.
    const activeElsewhere = typeof document !== 'undefined'
      && document.activeElement?.closest('[data-dsh-chat-panel="true"]') != null
    if (!activeElsewhere) editor.commands.focus()
  }, [documents, editor, path, revealLine])

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
        // Unlike Ctrl+F/Ctrl+K below, this one used to fire unconditionally —
        // pressing Ctrl+S while typing in the chat composer saved this
        // markdown tab, a surprising side effect of typing somewhere else
        // entirely.
        if (!insideThisEditor()) return
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
  const handleViewInSource = useCallback(() => {
    if (!_onViewRaw) return
    if (editor) {
      const resolver = createModeSwitchPositionResolver()
      const anchor = resolver.captureFromWysiwyg(editor.state.doc, editor.state.selection.from, { refine: true })
      if (anchor) {
        const mdText = documents.preview(path) ?? ''
        const resolved = resolver.resolveInSource(anchor, { source: mdText, doc: editor.state.doc })
        if (resolved?.line) {
          _onViewRaw(resolved.line)
          return
        }
      }
    }
    _onViewRaw()
  }, [editor, documents, path, _onViewRaw])

  return (
    <div ref={wrapperRef} className={css.wrapper}>
      {/* Contextual Table Controls & Drag Reorder Handles */}
      {editor && <TableControls editor={editor} />}
      {editor && <TableCellHandles editor={editor} />}

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
        <FrontmatterWidget
          rawMarkdown={documents.source(path) ?? ''}
          frontmatterBaseline={frontmatterBaseline}
          onAcceptFrontmatter={onAcceptFrontmatter}
          onRejectFrontmatter={onRejectFrontmatter}
        />
        <div ref={containerRef} className={css.container} />
      </div>

      {/* Floating Link Bubble when resting caret inside a link */}
      {editor && <LinkBubble editor={editor} currentPath={path} />}

      {/* Floating Bubble Menu on Selection */}
      {editor && (
        <BubbleMenu
          editor={editor}
          path={path}
          markdown={() => documents.preview(path) ?? ''}
          onOpenAI={openAI}
          onViewInSource={handleViewInSource}
        />
      )}

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

      {/* Notion-style Gutter Controls (+ to add block & trigger slash menu, grip to drag/menu) */}
      {editor && <GutterControls editor={editor} />}

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
})
