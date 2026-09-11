/**
 * CodeMirror theme and syntax colours, expressed entirely in CSS variables.
 *
 * Nothing here reads the current theme, and no extension is rebuilt when the
 * operator switches light/dark. Every colour is a `var(--…)` reference, so the
 * palette follows whatever the theme presenter last wrote onto `body` — the
 * same mechanism the rest of the frame uses.
 *
 * That choice matters beyond tidiness: a theme-dependent extension set would
 * have to be swapped at runtime, and swapping extensions means rebuilding each
 * `EditorState` — which would throw away every tab's undo history on a theme
 * toggle. Syntax variables themselves are declared in `CodeEditor.module.css`.
 */
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

/** Chrome: surfaces, gutters, selection, cursor, search matches, scrollbars. */
const chrome = EditorView.theme({
  '&': {
    height: '100%',
    maxHeight: '100%',
    color: 'var(--dsw-alias-label-primary)',
    backgroundColor: 'var(--dsw-alias-bg-base)',
    fontSize: '13px',
  },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    lineHeight: '1.6',
    overflow: 'auto !important',
    height: '100%',
    maxHeight: '100%',
  },
  '.cm-content': {
    caretColor: 'var(--dsw-alias-state-business-primary)',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--dsw-alias-state-business-primary)' },

  // The editor is not always the focused element (the chat panel may be), but a
  // selection still has to stay visible — an invisible selection makes
  // "replace all in selection" feel broken.
  '.cm-selectionBackground': { backgroundColor: 'var(--vsc-selection-blur)' },
  '&.cm-focused .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--vsc-selection)',
  },

  '.cm-gutters': {
    backgroundColor: 'var(--dsw-alias-bg-base)',
    color: 'var(--dsw-alias-label-tertiary)',
    borderRight: '1px solid var(--dsw-alias-border-l1)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--dsw-alias-interactive-bg-hover)',
    color: 'var(--dsw-alias-label-primary)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--vsc-active-line)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 12px' },

  '.cm-selectionMatch': { backgroundColor: 'var(--vsc-match)' },
  '.cm-searchMatch': {
    backgroundColor: 'var(--vsc-match)',
    outline: '1px solid var(--dsw-alias-border-l3)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--vsc-match-active)' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'var(--vsc-match)',
    outline: '1px solid var(--dsw-alias-border-l3)',
  },

  // Per-hunk diff styling for unifiedMergeView
  '.cm-deletedChunk, .cm-deletedLine': {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  '.cm-insertedLine, .cm-changedChunk': {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  '.cm-merge-control': {
    cursor: 'pointer',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '11px',
    fontWeight: '600',
  },

  // The stock search panel is a plain form; give it the frame's surface so it
  // does not read as a browser artefact sitting on top of the editor.
  '.cm-panels': {
    backgroundColor: 'var(--dsw-alias-bg-base)',
    color: 'var(--dsw-alias-label-primary)',
    borderTop: '1px solid var(--dsw-alias-border-l1)',
  },
  '.cm-panel.cm-search input, .cm-panel.cm-search button, .cm-panel.cm-search label': {
    fontFamily: 'inherit',
    fontSize: '12px',
  },
  '.cm-panel.cm-search input': {
    color: 'var(--dsw-alias-label-primary)',
    backgroundColor: 'var(--dsw-alias-bg-base)',
    border: '1px solid var(--dsw-alias-border-l2)',
    borderRadius: '4px',
    padding: '2px 6px',
  },
  '.cm-panel.cm-search button': {
    color: 'var(--dsw-alias-label-primary)',
    backgroundColor: 'transparent',
    backgroundImage: 'none',
    border: '1px solid var(--dsw-alias-border-l2)',
    borderRadius: '4px',
    padding: '2px 8px',
    cursor: 'pointer',
  },
})

/**
 * Token colours.
 *
 * Grouped by what a reader actually distinguishes at a glance — keywords,
 * literals, names, comments — rather than one variable per Lezer tag, which
 * would be a palette nobody can keep coherent across two themes.
 */
const highlight = HighlightStyle.define([
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: 'var(--vsc-syn-comment)', fontStyle: 'italic' },
  { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword, tags.operatorKeyword], color: 'var(--vsc-syn-keyword)' },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'var(--vsc-syn-string)' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--vsc-syn-number)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName], color: 'var(--vsc-syn-function)' },
  { tag: [tags.typeName, tags.className, tags.namespace, tags.standard(tags.typeName)], color: 'var(--vsc-syn-type)' },
  { tag: [tags.propertyName, tags.attributeName], color: 'var(--vsc-syn-property)' },
  { tag: [tags.variableName, tags.definition(tags.variableName), tags.local(tags.variableName)], color: 'var(--vsc-syn-variable)' },
  { tag: [tags.operator, tags.punctuation, tags.separator, tags.bracket], color: 'var(--vsc-syn-punctuation)' },
  { tag: [tags.tagName, tags.angleBracket], color: 'var(--vsc-syn-tag)' },
  { tag: [tags.meta, tags.processingInstruction, tags.annotation], color: 'var(--vsc-syn-meta)' },
  { tag: tags.invalid, color: 'var(--dsw-alias-state-error-primary)' },

  // Markdown, which this frame opens as text until the WYSIWYG surface lands.
  { tag: tags.heading, color: 'var(--vsc-syn-keyword)', fontWeight: '700' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--vsc-syn-function)', textDecoration: 'underline' },
  { tag: tags.monospace, color: 'var(--vsc-syn-string)' },
])

/** The full presentation extension: chrome plus token colours. */
export function editorTheme(): Extension {
  return [chrome, syntaxHighlighting(highlight)]
}
