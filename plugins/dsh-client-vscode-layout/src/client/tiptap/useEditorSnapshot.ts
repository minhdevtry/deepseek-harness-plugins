/**
 * Re-render whenever the editor's state changes.
 *
 * Anything that reads `editor.can()`, `editor.isActive()` or
 * `editor.storage.*` during render needs this: the DocumentRegistry only
 * republishes when the *dirty set* changes (see documents.ts #bump), which is
 * once per document, not once per keystroke.
 */
import { useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'

export function useEditorSnapshot(editor: Editor | null | undefined): number {
  return useSyncExternalStore(
    (listener) => {
      if (!editor || editor.isDestroyed) return () => {}
      editor.on('transaction', listener)
      return () => {
        editor.off('transaction', listener)
      }
    },
    () =>
      editor && !editor.isDestroyed
        ? editor.state.doc.nodeSize + editor.state.selection.from
        : 0,
  )
}
