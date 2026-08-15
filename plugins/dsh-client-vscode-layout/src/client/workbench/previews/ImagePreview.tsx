/**
 * Image and media preview surface.
 *
 * Supports PNG, JPG, GIF, WebP, SVG, and ICO with zoom controls and dimension readouts.
 */
import { useState } from 'react'
import css from './ImagePreview.module.css'

export interface ImagePreviewProps {
  path: string
  size?: number | undefined
}

export function ImagePreview({ path, size }: ImagePreviewProps) {
  const [zoom, setZoom] = useState(1)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)

  const src = `/vscode-files/raw?path=${encodeURIComponent(path)}`

  const handleZoomIn = () => { setZoom(z => Math.min(z * 1.25, 8)) }
  const handleZoomOut = () => { setZoom(z => Math.max(z / 1.25, 0.1)) }
  const handleResetZoom = () => { setZoom(1) }

  return (
    <div className={css.wrap}>
      <div className={css.toolbar}>
        <button type="button" className={css.btn} onClick={handleZoomIn} title="Zoom in">
          🔍+
        </button>
        <button type="button" className={css.btn} onClick={handleZoomOut} title="Zoom out">
          🔍−
        </button>
        <button type="button" className={css.btn} onClick={handleResetZoom} title="Reset zoom (100%)">
          {Math.round(zoom * 100)}%
        </button>

        <span className={css.info}>
          {dimensions && `${dimensions.width} × ${dimensions.height} px`}
          {size !== undefined && ` • ${(size / 1024).toFixed(1)} KB`}
        </span>
      </div>

      <div className={css.viewport}>
        <img
          src={src}
          alt={path.split('/').pop() || 'Preview'}
          className={css.image}
          style={{ transform: `scale(${zoom})` }}
          onLoad={(e) => {
            const target = e.currentTarget
            setDimensions({ width: target.naturalWidth, height: target.naturalHeight })
          }}
        />
      </div>
    </div>
  )
}
