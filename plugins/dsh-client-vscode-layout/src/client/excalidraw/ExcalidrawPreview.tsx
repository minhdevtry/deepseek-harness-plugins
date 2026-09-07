import { useState, useRef, useMemo } from 'react'
import { parseExcalidrawScene, renderExcalidrawToSvg, type ExcalidrawScene } from './excalidrawScene.ts'
import css from './ExcalidrawPreview.module.css'

export interface ExcalidrawPreviewProps {
  content: string
  path: string
  onToggleRaw?: () => void
}

export function ExcalidrawPreview({ content, path, onToggleRaw }: ExcalidrawPreviewProps) {
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })

  const scene: ExcalidrawScene | null = useMemo(() => {
    return parseExcalidrawScene(content)
  }, [content])

  const svgContent = useMemo(() => {
    if (!scene) return null
    return renderExcalidrawToSvg(scene)
  }, [scene])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(`.${css.toolbar}`)) return
    isDraggingRef.current = true
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    })
  }

  const handlePointerUp = () => {
    isDraggingRef.current = false
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85
    setScale((prev) => Math.max(0.2, Math.min(4.0, prev * zoomFactor)))
  }

  const handleReset = () => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  const handleExportSvg = () => {
    if (!svgContent) return
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const fileName = path.split(/[/\\]/).pop()?.replace(/\.(json|excalidraw)$/i, '') || 'drawing'
    a.href = url
    a.download = `${fileName}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={css.container}>
      <div className={css.toolbar}>
        <div className={css.toolbarGroup}>
          <span className={css.badge}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
            Excalidraw Whiteboard
          </span>
          <button type="button" className={css.btn} onClick={handleExportSvg} title="Export as SVG">
            📥 Export SVG
          </button>
        </div>

        <div className={css.toolbarGroup}>
          <button type="button" className={css.btn} onClick={() => setScale((s) => Math.min(4, s * 1.25))} title="Zoom In">
            +
          </button>
          <button type="button" className={css.btn} onClick={() => setScale((s) => Math.max(0.2, s * 0.8))} title="Zoom Out">
            -
          </button>
          <button type="button" className={css.btn} onClick={handleReset} title="Reset Scale">
            {Math.round(scale * 100)}%
          </button>
          {onToggleRaw && (
            <button type="button" className={css.btn} onClick={onToggleRaw} title="Switch to JSON source editor">
              {'{ }'} Raw JSON
            </button>
          )}
        </div>
      </div>

      <div
        className={css.canvasWrapper}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        {svgContent ? (
          <div
            className={css.svgHost}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: 'center center',
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div style={{ color: '#ef4444', fontSize: 13 }}>Failed to parse Excalidraw scene JSON.</div>
        )}
      </div>

      <div className={css.statsBar}>
        {scene?.elements.length ?? 0} elements · Hand-drawn vector scene
      </div>
    </div>
  )
}
