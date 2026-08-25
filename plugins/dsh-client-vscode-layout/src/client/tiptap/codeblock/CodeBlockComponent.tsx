/**
 * React NodeView for CodeBlockLowlight.
 *
 * Provides a dedicated language picker and reliable Copy button, isolated
 * inside a React NodeView so ProseMirror's MutationObserver never mistakes
 * UI chrome for user document edits.
 */
import { useState } from 'react'
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react'

const SUPPORTED_LANGUAGES = [
  'plaintext',
  'typescript',
  'javascript',
  'python',
  'html',
  'css',
  'json',
  'markdown',
  'bash',
  'shell',
  'sql',
  'rust',
  'go',
  'c',
  'cpp',
  'yaml',
  'dockerfile',
] as const

export function CodeBlockComponent({
  node,
  updateAttributes,
}: NodeViewProps) {
  const [copied, setCopied] = useState(false)
  const defaultLanguage = node.attrs.language || 'plaintext'

  const copyCode = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const text = node.textContent
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => { setCopied(false) }, 1500)
    })
  }

  return (
    <NodeViewWrapper className="tiptap-codeblock-wrapper">
      <div className="tiptap-codeblock-header" contentEditable={false}>
        <select
          className="tiptap-codeblock-lang"
          value={defaultLanguage}
          onChange={e => { updateAttributes({ language: e.target.value }) }}
        >
          {SUPPORTED_LANGUAGES.map(lang => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
          {!SUPPORTED_LANGUAGES.includes(defaultLanguage as any) && defaultLanguage && (
            <option value={defaultLanguage}>{defaultLanguage}</option>
          )}
        </select>
        <button
          type="button"
          className={`tiptap-codeblock-copy ${copied ? 'copied' : ''}`}
          onClick={copyCode}
          title="Copy code to clipboard"
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>
      <pre>
        <NodeViewContent<any> as="code" />
      </pre>
    </NodeViewWrapper>
  )
}
