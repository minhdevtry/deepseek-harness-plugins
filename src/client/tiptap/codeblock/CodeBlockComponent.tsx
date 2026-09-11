/**
 * React NodeView for CodeBlockLowlight.
 *
 * Provides a dedicated language picker, 1-click Copy button, and
 * real-time Live Sandbox Preview for HTML / SVG / XML blocks.
 */
import { useState, useMemo } from 'react'
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react'

const SUPPORTED_LANGUAGES = [
  'plaintext',
  'typescript',
  'javascript',
  'python',
  'html',
  'svg',
  'xml',
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

const PREVIEWABLE_LANGUAGES = new Set(['html', 'svg', 'xml'])

export function CodeBlockComponent({
  node,
  updateAttributes,
}: NodeViewProps) {
  const [copied, setCopied] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const defaultLanguage = (node.attrs.language || 'plaintext').toLowerCase()
  const isPreviewable = PREVIEWABLE_LANGUAGES.has(defaultLanguage)

  const copyCode = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const text = node.textContent
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => { setCopied(false) }, 1500)
    })
  }

  const liveContent = useMemo(() => {
    return node.textContent
  }, [node.textContent])

  return (
    <NodeViewWrapper className="tiptap-codeblock-wrapper">
      <div className="tiptap-codeblock-header" contentEditable={false}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            className="tiptap-codeblock-lang"
            value={defaultLanguage}
            onChange={e => {
              const nextLang = e.target.value
              updateAttributes({ language: nextLang })
              if (!PREVIEWABLE_LANGUAGES.has(nextLang.toLowerCase())) {
                setPreviewMode(false)
              }
            }}
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

          {isPreviewable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                type="button"
                className={`tiptap-codeblock-tab-btn ${!previewMode ? 'active' : ''}`}
                onClick={() => setPreviewMode(false)}
              >
                Code
              </button>
              <button
                type="button"
                className={`tiptap-codeblock-tab-btn ${previewMode ? 'active' : ''}`}
                onClick={() => setPreviewMode(true)}
              >
                👁 Live Preview
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className={`tiptap-codeblock-copy ${copied ? 'copied' : ''}`}
          onClick={copyCode}
          title="Copy code to clipboard"
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>

      {previewMode && isPreviewable && (
        <div className="tiptap-codeblock-sandbox-preview" contentEditable={false}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--dsw-alias-state-business-primary, #2563eb)',
            }}
          >
            <span>⚡ LIVE SANDBOX</span>
            <span style={{ fontSize: 10, color: 'var(--dsw-alias-text-secondary, #64748b)' }}>
              isolated sandbox
            </span>
          </div>
          <iframe
            className="tiptap-codeblock-sandbox-iframe"
            title="Live Sandbox Preview"
            sandbox="allow-scripts"
            srcDoc={liveContent}
          />
        </div>
      )}

      <pre style={{ display: previewMode ? 'none' : 'block' }}>
        <NodeViewContent<any> as="code" />
      </pre>
    </NodeViewWrapper>
  )
}
