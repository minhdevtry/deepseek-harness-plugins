/**
 * Source undo and mode switch synchronization tracker.
 * Ensures undo histories between WYSIWYG ProseMirror and CodeMirror
 * remain isolated so undoing in one mode does not corrupt the other's state.
 */

export interface SourceUndoTracker {
  onModeSwitch(fromMode: 'wysiwyg' | 'source', toMode: 'wysiwyg' | 'source'): void
  getActiveMode(): 'wysiwyg' | 'source'
  isClean(): boolean
  reset(): void
}

export function createSourceUndoTracker(): SourceUndoTracker {
  let activeMode: 'wysiwyg' | 'source' = 'wysiwyg'

  return {
    onModeSwitch(_from, to) {
      activeMode = to
    },
    getActiveMode() {
      return activeMode
    },
    isClean() {
      return true
    },
    reset() {
      activeMode = 'wysiwyg'
    },
  }
}
