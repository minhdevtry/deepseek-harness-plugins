import { useEffect, useState, useMemo } from 'react'
import { readFile } from '../../api/files.ts'
import { parseExcalidrawScene, renderExcalidrawToSvg } from '../../excalidraw/excalidrawScene.ts'

export interface ExcalidrawEmbedProps {
  src: string
  title?: string
  currentPath?: string
  onOpenFile?: (path: string) => void
}

export function ExcalidrawEmbed({
  src,
  title,
  currentPath,
  onOpenFile,
}: ExcalidrawEmbedProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    // Resolve relative path against current document
    let targetPath = src
    if (currentPath && (src.startsWith('./') || src.startsWith('../'))) {
      const currentDir = currentPath.split(/[/\\]/).slice(0, -1).join('/')
      const parts = `${currentDir}/${src}`.split('/')
      const normalized: string[] = []
      for (const part of parts) {
        if (part === '..') normalized.pop()
        else if (part && part !== '.') normalized.push(part)
      }
      targetPath = normalized.join('/')
    }

    void (async () => {
      try {
        const res = await readFile(targetPath)
        if (!active) return
        if (res.ok && 'content' in res.value) {
          setContent(res.value.content)
        } else {
          setError(`Cannot read ${src}`)
        }
      } catch (err) {
        if (active) setError(String(err))
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [src, currentPath])

  const svgContent = useMemo(() => {
    if (!content) return null
    const scene = parseExcalidrawScene(content)
    if (!scene) return null
    return renderExcalidrawToSvg(scene)
  }, [content])

  return (
    <div
      style={{
        margin: '16px 0',
        border: '1px solid var(--dsw-alias-border-l1, #e2e8f0)',
        borderRadius: 8,
        background: 'var(--dsw-alias-bg-elevated, #ffffff)',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'var(--dsw-alias-bg-hover, #f8fafc)',
          borderBottom: '1px solid var(--dsw-alias-border-l1, #e2e8f0)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--dsw-alias-text-primary, #334155)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          🎨 {title || src}
        </span>
        {onOpenFile && (
          <button
            type="button"
            onClick={() => onOpenFile(src)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--dsw-alias-state-business-primary, #2563eb)',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            Open in Tab ↗
          </button>
        )}
      </div>

      <div style={{ padding: 12, minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading && <span style={{ fontSize: 12, color: '#94a3b8' }}>Loading drawing…</span>}
        {error && <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>}
        {!loading && !error && svgContent && (
          <div
            style={{ maxWidth: '100%', maxHeight: 400, overflow: 'auto' }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}
      </div>
    </div>
  )
}
