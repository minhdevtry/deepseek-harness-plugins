/**
 * The centre column: tab strip, breadcrumb, editor, status bar.
 *
 * Owns the two document registries and turns gestures into calls on them; the
 * tab list itself lives in the frame store, because the explorer highlights the
 * active path too. List arithmetic is delegated to `model/tabs.ts` so the
 * closing rules stay assertable without mounting anything.
 *
 * **Two registries, one rule: the document outlives the view.** `BufferRegistry`
 * holds a CodeMirror `EditorState` per path; `DocumentRegistry` holds a TipTap
 * `Editor` per markdown path. Both exist so that a tab switch cannot destroy an
 * undo history — the mistake this column used to make on the markdown side, and
 * the reason Ctrl+Z there could not reach past the last time you looked at
 * another file.
 *
 * Which registry is authoritative depends on the file. For markdown it is the
 * tree: the text CodeMirror views are read-only (see `mdTextReadOnly` below) and the
 * buffer is refreshed from the tree at save time and whenever a text-shaped view
 * needs to read it. For everything else the buffer is the only document there is.
 *
 * The editor's own text never enters React state. What React holds here is the
 * tab list, the dirty set, the caret position and the save indicator.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { gitStatus, readFile } from '../api/files.ts'
import { Dialog } from '../ui/Dialog.tsx'
import { BufferRegistry } from './buffers.ts'
import { DocumentRegistry } from '../tiptap/documents.ts'
import { SaveQueue } from './saveQueue.ts'
import { isMarkdown } from './language.ts'
import { splitFrontmatter } from '../tiptap/frontmatter/splitFrontmatter.ts'
import { languageExtension, languageName } from './language.ts'
import { editorTheme } from './theme.ts'
import { CodeEditor, type CodeEditorHandle, type CursorInfo, type DiffMode, type ReviewStats } from './CodeEditor.tsx'
import { reconstructBaseline } from './reconstructBaseline.ts'
import { computeLineSummary } from './lineSummary.ts'
import { installReviewCommands, notifyReviewCommandsChanged, type ReviewFileSummary } from './reviewCommands.ts'
import { installCloseCommand } from './closeCommands.ts'
import { FloatingReviewBar } from './FloatingReviewBar.tsx'
import { TabStrip } from './TabStrip.tsx'
import { Breadcrumb } from './Breadcrumb.tsx'
import { useAutoClear } from '../utils/useAutoClear.ts'
import { basename } from '../utils/path.ts'
import { StatusBar } from './StatusBar.tsx'
import { DiffView } from './DiffView.tsx'
import { TipTapEditor, type TipTapEditorHandle } from '../tiptap/TipTapEditor.tsx'
import { ImagePreview } from './previews/ImagePreview.tsx'
import { CsvPreview } from './previews/CsvPreview.tsx'
import { HtmlPreview } from './previews/HtmlPreview.tsx'
import * as tabModel from './model/tabs.ts'
import { Spinner } from '../ui/primitives/index.ts'
import css from './Workbench.module.css'

/** Idle time before auto-save writes, in ms. */
const AUTOSAVE_MS = 1200

/** How long the "Saved ✓" indicator stays, in ms. */
const SAVED_MS = 1500

/** Workbench props. */
export interface WorkbenchProps {
  tabs: readonly string[]
  activePath: string | undefined
  /** 1-based line to reveal when the active tab opens (a search hit). */
  activeLine: number | undefined
  autoSave: boolean
  /** Directory the explorer is showing; the breadcrumb navigates it. */
  explorerRoot: string | undefined
  onOpenFile: (path: string, line?: number) => void
  /**
   * Open a tab without activating it or moving keyboard focus — for a write
   * the agent made, never for something the operator clicked. See the
   * `__dsh_start_ai_review` global below.
   */
  onOpenFileBackground: (path: string) => void
  onSetTabs: (tabs: string[], active: string | undefined) => void
  onMoveTab: (from: number, to: number) => void
  onToggleAutoSave: () => void
  onRevealDir: (dir: string) => void
  onNotify: (message: string) => void
}

/** A tab waiting on the unsaved-changes question. */
type PendingClose = { path: string; busy: boolean; error?: string }

/** The editor column (see module doc). */
export function Workbench({
  tabs, activePath, activeLine, autoSave, explorerRoot,
  onOpenFile, onOpenFileBackground, onSetTabs, onMoveTab, onToggleAutoSave, onRevealDir, onNotify,
}: WorkbenchProps) {
  const [cursor, setCursor] = useState<CursorInfo | undefined>(undefined)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | { error: string }>('idle')
  const [pendingClose, setPendingClose] = useState<PendingClose | undefined>(undefined)
  const [diffOpen, setDiffOpen] = useState(false)
  const [diffModes, setDiffModes] = useState<Record<string, DiffMode>>({})
  const [reviewStats, setReviewStats] = useState<Record<string, { count: number; canUndo: boolean }>>({})
  const [branch, setBranch] = useState<string | undefined>(undefined)
  const [rawModes, setRawModes] = useState<Record<string, boolean>>({})

  const handleReviewStatsChange = useCallback((stats: ReviewStats) => {
    if (!activePath) return
    setReviewStats(prev => {
      const current = prev[activePath]
      if (current?.count === stats.count && current?.canUndo === stats.canUndo) return prev
      return { ...prev, [activePath]: { count: stats.count, canUndo: stats.canUndo } }
    })
    // Keep diffModes' baseline/snapshots current so a remount (a tab switch,
    // T0-7's now-working reconfigure) re-arms from wherever the review
    // actually is, not from the value it started at. Accept advances the
    // live engine's baseline directly, never through React state, so
    // without this echo every already-resolved hunk would reappear the
    // moment the view remounts.
    setDiffModes(prev => {
      const entry = prev[activePath]
      if (!entry || entry.kind !== 'ai-review') return prev
      const entryBaseline = typeof entry.baseline === 'string' ? entry.baseline : entry.baseline.toString()
      const sameBaseline = entryBaseline === stats.baseline
      const entrySnapshots = entry.snapshots ?? []
      const sameSnapshots = entrySnapshots.length === stats.snapshots.length
        && entrySnapshots.every((s, i) => s === stats.snapshots[i])
      if (sameBaseline && sameSnapshots) return prev
      return { ...prev, [activePath]: { ...entry, baseline: stats.baseline, snapshots: [...stats.snapshots] } }
    })
  }, [activePath])

  // Latest-callback ref: the Ctrl+S binding is baked into every EditorState at
  // creation, so it must reach the *current* save handler, not the one that
  // existed when the first file opened.
  const saveRef = useRef<(path: string) => void>(() => {})
  const editorRef = useRef<CodeEditorHandle | null>(null)
  const tipTapRef = useRef<TipTapEditorHandle | null>(null)

  // Latest-value ref: __dsh_start_ai_review needs to know which path is
  // *currently* mounted at call time, but re-installing the window globals on
  // every activePath change would be wasteful — same reasoning as saveRef.
  const activePathRef = useRef(activePath)
  activePathRef.current = activePath

  // Latest-value ref: reviewCommands.ts's implementation is installed once
  // (see below) but must always read the CURRENT review state, not whatever
  // existed when it was installed.
  const diffModesRef = useRef<Record<string, DiffMode>>({})
  diffModesRef.current = diffModes

  // One registry for the component's lifetime. Built lazily so the extension
  // factory closes over the ref above rather than a render-scoped value.
  const registryRef = useRef<BufferRegistry | null>(null)
  registryRef.current ??= new BufferRegistry((path, readOnly) => {
    const language = languageExtension(path)
    return [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      indentOnInput(),
      bracketMatching(),
      highlightSelectionMatches(),
      search({ top: true }),
      editorTheme(),
      EditorView.lineWrapping,
      // Ctrl+S first: the browser's own Save-Page dialog is never what the
      // operator meant inside an editor.
      keymap.of([
        { key: 'Mod-s', preventDefault: true, run: () => { saveRef.current(path); return true } },
        // The stock search panel carries the replace row; Ctrl+H opens the
        // same surface, which is what the shortcut means everywhere else.
        { key: 'Mod-h', preventDefault: true, run: view => openSearch(view) },
        indentWithTab,
      ]),
      keymap.of([...searchKeymap, ...historyKeymap, ...defaultKeymap]),
      ...(readOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : []),
      ...(language === undefined ? [] : [language]),
    ]
  })
  const registry = registryRef.current

  // The WYSIWYG document registry. Same lifetime as the buffer registry and the
  // same purpose: a document that outlives every view that shows it.
  const documentsRef = useRef<DocumentRegistry | null>(null)
  documentsRef.current ??= new DocumentRegistry()
  const documents = documentsRef.current

  useEffect(() => () => { documents.dispose() }, [documents])

  // Per-path autosave timers and per-path save serialization (see saveQueue.ts
  // for why a single whole-dirty-set timer and an unqueued save() were both
  // bugs, not just simplifications).
  const saveQueueRef = useRef<SaveQueue | null>(null)
  saveQueueRef.current ??= new SaveQueue()
  const saveQueue = saveQueueRef.current

  useEffect(() => () => { saveQueue.dispose() }, [saveQueue])

  const buffers = useSyncExternalStore(
    useCallback(listener => registry.subscribe(listener), [registry]),
    useCallback(() => registry.getSnapshot(), [registry]),
  )

  const docs = useSyncExternalStore(
    useCallback(listener => documents.subscribe(listener), [documents]),
    useCallback(() => documents.getSnapshot(), [documents]),
  )

  const status = activePath === undefined ? undefined : registry.status(activePath)

  // Active diff mode resolution (ai-review outranks unsaved preview)
  const activeDiffMode = activePath ? diffModes[activePath] : undefined
  const effectiveDiffMode: DiffMode =
    activeDiffMode?.kind === 'ai-review'
      ? activeDiffMode
      : diffOpen && status?.kind === 'text'
        ? { kind: 'unsaved', baseline: status.diskDoc }
        : { kind: 'none' }

  /**
   * Push the current tree into the text buffer.
   *
   * The one place markdown crosses from tree to text. Called at moments the
   * operator can see — a save, or opening a view that reads text — never on a
   * keystroke, which is what used to fill the buffer's undo history with one
   * whole-document replacement per character typed.
   *
   * `addToHistory: false` because this is a projection, not an edit: there is
   * nothing here for anyone to step back through, and the tree's own history is
   * where undo belongs.
   */
  const projectMarkdown = useCallback(
    (
      path: string,
      stable: boolean,
      onFallback?: (reason: string) => void,
    ): string | undefined => {
      const md = stable
        ? documents.markdown(path, { forSave: true, onFallback })
        : documents.preview(path)
      if (md === undefined) return undefined
      registry.setText(path, md, { addToHistory: false })
      return md
    },
    [documents, registry],
  )

  useEffect(() => {
    // Prefers the tree for markdown: the buffer is only refreshed at visible
    // moments now, so it is the stale one between them.
    ;(window as any).__dsh_get_active_text = (p: string) =>
      documents.preview(p) ?? registry.getText(p)
    return () => {
      delete (window as any).__dsh_get_active_text
    }
  }, [documents, registry])

  // Load whatever the active tab needs. Reading `buffers.version` is what makes
  // this re-run after a load settles, so the editor mounts once the state exists.
  useEffect(() => {
    if (activePath === undefined) return
    if (registry.status(activePath) === undefined) void registry.load(activePath)
  }, [activePath, registry, buffers.version])

  // Open the WYSIWYG document once its text has landed. Parsing happens here,
  // exactly once per path, rather than inside the view's mount effect.
  useEffect(() => {
    if (activePath === undefined || !isMarkdown(activePath)) return
    if (documents.editor(activePath) !== undefined) return
    const buffer = registry.status(activePath)
    if (buffer?.kind !== 'text' || buffer.truncated) return
    const text = registry.getText(activePath)
    if (text === undefined) return
    documents.open(activePath, text)
  }, [activePath, documents, registry, buffers.version])

  /**
   * The actual save: project, write, rebase. Never call directly — always
   * through {@link save}, which queues this per path so a manual Cmd+S
   * landing mid-autosave for the same file runs after it, not alongside it.
   */
  const performSave = useCallback(async (path: string): Promise<boolean> => {
    setSaveState('saving')
    let fallbackReason: string | undefined
    // Markdown is written from the tree, through the fixed-point serializer, so
    // what reaches disk regenerates to itself.
    const written = isMarkdown(path)
      ? projectMarkdown(path, true, (reason) => {
          fallbackReason = reason
        })
      : undefined
    if (isMarkdown(path) && written === undefined) {
      const buffer = registry.status(path)
      if (buffer?.kind === 'text' && buffer.truncated) {
        setSaveState({ error: 'file too large (truncated)' })
        onNotify('Save skipped: file is too large and was truncated for performance')
      } else {
        setSaveState({ error: 'document not ready' })
        onNotify('Save skipped: the document is still opening')
      }
      return false
    }
    // Snapshotted *before* the write's await, not after: writeFile yields to
    // the event loop, and if the operator keeps typing during that gap the
    // live tree moves on. markSaved has to rebase against the tree `written`
    // actually came from, or those newer keystrokes get marked clean without
    // ever reaching disk.
    const savedDoc = isMarkdown(path) ? documents.snapshotDoc(path) : undefined
    const result = await registry.save(path)
    if (!result.ok) {
      setSaveState({ error: result.error })
      onNotify(`Save failed: ${result.error}`)
      return false
    }
    if (written !== undefined) documents.markSaved(path, written, savedDoc)
    if (fallbackReason) {
      onNotify(`Markdown saved with full canonical rewrite: ${fallbackReason}`)
    }
    setSaveState('saved')
    return true
  }, [documents, onNotify, projectMarkdown, registry])

  const save = useCallback(
    (path: string): Promise<boolean> => saveQueue.enqueue(path, () => performSave(path)),
    [performSave, saveQueue],
  )

  saveRef.current = (path) => { void save(path) }

  // Clear the transient "Saved ✓" mark; a failure stays until the next attempt.
  useAutoClear(saveState === 'saved', () => { setSaveState('idle') }, SAVED_MS)

  /**
   * Everything with unsaved edits, from whichever registry owns it.
   *
   * A markdown tab is dirty when its *tree* differs from what was parsed, which
   * the buffer cannot know any more: it only hears about the tree at save time.
   */
  const dirty = useMemo(() => {
    const all = new Set<string>()
    for (const path of buffers.dirty) {
      if (!isMarkdown(path)) all.add(path)
    }
    for (const path of docs.dirty) {
      all.add(path)
    }
    return all
  }, [buffers.dirty, docs.dirty])

  /** Paths under AI review, whether or not they are the active tab (see TabStrip). */
  const reviewingPaths = useMemo(() => {
    const paths = new Set<string>()
    for (const [path, mode] of Object.entries(diffModes)) {
      if (mode.kind === 'ai-review') paths.add(path)
    }
    return paths
  }, [diffModes])

  const [statsTick, setStatsTick] = useState(0)
  useEffect(() => {
    if (activePath === undefined || !isMarkdown(activePath)) return
    const ed = documents.editor(activePath)
    if (ed === undefined) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const onUpdate = () => {
      clearTimeout(timer)
      timer = setTimeout(() => { setStatsTick(t => t + 1) }, 250)
    }
    ed.on('update', onUpdate)
    return () => {
      clearTimeout(timer)
      ed.off('update', onUpdate)
    }
  }, [activePath, documents, docs.version])

  /** Live word and character stats for the active markdown document. */
  const markdownStats = useMemo(() => {
    if (activePath === undefined || !isMarkdown(activePath)) return undefined
    const ed = documents.editor(activePath)
    if (ed === undefined) return undefined
    const words = ed.storage.characterCount?.words?.() ?? 0
    const characters = ed.storage.characterCount?.characters?.() ?? 0
    const readingTime = Math.max(1, Math.ceil(words / 200))
    return { words, characters, readingTime }
  }, [activePath, documents, docs.version, statsTick])

  // Auto-save: one timer per dirty path (see saveQueue.ts) — editing file B
  // does not push back file A's already-pending save. Nothing here reads the
  // document; save() (queued, see above) projects and writes.
  useEffect(() => {
    if (!autoSave) {
      saveQueue.cancelAllAutosaves()
      return
    }
    saveQueue.reconcileAutosave(dirty, AUTOSAVE_MS, (path) => { void save(path) })
  }, [autoSave, dirty, save, saveQueue])

  // Git branch for the status bar, refreshed when the workspace changes.
  useEffect(() => {
    if (explorerRoot === undefined) return
    let live = true
    void (async () => {
      const result = await gitStatus(explorerRoot)
      if (!live || !result.ok) return
      setBranch(result.value.repo ? result.value.branch : undefined)
    })()
    return () => { live = false }
  }, [explorerRoot])

  /**
   * Drop a path from both registries — closing a tab ends its document.
   *
   * Also ends any review on it: without this, `diffModes`/`reviewStats`
   * outlived the tab, so reopening the same path later resurrected review
   * chrome against a baseline from whenever it was last touched, not the
   * file's actual current state.
   */
  const forget = useCallback((path: string) => {
    registry.forget(path)
    documents.forget(path)
    const sel = (window as any).__dsh_active_selection
    if (sel?.path === path) (window as any).__dsh_active_selection = null
    setDiffModes(prev => {
      if (!(path in prev)) return prev
      const next = { ...prev }
      delete next[path]
      return next
    })
    setReviewStats(prev => {
      if (!(path in prev)) return prev
      const next = { ...prev }
      delete next[path]
      return next
    })
  }, [documents, registry])

  // Registries must not outlive their tab. `requestClose`/`closeNow`/`applyBulk`
  // already forget before dropping a path from `tabs`, which makes this a
  // no-op for them — it exists to catch every OTHER way a path can leave the
  // strip (an explorer rename swapping one path for another via onSetTabs,
  // any future caller that forgets to) rather than requiring each one to
  // remember the same cleanup.
  const previousTabsRef = useRef<readonly string[]>(tabs)
  useEffect(() => {
    const previous = previousTabsRef.current
    previousTabsRef.current = tabs
    for (const path of previous) {
      if (!tabs.includes(path)) forget(path)
    }
  }, [tabs, forget])

  /** Close a tab, asking first when it would lose edits. */
  const requestClose = useCallback((path: string) => {
    if (registry.isDirty(path) || documents.isDirty(path)) {
      setPendingClose({ path, busy: false })
      return
    }
    forget(path)
    onSetTabs(tabModel.close(tabs, path), tabModel.activeAfterClose(tabs, path, activePath))
  }, [activePath, documents, forget, onSetTabs, registry, tabs])

  const closeNow = useCallback((path: string) => {
    forget(path)
    onSetTabs(tabModel.close(tabs, path), tabModel.activeAfterClose(tabs, path, activePath))
    setPendingClose(undefined)
  }, [activePath, forget, onSetTabs, tabs])

  /** Adopt a bulk-close result, forgetting every document that went away. */
  const applyBulk = useCallback((remaining: string[]) => {
    for (const path of tabs) if (!remaining.includes(path)) forget(path)
    onSetTabs(remaining, tabModel.activeAfterBulk(remaining, activePath))
  }, [activePath, forget, onSetTabs, tabs])

  const copyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path).then(
      () => { onNotify('Path copied') },
      () => { onNotify('Clipboard unavailable') },
    )
  }, [onNotify])

  // Global hooks for starting / stopping AI Code Reviews
  useEffect(() => {
    (window as any).__dsh_start_ai_review = async (
      targetPath: string,
      hunks: readonly { oldText: string | null; newText: string }[],
      turnId?: string,
    ) => {
      if (!Array.isArray(hunks) || hunks.length === 0) return

      // Snapshot whatever this path held BEFORE anything below touches it.
      // For a path that was already open, this is the exact pre-write text —
      // no reconstruction needed — and it is also the only place a conflict
      // with the operator's own unsaved edits can still be seen: once step 2
      // reads the (already post-write) disk, that information is gone.
      const preWriteBuffer = registry.status(targetPath)
      const preWriteMarkdownDirty = isMarkdown(targetPath) && documents.isDirty(targetPath)
      if ((preWriteBuffer?.kind === 'text' && preWriteBuffer.dirty) || preWriteMarkdownDirty) {
        onNotify(`AI đã sửa "${basename(targetPath)}", nhưng bạn có thay đổi chưa lưu ở đó — bản của AI chưa được áp dụng.`)
        return
      }

      // 1. Read the file's actual current content. Disk already holds the
      // AI's write by the time this runs, so it is the one reliable source
      // of the whole file — whether the supplied hunks are whole-file (a
      // create) or context-only fragments (an edit, or an overwrite of an
      // existing file, which produces fragments exactly like an edit does).
      const diskRes = await readFile(targetPath)
      if (!diskRes.ok) {
        onNotify(`AI review: không đọc được "${basename(targetPath)}" sau khi ghi`)
        return
      }
      const newContent = diskRes.value.content

      // 2. Resolve the pre-write baseline. The exact pre-write buffer when
      // this path was already open; otherwise reverse the hunks against the
      // post-write content one at a time (never derive it from any single
      // hunk's newText alone — for a create hunk that IS the whole file, but
      // for an edit/overwrite fragment it is not).
      let effectiveBaseline: string
      if (preWriteBuffer?.kind === 'text') {
        effectiveBaseline = preWriteBuffer.state.doc.toString()
      } else {
        const reconstructed = reconstructBaseline(newContent, hunks)
        if (!reconstructed.ok) {
          onNotify(`AI review: không thể tái tạo chính xác bản trước khi sửa của "${basename(targetPath)}"`)
        }
        effectiveBaseline = reconstructed.text
      }

      // 3. Ensure the tab exists, without activating it or moving focus —
      // this is an agent-initiated open, never a user gesture.
      if (!tabs.includes(targetPath)) {
        onOpenFileBackground(targetPath)
      }
      if (registry.status(targetPath) === undefined) {
        await registry.load(targetPath)
      }

      // 4. Adopt the AI's content. The active tab's mounted view owns its
      // own copy of the document — its dispatchTransactions writes it back
      // into the registry on every transaction (including the reconfigure
      // this same review triggers) — so a plain registry.setText here would
      // be silently reverted the moment that happens. Go through the live
      // view for the active tab; registry.setText is correct for a
      // background tab, which has no mounted view to revert it.
      if (targetPath === activePathRef.current && editorRef.current) {
        editorRef.current.applyExternalText(newContent)
      } else {
        registry.setText(targetPath, newContent, { addToHistory: false })
      }
      // Disk already holds newContent — rebase the comparison so this
      // adoption does not itself flag the file as unsaved (that would ask
      // the operator to "save" text already on disk, and would let a
      // reject-to-baseline compute clean against the wrong document).
      registry.rebaseDisk(targetPath, newContent)

      // 5. If markdown document, update TipTap document as well
      if (isMarkdown(targetPath)) {
        documents.reopen(targetPath, newContent)
        // Force the tree view: the raw view is read-only projection that
        // reject cannot write through (see onViewRaw's comment in the render
        // below), so a review must not open — or be left — showing it.
        setRawModes(prev => ({ ...prev, [targetPath]: false }))
      } else {
        // Non-markdown files switch to code editor view
        setRawModes(prev => ({ ...prev, [targetPath]: true }))
      }

      // 6. Activate AI review mode. Frontmatter lives outside the tree
      // entirely (splitFrontmatter strips it before anything parses the
      // body), so a body-only baseline made an AI edit that only touched
      // frontmatter invisible to review — zero hunks, nothing to accept or
      // reject, despite the file genuinely differing. `effectiveBaseline`
      // is already the pre-write file's full raw text; splitFrontmatter
      // just needs to read the header back off it.
      setDiffModes(prev => ({
        ...prev,
        [targetPath]: {
          kind: 'ai-review',
          baseline: effectiveBaseline,
          snapshots: [],
          turnId,
          frontmatterBaseline: isMarkdown(targetPath) ? splitFrontmatter(effectiveBaseline).frontmatter : undefined,
        },
      }))
    }

    (window as any).__dsh_hold_autosave = (targetPath: string) => {
      saveQueue.hold(targetPath)
    }

    (window as any).__dsh_release_autosave = (targetPath: string) => {
      saveQueue.release(targetPath)
    }

    return () => {
      delete (window as any).__dsh_start_ai_review
      delete (window as any).__dsh_hold_autosave
      delete (window as any).__dsh_release_autosave
    }
  }, [tabs, onOpenFileBackground, onNotify, registry, documents, saveQueue])

  // Seat the typed cross-tree review API — see reviewCommands.ts. This is
  // what lets TurnReviewCard (registered into a different slot entirely,
  // with no React path to this component) reach real accept/reject verbs
  // and real per-file line counts, instead of the untyped window globals
  // above (which only the capture pipeline in index.ts needs).
  useEffect(() => {
    const dispose = installReviewCommands({
      summaryForTurn: (turnId) => {
        const result: ReviewFileSummary[] = []
        for (const [path, mode] of Object.entries(diffModesRef.current)) {
          if (mode.kind !== 'ai-review' || mode.turnId !== turnId) continue
          const baseline = typeof mode.baseline === 'string' ? mode.baseline : mode.baseline.toString()
          const current = isMarkdown(path)
            ? (documents.preview(path) ?? registry.getText(path) ?? baseline)
            : (registry.getText(path) ?? baseline)
          const { added, removed } = computeLineSummary(baseline, current)
          result.push({ path, added, removed })
        }
        return result
      },
      acceptAll: (path) => {
        const isActive = path === activePathRef.current
        if (isMarkdown(path) && isActive && tipTapRef.current) tipTapRef.current.acceptAll()
        else if (!isMarkdown(path) && isActive && editorRef.current) editorRef.current.acceptAll()
        // Otherwise this is a background path: its content is already the
        // AI's version (adopted at review-start time), so there is nothing
        // to change — "accept" here is purely "stop tracking this review".
        setDiffModes(prev => {
          if (!(path in prev)) return prev
          const next = { ...prev }
          delete next[path]
          return next
        })
      },
      rejectAll: async (path) => {
        const mode = diffModesRef.current[path]
        if (!mode || mode.kind !== 'ai-review') return
        const baseline = typeof mode.baseline === 'string' ? mode.baseline : mode.baseline.toString()
        const isActive = path === activePathRef.current
        if (isMarkdown(path) && isActive && tipTapRef.current) {
          tipTapRef.current.rejectAll()
        } else if (!isMarkdown(path) && isActive && editorRef.current) {
          editorRef.current.rejectAll()
        } else {
          // Headless revert: no mounted view to carry the transaction.
          registry.setText(path, baseline)
          if (isMarkdown(path)) documents.reopen(path, baseline)
        }
        // Reject is a real content change (per the measured invariant, unlike
        // accept) and must reach disk — a same-content revert would compute
        // clean and silently never write, leaving disk holding the AI's
        // version while the screen shows the reverted one.
        await save(path)
        setDiffModes(prev => {
          if (!(path in prev)) return prev
          const next = { ...prev }
          delete next[path]
          return next
        })
      },
    })
    return dispose
  }, [documents, registry, save])

  // Seat `requestClose` for AppFrame's global Ctrl+W — see closeCommands.ts.
  // Without this, Ctrl+W closed tabs directly (via the tab-list store) with
  // no dirty check at all, bypassing the same unsaved-changes confirmation
  // TabStrip's own close button goes through.
  useEffect(() => installCloseCommand(requestClose), [requestClose])

  // Tell reviewCommands subscribers (TurnReviewCard instances) whenever
  // tracked review state actually changes — summaryForTurn reads
  // diffModesRef fresh on every call, so this only needs to trigger a
  // re-render, not carry any data itself.
  useEffect(() => {
    notifyReviewCommandsChanged()
  }, [diffModes])

  /** Throw away a tab's unsaved edits and go back to what is on disk. */
  const discard = useCallback((path: string) => {
    if (isMarkdown(path)) {
      // Queued behind any save already in flight for this path — the same
      // reason performSave is queued (see `save` above). A discard that ran
      // concurrently with an autosave's writeFile could reopen from the
      // pre-write disk snapshot while that write was still landing the
      // *discarded* text, which then reaches disk anyway once the write
      // settles, and documents.markSaved rebases the freshly-reopened
      // document against a tree from the editor `reopen` had already
      // destroyed. Queuing forces the save to fully land first, so discard
      // always reads whatever is genuinely on disk at that point.
      void saveQueue.enqueue(path, async () => {
        const buffer = registry.status(path)
        if (buffer?.kind !== 'text') return true
        // A markdown tab's edits live in the tree, and every text view of it
        // is read-only, so the revert cannot ride a transaction through the
        // view. Re-parse from disk — which does throw the undo history away,
        // and that is precisely what the operator asked for — and put the
        // same text back in the buffer so neither registry is left claiming
        // to be dirty.
        const disk = buffer.diskDoc.toString()
        documents.reopen(path, disk)
        registry.setText(path, disk, { addToHistory: false })
        return true
      })
      return
    }
    const buffer = registry.status(path)
    if (buffer?.kind !== 'text') return
    // Everything else goes through the live view, which keeps the revert itself
    // undoable: an accidental discard is recoverable with Ctrl+Z.
    const spec = registry.revertSpec(path)
    if (spec !== undefined) editorRef.current?.dispatch(spec)
  }, [documents, registry, saveQueue])

  const isImage = activePath !== undefined && /\.(png|jpe?g|gif|webp|svg|ico|bmp)$/i.test(activePath)
  const isCsv = activePath !== undefined && /\.(csv|tsv)$/i.test(activePath)
  const isHtml = activePath !== undefined && /\.(html|htm)$/i.test(activePath)
  const isMd = activePath !== undefined && isMarkdown(activePath)

  const isRaw = activePath !== undefined && (rawModes[activePath] ?? false)
  const isTruncated = status?.kind === 'text' && Boolean(status.truncated)
  // Mirrors the branch condition below that picks TipTap over CodeEditor —
  // whichever ref is actually mounted is where a review command must land.
  const usingTipTap = isMd && !isRaw && !diffOpen && !isTruncated

  /**
   * Every *text* view of a markdown file is read-only — raw and diff alike.
   *
   * With the tree as the authority, an editable text view would be a second
   * editable document over the same file: two undo histories, and an edit with
   * nowhere coherent to land. It would not even survive — the next projection
   * overwrites the buffer wholesale. Read-only makes the markdown/tree boundary
   * one-way, crossed only when projecting for a save or a view, which is what
   * lets Ctrl+Z mean one unambiguous thing.
   *
   * Both views keep doing what they are actually for: reading the markdown, and
   * seeing what a save would change. CSV and HTML raw modes are untouched; they
   * have no second document.
   */
  const mdTextReadOnly = (isMd && (isRaw || diffOpen)) || isTruncated

  /**
   * Reveal a text view of the active file, refreshing the buffer first.
   *
   * The projection has to happen *before* the state flip, not in an effect
   * afterwards: CodeMirror builds its view from `buffer.state` as it mounts, and
   * React runs a child's mount effect before the parent's. A projection that
   * ran after the flip would land in the registry while the view on screen had
   * already been built from the stale text — and the view's first `sync` would
   * then overwrite the projection with what it was showing.
   *
   * Cheap-once (no fixed-point hunt): nothing here is being written to disk.
   * @param flip - the state change that puts the text view on screen.
   */
  const showTextView = useCallback((flip: () => void) => {
    if (activePath !== undefined && isMarkdown(activePath)) projectMarkdown(activePath, false)
    flip()
  }, [activePath, projectMarkdown])

  const language = useMemo(() => {
    if (activePath === undefined) return undefined
    if (isImage) return 'Image Preview'
    if (isMd) return isRaw ? 'Markdown' : 'Markdown (TipTap)'
    if (isCsv) return isRaw ? 'CSV (Raw)' : 'CSV (Table)'
    if (isHtml) return isRaw ? 'HTML (Raw)' : 'HTML (Preview)'
    return languageName(activePath)
  }, [activePath, isCsv, isHtml, isImage, isMd, isRaw])

  // Every other path still under review from the same agent turn as the
  // active file — without this, accepting/dismissing the active file's
  // review left every sibling file in the same turn invisibly still
  // pending, with no way to tell from here that they existed.
  const turnPaths = useMemo(() => {
    const activeMode = activePath !== undefined ? diffModes[activePath] : undefined
    if (activeMode?.kind !== 'ai-review') return []
    const turnId = activeMode.turnId
    if (turnId === undefined) return []
    return Object.entries(diffModes)
      .filter(([, m]) => m.kind === 'ai-review' && m.turnId === turnId)
      .map(([p]) => p)
  }, [activePath, diffModes])

  return (
    <div className={css.column}>
      <TabStrip
        tabs={tabs}
        active={activePath}
        dirty={dirty}
        reviewing={reviewingPaths}
        onSelect={onOpenFile}
        onClose={requestClose}
        onCloseOthers={path => { applyBulk(tabModel.closeOthers(tabs, path)) }}
        onCloseToLeft={path => { applyBulk(tabModel.closeToLeft(tabs, path)) }}
        onCloseToRight={path => { applyBulk(tabModel.closeToRight(tabs, path)) }}
        onCloseAll={() => { applyBulk([]) }}
        onMove={onMoveTab}
        onCopyPath={copyPath}
      />

      {activePath !== undefined && (
        <Breadcrumb path={activePath} root={explorerRoot} onNavigate={onRevealDir} />
      )}

      {/*
        Docked once, here, regardless of which editor is live underneath —
        replaces two separate <FloatingReviewBar> instances (one per branch
        below) that duplicated every handler and could diverge, and that in
        the markdown branch had no positioned ancestor to float against.
      */}
      {activePath !== undefined && effectiveDiffMode.kind === 'ai-review' && (
        <FloatingReviewBar
          chunkCount={reviewStats[activePath]?.count ?? 0}
          canUndo={reviewStats[activePath]?.canUndo ?? false}
          onAcceptAll={() => {
            if (usingTipTap) tipTapRef.current?.acceptAll()
            else editorRef.current?.acceptAll()
          }}
          onRejectAll={() => {
            // Reject is a real content change (unlike accept, per the
            // measured invariant) and must reach disk, or the screen and
            // disk silently disagree from here on.
            if (usingTipTap) tipTapRef.current?.rejectAll()
            else editorRef.current?.rejectAll()
            void save(activePath)
          }}
          onUndo={() => {
            if (usingTipTap) tipTapRef.current?.undoReview()
            else editorRef.current?.undoReview()
          }}
          onPrevChunk={() => {
            if (usingTipTap) tipTapRef.current?.prevChunk()
            else editorRef.current?.prevChunk()
          }}
          onNextChunk={() => {
            if (usingTipTap) tipTapRef.current?.nextChunk()
            else editorRef.current?.nextChunk()
          }}
          onClose={() => {
            setDiffModes(prev => {
              const next = { ...prev }
              delete next[activePath]
              return next
            })
            if (dirty.has(activePath)) void save(activePath)
          }}
          turnStepper={turnPaths.length > 1
            ? {
                fileName: basename(activePath) || activePath,
                index: turnPaths.indexOf(activePath),
                total: turnPaths.length,
                onPrevFile: () => {
                  const i = turnPaths.indexOf(activePath)
                  onOpenFile(turnPaths[(i - 1 + turnPaths.length) % turnPaths.length]!)
                },
                onNextFile: () => {
                  const i = turnPaths.indexOf(activePath)
                  onOpenFile(turnPaths[(i + 1) % turnPaths.length]!)
                },
              }
            : undefined}
        />
      )}

      <div className={css.body}>
        {activePath === undefined && (
          <div className={css.empty}>
            <p>No file open</p>
            <p className={css.hint}>Pick one from the Explorer, or press Ctrl+P.</p>
          </div>
        )}
        {status?.kind === 'loading' && (
          <div className={css.notice} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Spinner size="xs" /> Opening…
          </div>
        )}
        {status?.kind === 'error' && <div className={css.notice} data-error>Cannot open this file: {status.message}</div>}
        {isImage && activePath !== undefined && (
          // key={activePath}: without it, switching between two image tabs
          // reused the same component instance — the previous image's zoom
          // level and reported dimensions stayed on screen until the new
          // <img>'s onLoad fired, same reason CodeEditor/TipTapEditor below
          // are keyed the same way.
          <ImagePreview key={activePath} path={activePath} size={status && 'size' in status ? status.size : undefined} />
        )}
        {!isImage && status?.kind === 'binary' && (
          <div className={css.notice}>Binary file — no preview ({status.size.toLocaleString()} bytes).</div>
        )}
        {!isImage && status?.kind === 'text' && activePath !== undefined && (
          isMd && !isRaw && !diffOpen && !isTruncated
            ? (
              <div className={css.editor}>
                {/*
                  Gated on the document existing. `TipTapEditor` attaches in an
                  effect keyed to `[documents, path]`, so it gets exactly one
                  chance to find the document — mounting it before the open
                  effect has run would leave it permanently blank. `docs.version`
                  re-renders us the moment the document lands.
                */}
                {documents.editor(activePath) !== undefined
                  ? (
                    <TipTapEditor
                      ref={tipTapRef}
                      key={`${activePath}#${documents.epoch(activePath)}`}
                      path={activePath}
                      root={explorerRoot}
                      openTabs={tabs}
                      documents={documents}
                      revealLine={activeLine}
                      diffBaseline={effectiveDiffMode.kind === 'ai-review' ? (typeof effectiveDiffMode.baseline === 'string' ? effectiveDiffMode.baseline : effectiveDiffMode.baseline.toString()) : undefined}
                      frontmatterBaseline={effectiveDiffMode.kind === 'ai-review' ? effectiveDiffMode.frontmatterBaseline : undefined}
                      onAcceptFrontmatter={() => {
                        // Frontmatter already holds the AI's version — same
                        // "accept never touches content" invariant as the
                        // body. Just stop tracking it as changed.
                        const current = documents.frontmatter(activePath)
                        setDiffModes(prev => {
                          const mode = prev[activePath]
                          if (mode?.kind !== 'ai-review') return prev
                          return { ...prev, [activePath]: { ...mode, frontmatterBaseline: current } }
                        })
                      }}
                      onRejectFrontmatter={() => {
                        const mode = diffModesRef.current[activePath]
                        if (mode?.kind !== 'ai-review' || mode.frontmatterBaseline === undefined) return
                        // A real content change, same as a body reject — must
                        // reach disk, or the screen and disk disagree.
                        documents.setFrontmatter(activePath, mode.frontmatterBaseline)
                        void save(activePath)
                      }}
                      onReviewStatsChange={handleReviewStatsChange}
                      onSave={(p) => { void save(p) }}
                      onViewRaw={() => {
                        // The raw view is a read-only CodeMirror projection of
                        // the tree, refreshed from it on every save/view-flip
                        // (projectMarkdown). A per-hunk reject there edits
                        // only that projection — the tree, which is what
                        // actually gets saved, never changes — so the very
                        // next projection would silently restore the AI's
                        // text, making the reject look like it worked and
                        // then quietly reverse itself. Simplest correct fix:
                        // stay in the tree view (where reject genuinely
                        // writes back) for as long as a review is open.
                        if (effectiveDiffMode.kind === 'ai-review') {
                          onNotify('Không thể xem bản thô khi đang review — hãy Accept/Reject xong trước.')
                          return
                        }
                        showTextView(() => {
                          setRawModes(prev => ({ ...prev, [activePath]: true }))
                        })
                      }}
                    />
                  )
                  : (
                    <div className={css.notice} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Spinner size="xs" /> Opening…
                    </div>
                  )}
              </div>
            )
            : isCsv && !isRaw && !diffOpen && !isTruncated
              ? (
                <div className={css.editor}>
                  <CsvPreview
                    content={status.state.doc.toString()}
                    isTsv={activePath.endsWith('.tsv')}
                    onToggleRaw={() => {
                      setRawModes(prev => ({ ...prev, [activePath]: true }))
                    }}
                  />
                </div>
              )
              : isHtml && !isRaw && !diffOpen && !isTruncated
                ? (
                  <div className={css.editor}>
                    <HtmlPreview
                      content={status.state.doc.toString()}
                      title={basename(activePath)}
                      onToggleRaw={() => {
                        setRawModes(prev => ({ ...prev, [activePath]: true }))
                      }}
                    />
                  </div>
                )
                : (
                  <div className={css.editor} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, position: 'relative' }}>
                    {isTruncated && (
                      <div className={css.notice} data-error style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', margin: 0 }}>
                        File quá lớn ({status.size.toLocaleString()} bytes) — chỉ hiển thị phần đầu, chế độ chỉ đọc.
                      </div>
                    )}
                    {diffOpen && (
                      <DiffView
                        path={activePath}
                        diskDoc={status.diskDoc}
                        currentDoc={status.state.doc}
                        onAccept={() => { void save(activePath).then(ok => { if (ok) setDiffOpen(false) }) }}
                        onDiscard={() => { discard(activePath); setDiffOpen(false) }}
                        onClose={() => { setDiffOpen(false) }}
                      />
                    )}
                    {(isMd || isCsv || isHtml) && !diffOpen && !isTruncated && (
                      <div style={{ position: 'absolute', top: 6, right: 16, zIndex: 20 }}>
                        <button
                          type="button"
                          style={{
                            background: 'var(--dsw-alias-bg-elevated, #ffffff)',
                            border: '1px solid var(--dsw-alias-border-l1, #cbd5e1)',
                            borderRadius: 4,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            color: 'var(--dsw-alias-state-business-primary, #2563eb)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                          }}
                          onClick={() => {
                            setRawModes(prev => ({ ...prev, [activePath]: false }))
                          }}
                        >
                          {isMd ? '📝 Switch to Notion WYSIWYG' : isCsv ? '📊 Switch to Table' : '🌐 Switch to Preview'}
                        </button>
                      </div>
                    )}
                    <div style={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <CodeEditor
                        ref={editorRef}
                        key={activePath}
                        path={activePath}
                        registry={registry}
                        revealLine={activeLine}
                        diffMode={effectiveDiffMode}
                        readOnly={mdTextReadOnly}
                        onCursor={setCursor}
                        onReviewStatsChange={handleReviewStatsChange}
                      />
                    </div>
                  </div>
                )
        )}
      </div>

      <StatusBar
        branch={branch}
        cursor={status?.kind === 'text' ? cursor : undefined}
        lines={status?.kind === 'text' ? status.state.doc.lines : undefined}
        characters={markdownStats ? markdownStats.characters : status?.kind === 'text' ? status.state.doc.length : undefined}
        words={markdownStats?.words}
        readingTime={markdownStats?.readingTime}
        language={language}
        readOnly={status?.kind === 'text' && status.truncated}
        autoSave={autoSave}
        onToggleAutoSave={onToggleAutoSave}
        diffOpen={diffOpen || effectiveDiffMode.kind === 'ai-review'}
        onToggleDiff={activePath !== undefined && dirty.has(activePath) && effectiveDiffMode.kind !== 'ai-review'
          ? () => { showTextView(() => { setDiffOpen(open => !open) }) }
          : undefined}
        saveState={saveState}
      />

      {pendingClose !== undefined && (
        <Dialog
          title="Unsaved changes"
          message={`"${basename(pendingClose.path) || pendingClose.path}" has changes that are not written to disk.`}
          busy={pendingClose.busy}
          error={pendingClose.error}
          actions={[
            { label: 'Cancel', cancel: true, onSelect: () => { setPendingClose(undefined) } },
            {
              label: "Don't Save",
              danger: true,
              onSelect: () => { closeNow(pendingClose.path) },
            },
            {
              label: 'Save',
              primary: true,
              onSelect: () => {
                setPendingClose({ path: pendingClose.path, busy: true })
                void save(pendingClose.path).then((ok) => {
                  if (ok) closeNow(pendingClose.path)
                  // A refused write must not close the tab: that would discard
                  // exactly the work the operator asked to keep.
                  else setPendingClose({ path: pendingClose.path, busy: false, error: 'Could not save. The file was not closed.' })
                })
              },
            },
          ]}
        />
      )}
    </div>
  )
}

/** Open the search panel, which carries the replace row. */
function openSearch(view: EditorView): boolean {
  // `search({top: true})` installs the panel; the keymap's own command is the
  // sanctioned way to raise it.
  const command = searchKeymap.find(binding => binding.key === 'Mod-f')?.run
  return command === undefined ? false : command(view)
}
