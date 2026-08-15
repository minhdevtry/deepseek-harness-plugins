/**
 * The centre column: tab strip, breadcrumb, editor, status bar.
 *
 * Owns the `BufferRegistry` and turns gestures into calls on it; the tab list
 * itself lives in the frame store, because the explorer highlights the active
 * path too. List arithmetic is delegated to `model/tabs.ts` so the closing
 * rules stay assertable without mounting anything.
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
import { gitStatus } from '../api/files.ts'
import { Dialog } from '../ui/Dialog.tsx'
import { BufferRegistry } from './buffers.ts'
import { languageExtension, languageName } from './language.ts'
import { editorTheme } from './theme.ts'
import { CodeEditor, type CodeEditorHandle, type CursorInfo } from './CodeEditor.tsx'
import { TabStrip } from './TabStrip.tsx'
import { Breadcrumb } from './Breadcrumb.tsx'
import { StatusBar } from './StatusBar.tsx'
import { DiffView } from './DiffView.tsx'
import { TipTapEditor } from '../tiptap/TipTapEditor.tsx'
import { ImagePreview } from './previews/ImagePreview.tsx'
import { CsvPreview } from './previews/CsvPreview.tsx'
import { HtmlPreview } from './previews/HtmlPreview.tsx'
import * as tabModel from './model/tabs.ts'
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
  onOpenFile, onSetTabs, onMoveTab, onToggleAutoSave, onRevealDir, onNotify,
}: WorkbenchProps) {
  const [cursor, setCursor] = useState<CursorInfo | undefined>(undefined)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | { error: string }>('idle')
  const [pendingClose, setPendingClose] = useState<PendingClose | undefined>(undefined)
  const [diffOpen, setDiffOpen] = useState(false)
  const [branch, setBranch] = useState<string | undefined>(undefined)
  const [rawModes, setRawModes] = useState<Record<string, boolean>>({})

  // Latest-callback ref: the Ctrl+S binding is baked into every EditorState at
  // creation, so it must reach the *current* save handler, not the one that
  // existed when the first file opened.
  const saveRef = useRef<(path: string) => void>(() => {})
  const editorRef = useRef<CodeEditorHandle | null>(null)

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

  const buffers = useSyncExternalStore(
    useCallback(listener => registry.subscribe(listener), [registry]),
    useCallback(() => registry.getSnapshot(), [registry]),
  )

  const status = activePath === undefined ? undefined : registry.status(activePath)

  // Load whatever the active tab needs. Reading `buffers.version` is what makes
  // this re-run after a load settles, so the editor mounts once the state exists.
  useEffect(() => {
    if (activePath === undefined) return
    if (registry.status(activePath) === undefined) void registry.load(activePath)
  }, [activePath, registry, buffers.version])

  const save = useCallback(async (path: string): Promise<boolean> => {
    setSaveState('saving')
    const result = await registry.save(path)
    if (!result.ok) {
      setSaveState({ error: result.error })
      onNotify(`Save failed: ${result.error}`)
      return false
    }
    setSaveState('saved')
    return true
  }, [onNotify, registry])

  saveRef.current = (path) => { void save(path) }

  // Clear the transient "Saved ✓" mark; a failure stays until the next attempt.
  useEffect(() => {
    if (saveState !== 'saved') return
    const timer = setTimeout(() => { setSaveState('idle') }, SAVED_MS)
    return () => { clearTimeout(timer) }
  }, [saveState])

  // Auto-save: debounced per dirty path, and re-armed whenever the dirty set
  // changes. Nothing here reads the document — the registry writes what it holds.
  useEffect(() => {
    if (!autoSave || buffers.dirty.size === 0) return
    const timer = setTimeout(() => {
      for (const path of buffers.dirty) void save(path)
    }, AUTOSAVE_MS)
    return () => { clearTimeout(timer) }
  }, [autoSave, buffers, save])

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

  /** Close a tab, asking first when it would lose edits. */
  const requestClose = useCallback((path: string) => {
    if (registry.isDirty(path)) { setPendingClose({ path, busy: false }); return }
    registry.forget(path)
    onSetTabs(tabModel.close(tabs, path), tabModel.activeAfterClose(tabs, path, activePath))
  }, [activePath, onSetTabs, registry, tabs])

  const closeNow = useCallback((path: string) => {
    registry.forget(path)
    onSetTabs(tabModel.close(tabs, path), tabModel.activeAfterClose(tabs, path, activePath))
    setPendingClose(undefined)
  }, [activePath, onSetTabs, registry, tabs])

  /** Adopt a bulk-close result, forgetting every buffer that went away. */
  const applyBulk = useCallback((remaining: string[]) => {
    for (const path of tabs) if (!remaining.includes(path)) registry.forget(path)
    onSetTabs(remaining, tabModel.activeAfterBulk(remaining, activePath))
  }, [activePath, onSetTabs, registry, tabs])

  const copyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path).then(
      () => { onNotify('Path copied') },
      () => { onNotify('Clipboard unavailable') },
    )
  }, [onNotify])

  /** Restore the disk text through the live view, so the revert stays undoable. */
  const discard = useCallback((path: string) => {
    const spec = registry.revertSpec(path)
    if (spec === undefined) return
    editorRef.current?.dispatch(spec)
  }, [registry])

  const dirty = buffers.dirty
  const isImage = activePath !== undefined && /\.(png|jpe?g|gif|webp|svg|ico|bmp)$/i.test(activePath)
  const isCsv = activePath !== undefined && /\.(csv|tsv)$/i.test(activePath)
  const isHtml = activePath !== undefined && /\.(html|htm)$/i.test(activePath)
  const isMd = activePath !== undefined && /\.(md|markdown)$/i.test(activePath)

  const isRaw = activePath !== undefined && (rawModes[activePath] ?? false)

  const language = useMemo(() => {
    if (activePath === undefined) return undefined
    if (isImage) return 'Image Preview'
    if (isMd) return isRaw ? 'Markdown' : 'Markdown (TipTap)'
    if (isCsv) return isRaw ? 'CSV (Raw)' : 'CSV (Table)'
    if (isHtml) return isRaw ? 'HTML (Raw)' : 'HTML (Preview)'
    return languageName(activePath)
  }, [activePath, isCsv, isHtml, isImage, isMd, isRaw])

  return (
    <div className={css.column}>
      <TabStrip
        tabs={tabs}
        active={activePath}
        dirty={dirty}
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

      <div className={css.body}>
        {activePath === undefined && (
          <div className={css.empty}>
            <p>No file open</p>
            <p className={css.hint}>Pick one from the Explorer, or press Ctrl+P.</p>
          </div>
        )}
        {status?.kind === 'loading' && <div className={css.notice}>Opening…</div>}
        {status?.kind === 'error' && <div className={css.notice} data-error>Cannot open this file: {status.message}</div>}
        {isImage && activePath !== undefined && (
          <ImagePreview path={activePath} size={status && 'size' in status ? status.size : undefined} />
        )}
        {!isImage && status?.kind === 'binary' && (
          <div className={css.notice}>Binary file — no preview ({status.size.toLocaleString()} bytes).</div>
        )}
        {!isImage && status?.kind === 'text' && activePath !== undefined && (
          isMd && !isRaw && !diffOpen
            ? (
              <div className={css.editor}>
                <TipTapEditor
                  key={activePath}
                  path={activePath}
                  registry={registry}
                  onSave={(p) => { void save(p) }}
                  onToggleRawMode={() => {
                    setRawModes(prev => ({ ...prev, [activePath]: true }))
                  }}
                  isRawMode={false}
                />
              </div>
            )
            : isCsv && !isRaw && !diffOpen
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
              : isHtml && !isRaw && !diffOpen
                ? (
                  <div className={css.editor}>
                    <HtmlPreview
                      content={status.state.doc.toString()}
                      title={activePath.split('/').pop()}
                      onToggleRaw={() => {
                        setRawModes(prev => ({ ...prev, [activePath]: true }))
                      }}
                    />
                  </div>
                )
                : (
                  <div className={css.editor} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, position: 'relative' }}>
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
                    {(isMd || isCsv || isHtml) && !diffOpen && (
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
                        diffOriginal={diffOpen ? status.diskDoc : undefined}
                        onCursor={setCursor}
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
        characters={status?.kind === 'text' ? status.state.doc.length : undefined}
        language={language}
        readOnly={status?.kind === 'text' && status.truncated}
        autoSave={autoSave}
        onToggleAutoSave={onToggleAutoSave}
        diffOpen={diffOpen}
        onToggleDiff={activePath !== undefined && dirty.has(activePath)
          ? () => { setDiffOpen(open => !open) }
          : undefined}
        saveState={saveState}
      />

      {pendingClose !== undefined && (
        <Dialog
          title="Unsaved changes"
          message={`"${pendingClose.path.split('/').pop() ?? pendingClose.path}" has changes that are not written to disk.`}
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
