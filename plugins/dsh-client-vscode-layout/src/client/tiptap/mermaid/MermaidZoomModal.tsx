import { useEffect, useRef, useState } from 'react'
import { copyPngToClipboard, downloadSvg } from './mermaidExport.ts'

export interface MermaidZoomModalProps {
  svgContent: string
  onClose: () => void
}

export function MermaidZoomModal({ svgContent, onClose }: MermaidZoomModalProps) {
  const [scale, setScale] = useState(1)
  const [copied, setCopied] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleCopyPng = async () => {
    if (!containerRef.current) return
    const svgEl = containerRef.current.querySelector('svg')
    if (!svgEl) return
    try {
      await copyPngToClipboard(svgEl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (e) {
      console.error('Failed to copy PNG:', e)
    }
  }

  const handleDownloadSvg = () => {
    if (!containerRef.current) return
    const svgEl = containerRef.current.querySelector('svg')
    if (!svgEl) return
    downloadSvg(svgEl, 'mermaid-diagram.svg')
  }

  return (
    <div className="tiptap-mermaid-zoom-backdrop" onClick={onClose}>
      <div className="tiptap-mermaid-zoom-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tiptap-mermaid-zoom-header">
          <div className="tiptap-mermaid-zoom-title">
            <span>📊 Mermaid Diagram 2.0 (HD Preview)</span>
          </div>
          <div className="tiptap-mermaid-zoom-actions">
            <button type="button" className="tiptap-mermaid-zoom-btn" onClick={handleCopyPng}>
              {copied ? '✓ Copied PNG (2x)' : '📋 Copy HD PNG'}
            </button>
            <button type="button" className="tiptap-mermaid-zoom-btn" onClick={handleDownloadSvg}>
              💾 Export SVG
            </button>
            <button type="button" className="tiptap-mermaid-zoom-close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="tiptap-mermaid-zoom-viewport">
          <div
            ref={containerRef}
            className="tiptap-mermaid-zoom-content"
            style={{ transform: `scale(${scale})` }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />

          <div className="tiptap-mermaid-zoom-controls">
            <button
              type="button"
              className="tiptap-mermaid-zoom-control-btn"
              onClick={() => setScale((s) => Math.max(0.2, s - 0.15))}
              title="Zoom out"
            >
              −
            </button>
            <span className="tiptap-mermaid-zoom-scale-indicator">{Math.round(scale * 100)}%</span>
            <button
              type="button"
              className="tiptap-mermaid-zoom-control-btn"
              onClick={() => setScale((s) => Math.min(4, s + 0.15))}
              title="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="tiptap-mermaid-zoom-control-btn"
              onClick={() => setScale(1)}
              title="Reset zoom"
            >
              ↺
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
