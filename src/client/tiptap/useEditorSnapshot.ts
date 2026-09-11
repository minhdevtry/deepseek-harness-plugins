/**
 * Re-render whenever the editor's state changes.
 *
 * Anything that reads `editor.can()`, `editor.isActive()` or
 * `editor.storage.*` during render needs this: the DocumentRegistry only
 * republishes when the *dirty set* changes (see documents.ts #bump), which is
 * once per document, not once per keystroke.
 */
import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'

export function useEditorSnapshot(editor: Editor | null | undefined): number {
  const version = useRef(0)
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!editor || editor.isDestroyed) return () => {}
      const bump = () => {
        version.current += 1
        listener()
      }
      editor.on('transaction', bump)
      return () => {
        editor.off('transaction', bump)
      }
    },
    [editor],
  )
  return useSyncExternalStore(subscribe, () => version.current)
}

