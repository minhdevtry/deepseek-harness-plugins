import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import { renderMermaidSvg } from './mermaidService.ts'
import { copyPngToClipboard, downloadSvg } from './mermaidExport.ts'
import { MermaidZoomModal } from './MermaidZoomModal.tsx'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: {
      setMermaid: (options?: { code?: string }) => ReturnType
    }
  }
}

const DEFAULT_MERMAID_CHART = `graph TD
  A[Client Webview] -->|Actions| B(TipTap Editor)
  B -->|Markdown Storage| C[(BufferRegistry)]
  C -->|Sync File System| D[dsh-host-files]
  B -->|Render Live| E[Mermaid 2.0 Engine]`

function MermaidNodeComponent(props: any) {
  const code = props.node.attrs.code || DEFAULT_MERMAID_CHART
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(code)
  const [svgHtml, setSvgHtml] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [isZoomOpen, setIsZoomOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const isDark = document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('vscode-dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches

    renderMermaidSvg(code, isDark)
      .then((svg) => {
        if (cancelled) return
        setSvgHtml(svg)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setSvgHtml('')
      })

    return () => {
      cancelled = true
    }
  }, [code])

  const handleApply = () => {
    props.updateAttributes({ code: editValue })
    setIsEditing(false)
  }

  const handleCopyPng = async () => {
    const el = containerRef.current?.querySelector('svg')
    if (!el) return
    try {
      await copyPngToClipboard(el)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (e) {
      console.error(e)
    }
  }

  const handleDownloadSvg = () => {
    const el = containerRef.current?.querySelector('svg')
    if (!el) return
    downloadSvg(el, 'diagram.svg')
  }

  return (
    <NodeViewWrapper className="tiptap-mermaid-wrapper" contentEditable={false}>
      <div className="tiptap-mermaid-toolbar">
        <div className="tiptap-mermaid-title">
          <span>📊 Mermaid Diagram</span>
        </div>
        <div className="tiptap-mermaid-actions">
          <button
            type="button"
            className="tiptap-mermaid-btn"
            onClick={() => setIsEditing((prev) => !prev)}
            title={isEditing ? 'View Diagram' : 'Edit Mermaid Code'}
          >
            {isEditing ? '👁 View' : '✏️ Edit'}
          </button>
          <button
            type="button"
            className="tiptap-mermaid-btn"
            onClick={handleCopyPng}
            disabled={!svgHtml}
            title="Copy 2x HD PNG to clipboard"
          >
            {isCopied ? '✓ Copied PNG' : '📋 Copy PNG'}
          </button>
          <button
            type="button"
            className="tiptap-mermaid-btn"
            onClick={handleDownloadSvg}
            disabled={!svgHtml}
            title="Download SVG vector file"
          >
            📥 SVG
          </button>
          <button
            type="button"
            className="tiptap-mermaid-btn"
            onClick={() => setIsZoomOpen(true)}
            disabled={!svgHtml}
            title="Open Pan & Zoom Modal"
          >
            🔍 Zoom
          </button>
        </div>
      </div>

      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <textarea
            className="tiptap-mermaid-edit-area"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={8}
            placeholder="Enter Mermaid diagram code..."
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px', background: 'var(--dsw-alias-bg-base, #ffffff)' }}>
            <button
              type="button"
              style={{
                background: 'var(--dsw-alias-state-business-primary, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={handleApply}
            >
              Apply Changes
            </button>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="tiptap-mermaid-preview">
          {error ? (
            <div className="tiptap-mermaid-error">
              <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Mermaid Syntax Error:</div>
              <div>{error}</div>
            </div>
          ) : svgHtml ? (
            <div
              className="tiptap-mermaid-svg"
              dangerouslySetInnerHTML={{ __html: svgHtml }}
              onDoubleClick={() => setIsZoomOpen(true)}
              title="Double click to open Pan & Zoom"
            />
          ) : (
            <div style={{ padding: 20, color: '#94a3b8', textAlign: 'center' }}>Rendering diagram...</div>
          )}
        </div>
      )}

      {isZoomOpen && svgHtml && (
        <MermaidZoomModal svgContent={svgHtml} onClose={() => setIsZoomOpen(false)} />
      )}
    </NodeViewWrapper>
  )
}

export const MermaidExtension = Node.create({
  name: 'mermaid',
  group: 'block',
  atom: true,
  draggable: true,
  // Above the default 100 so this node's fence interceptor (below) is tried
  // before CodeBlockLowlight's, which would otherwise claim every ```mermaid
  // fence as a plain code block.
  priority: 110,

  addAttributes() {
    return {
      code: {
        default: DEFAULT_MERMAID_CHART,
        parseHTML: (element) => element.getAttribute('data-mermaid-code') || element.textContent || '',
        renderHTML: (attributes) => ({
          'data-mermaid-code': attributes.code,
          class: 'tiptap-mermaid-block',
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div.tiptap-mermaid-block',
      },
      {
        tag: 'pre[data-language="mermaid"]',
        getAttrs: (node) => ({
          code: (node as HTMLElement).textContent || '',
        }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'tiptap-mermaid-block' })]
  },

  // Shares the 'code' token name with CodeBlockLowlight — a fenced code
  // block is how markdown represents this node — but only claims fences
  // whose language is 'mermaid'; anything else falls through (returning `[]`
  // signals "not mine") to CodeBlockLowlight's own handler.
  markdownTokenName: 'code',

  parseMarkdown: (token, helpers) => {
    if (token.lang !== 'mermaid') {
      return []
    }
    return helpers.createNode('mermaid', { code: token.text || DEFAULT_MERMAID_CHART })
  },

  renderMarkdown: (node) => {
    const code = ((node.attrs?.code as string) || DEFAULT_MERMAID_CHART).replace(/\r?\n+$/, '')
    return ['```mermaid', code, '```'].join('\n')
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeComponent)
  },

  addCommands() {
    return {
      setMermaid:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              code: options?.code || DEFAULT_MERMAID_CHART,
            },
          })
        },
    }
  },
})
