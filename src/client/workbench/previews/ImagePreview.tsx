/**
 * Image and media preview surface.
 *
 * Supports PNG, JPG, GIF, WebP, SVG, and ICO with zoom controls and dimension readouts.
 */
import { useState } from 'react'
import { basename } from '../../utils/path.ts'
import { Button, Tooltip } from '../../ui/primitives/index.ts'
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
        <Tooltip content="Zoom In">
          <Button size="xs" variant="secondary" onClick={handleZoomIn}>
            🔍+
          </Button>
        </Tooltip>
        <Tooltip content="Zoom Out">
          <Button size="xs" variant="secondary" onClick={handleZoomOut}>
            🔍−
          </Button>
        </Tooltip>
        <Tooltip content="Reset Zoom">
          <Button size="xs" variant="secondary" onClick={handleResetZoom}>
            {Math.round(zoom * 100)}%
          </Button>
        </Tooltip>

        <span className={css.info}>
          {dimensions && `${dimensions.width} × ${dimensions.height} px`}
          {size !== undefined && ` • ${(size / 1024).toFixed(1)} KB`}
        </span>
      </div>

      <div className={css.viewport}>
        <img
          src={src}
          alt={basename(path) || 'Preview'}
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
