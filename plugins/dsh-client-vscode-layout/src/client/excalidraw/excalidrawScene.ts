/**
 * Excalidraw Scene Engine: Parser, Serializer, and SVG Vector Renderer.
 */

export interface ExcalidrawElement {
  id: string
  type: 'rectangle' | 'ellipse' | 'diamond' | 'line' | 'arrow' | 'text' | 'freedraw' | string
  x: number
  y: number
  width: number
  height: number
  strokeColor?: string
  backgroundColor?: string
  fillStyle?: 'hachure' | 'cross-hatch' | 'solid' | 'zigzag' | string
  strokeWidth?: number
  strokeStyle?: 'solid' | 'dashed' | 'dotted' | string
  roughness?: number
  opacity?: number
  angle?: number
  text?: string
  fontSize?: number
  fontFamily?: number | string
  textAlign?: 'left' | 'center' | 'right' | string
  points?: Array<[number, number]>
  roundness?: { type: number } | null
  isDeleted?: boolean
  [key: string]: unknown
}

export interface ExcalidrawAppState {
  viewBackgroundColor?: string
  gridSize?: number | null
  [key: string]: unknown
}

export interface ExcalidrawScene {
  type: string
  version: number
  elements: ExcalidrawElement[]
  appState?: ExcalidrawAppState
  files?: Record<string, unknown>
}

export function parseExcalidrawScene(raw: string): ExcalidrawScene | null {
  if (!raw || raw.trim() === '') {
    return {
      type: 'excalidraw',
      version: 2,
      elements: [],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {},
    }
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const elements = Array.isArray(parsed['elements']) ? (parsed['elements'] as ExcalidrawElement[]) : []
    const appState = (parsed['appState'] && typeof parsed['appState'] === 'object' ? parsed['appState'] : {}) as ExcalidrawAppState
    const files = (parsed['files'] && typeof parsed['files'] === 'object' ? parsed['files'] : {}) as Record<string, unknown>

    return {
      type: (parsed['type'] as string) || 'excalidraw',
      version: typeof parsed['version'] === 'number' ? parsed['version'] : 2,
      elements: elements.filter((el) => !el.isDeleted),
      appState,
      files,
    }
  } catch {
    return null
  }
}

export function serializeExcalidrawScene(scene: ExcalidrawScene): string {
  return JSON.stringify(
    {
      type: scene.type || 'excalidraw',
      version: scene.version || 2,
      source: 'deepseek-harness-plugins',
      elements: scene.elements.filter((el) => !el.isDeleted),
      appState: scene.appState || { viewBackgroundColor: '#ffffff' },
      files: scene.files || {},
    },
    null,
    2,
  )
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function renderExcalidrawToSvg(scene: ExcalidrawScene): string {
  const elements = scene.elements.filter((el) => !el.isDeleted)
  if (elements.length === 0) {
    const bg = scene.appState?.viewBackgroundColor || '#ffffff'
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="100%" height="100%" style="background-color: ${bg};"><text x="300" y="200" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="14">Empty Excalidraw Canvas</text></svg>`
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const el of elements) {
    minX = Math.min(minX, el.x)
    minY = Math.min(minY, el.y)
    maxX = Math.max(maxX, el.x + el.width)
    maxY = Math.max(maxY, el.y + el.height)
  }

  const pad = 40
  const width = Math.max(100, Math.ceil(maxX - minX + pad * 2))
  const height = Math.max(100, Math.ceil(maxY - minY + pad * 2))
  const viewBoxX = Math.floor(minX - pad)
  const viewBoxY = Math.floor(minY - pad)
  const bg = scene.appState?.viewBackgroundColor || '#ffffff'

  let body = ''

  for (const el of elements) {
    const stroke = el.strokeColor || '#1e293b'
    const fill = el.backgroundColor && el.backgroundColor !== 'transparent' ? el.backgroundColor : 'none'
    const sw = el.strokeWidth || 1.5
    const dashArray = el.strokeStyle === 'dashed' ? 'stroke-dasharray="6,6"' : el.strokeStyle === 'dotted' ? 'stroke-dasharray="2,4"' : ''
    const opacity = el.opacity !== undefined ? `opacity="${el.opacity / 100}"` : ''

    switch (el.type) {
      case 'rectangle': {
        const rx = el.roundness ? 'rx="8" ry="8"' : ''
        body += `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dashArray} ${rx} ${opacity} />\n`
        break
      }
      case 'ellipse': {
        const cx = el.x + el.width / 2
        const cy = el.y + el.height / 2
        const rx = Math.abs(el.width / 2)
        const ry = Math.abs(el.height / 2)
        body += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dashArray} ${opacity} />\n`
        break
      }
      case 'diamond': {
        const cx = el.x + el.width / 2
        const cy = el.y + el.height / 2
        const pts = `${cx},${el.y} ${el.x + el.width},${cy} ${cx},${el.y + el.height} ${el.x},${cy}`
        body += `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dashArray} ${opacity} />\n`
        break
      }
      case 'text': {
        const fontSize = el.fontSize || 16
        const textAnchor = el.textAlign === 'center' ? 'middle' : el.textAlign === 'right' ? 'end' : 'start'
        const tx = el.textAlign === 'center' ? el.x + el.width / 2 : el.textAlign === 'right' ? el.x + el.width : el.x
        const ty = el.y + fontSize
        const lines = (el.text || '').split('\n')
        let tspans = ''
        lines.forEach((line, idx) => {
          tspans += `<tspan x="${tx}" dy="${idx === 0 ? 0 : fontSize * 1.2}">${escapeXml(line)}</tspan>`
        })
        body += `<text x="${tx}" y="${ty}" fill="${stroke}" font-size="${fontSize}" font-family="Virgil, Segoe UI, sans-serif" text-anchor="${textAnchor}" ${opacity}>${tspans}</text>\n`
        break
      }
      case 'line':
      case 'arrow': {
        if (el.points && el.points.length >= 2) {
          const pathData = el.points
            .map(([px, py], i) => `${i === 0 ? 'M' : 'L'} ${el.x + px} ${el.y + py}`)
            .join(' ')
          body += `<path d="${pathData}" fill="none" stroke="${stroke}" stroke-width="${sw}" ${dashArray} ${opacity} />\n`
          if (el.type === 'arrow' && el.points.length >= 2) {
            const last = el.points[el.points.length - 1]!
            const prev = el.points[el.points.length - 2]!
            const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0])
            const headLen = 10
            const x1 = el.x + last[0] - headLen * Math.cos(angle - Math.PI / 6)
            const y1 = el.y + last[1] - headLen * Math.sin(angle - Math.PI / 6)
            const x2 = el.x + last[0] - headLen * Math.cos(angle + Math.PI / 6)
            const y2 = el.y + last[1] - headLen * Math.sin(angle + Math.PI / 6)
            body += `<polygon points="${el.x + last[0]},${el.y + last[1]} ${x1},${y1} ${x2},${y2}" fill="${stroke}" />\n`
          }
        }
        break
      }
      case 'freedraw': {
        if (el.points && el.points.length >= 2) {
          const pathData = el.points
            .map(([px, py], i) => `${i === 0 ? 'M' : 'L'} ${el.x + px} ${el.y + py}`)
            .join(' ')
          body += `<path d="${pathData}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${opacity} />\n`
        }
        break
      }
      default: {
        body += `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${opacity} />\n`
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxX} ${viewBoxY} ${width} ${height}" width="100%" height="100%" style="background-color: ${bg}; font-family: Virgil, 'Segoe UI Emoji', sans-serif;">\n${body}</svg>`
}
