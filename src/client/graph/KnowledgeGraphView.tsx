import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { searchNames, readFile } from '../api/files.ts'
import { buildGraphFromDocuments, type KnowledgeGraphData } from '../tiptap/wiki/wikiLink.ts'
import css from './KnowledgeGraphView.module.css'

export interface KnowledgeGraphViewProps {
  root: string
  documents?: Array<{ path: string; content: string }>
  onOpenDocument: (path: string) => void
  onClose?: () => void
}

interface SimNode {
  id: string
  label: string
  val: number
  x: number
  y: number
  vx: number
  vy: number
  fx?: number | null
  fy?: number | null
}

interface SimLink {
  source: SimNode
  target: SimNode
}

export function KnowledgeGraphView({
  root,
  documents = [],
  onOpenDocument,
  onClose,
}: KnowledgeGraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [loadedDocs, setLoadedDocs] = useState<Array<{ path: string; content: string }>>(documents)

  // Viewport Transform (Pan & Zoom)
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const isDraggingCanvasRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const draggedNodeRef = useRef<SimNode | null>(null)

  useEffect(() => {
    let active = true
    const docsMap = new Map<string, string>()
    for (const d of documents) {
      docsMap.set(d.path, d.content)
    }

    if (!root) {
      setLoadedDocs(documents)
      return
    }

    void (async () => {
      try {
        const res = await searchNames(root, '')
        if (!active || !res.ok) return
        const mdHits = res.value.filter(h => h.path.endsWith('.md') || h.path.endsWith('.markdown'))
        for (const hit of mdHits.slice(0, 100)) {
          if (docsMap.has(hit.path)) continue
          const fileRes = await readFile(hit.path)
          if (!active) return
          if (fileRes.ok && 'content' in fileRes.value) {
            docsMap.set(hit.path, fileRes.value.content)
          }
        }
        if (active) {
          setLoadedDocs(Array.from(docsMap.entries()).map(([path, content]) => ({ path, content })))
        }
      } catch {
        if (active) setLoadedDocs(documents)
      }
    })()

    return () => { active = false }
  }, [root, documents])

  const graphData: KnowledgeGraphData = useMemo(() => {
    return buildGraphFromDocuments(loadedDocs)
  }, [loadedDocs])

  const simulationRef = useRef<{
    nodes: SimNode[]
    links: SimLink[]
    rafId: number | null
  }>({
    nodes: [],
    links: [],
    rafId: null,
  })

  // Initialize nodes and links
  useEffect(() => {
    const nodeMap = new Map<string, SimNode>()
    const count = graphData.nodes.length || 1
    const radius = Math.min(300, count * 25)

    const nodes: SimNode[] = graphData.nodes.map((n, i) => {
      const angle = (i / count) * 2 * Math.PI
      const node: SimNode = {
        id: n.id,
        label: n.label,
        val: n.val,
        x: Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
        y: Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
      }
      nodeMap.set(n.id, node)
      return node
    })

    const links: SimLink[] = []
    for (const l of graphData.links) {
      const src = nodeMap.get(l.source)
      const tgt = nodeMap.get(l.target)
      if (src && tgt) {
        links.push({ source: src, target: tgt })
      }
    }

    simulationRef.current.nodes = nodes
    simulationRef.current.links = links
  }, [graphData])

  // Physics Simulation Step
  const tickPhysics = useCallback(() => {
    const { nodes, links } = simulationRef.current
    if (nodes.length === 0) return

    const kRepulsion = 800
    const kSpring = 0.05
    const linkDistance = 70
    const kCenter = 0.01
    const damping = 0.88

    // 1. Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]
      if (!a) continue
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]
        if (!b) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const distSq = dx * dx + dy * dy || 1
        const dist = Math.sqrt(distSq)
        if (dist > 400) continue
        const force = kRepulsion / distSq
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force

        if (a.fx === undefined || a.fx === null) {
          a.vx -= fx
          a.vy -= fy
        }
        if (b.fx === undefined || b.fx === null) {
          b.vx += fx
          b.vy += fy
        }
      }
    }

    // 2. Spring force along links
    for (const link of links) {
      const dx = link.target.x - link.source.x
      const dy = link.target.y - link.source.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const displacement = dist - linkDistance
      const force = displacement * kSpring
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force

      if (link.source.fx === undefined || link.source.fx === null) {
        link.source.vx += fx
        link.source.vy += fy
      }
      if (link.target.fx === undefined || link.target.fx === null) {
        link.target.vx -= fx
        link.target.vy -= fy
      }
    }

    // 3. Center gravity & update positions
    for (const node of nodes) {
      if (node.fx !== undefined && node.fx !== null) {
        node.x = node.fx
        node.vx = 0
      } else {
        node.vx -= node.x * kCenter
        node.vx *= damping
        node.x += node.vx
      }

      if (node.fy !== undefined && node.fy !== null) {
        node.y = node.fy
        node.vy = 0
      } else {
        node.vy -= node.y * kCenter
        node.vy *= damping
        node.y += node.vy
      }
    }
  }, [])

  // Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let isRunning = true

    const render = () => {
      if (!isRunning) return
      tickPhysics()

      const dpr = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)

      // Center + Pan & Zoom
      const { x: panX, y: panY, k: scale } = transformRef.current
      ctx.translate(width / 2 + panX, height / 2 + panY)
      ctx.scale(scale, scale)

      const { nodes, links } = simulationRef.current
      const query = searchQuery.trim().toLowerCase()

      // 1. Draw Links
      for (const link of links) {
        const isHighlighted =
          hoveredNodeId &&
          (link.source.id === hoveredNodeId || link.target.id === hoveredNodeId)

        ctx.beginPath()
        ctx.moveTo(link.source.x, link.source.y)
        ctx.lineTo(link.target.x, link.target.y)
        ctx.strokeStyle = isHighlighted
          ? 'rgba(56, 189, 248, 0.85)'
          : 'rgba(148, 163, 184, 0.25)'
        ctx.lineWidth = isHighlighted ? 2 : 1
        ctx.stroke()
      }

      // 2. Draw Nodes
      for (const node of nodes) {
        const isHovered = node.id === hoveredNodeId
        const matchesQuery = !query || node.label.toLowerCase().includes(query)
        const radius = Math.max(5, Math.min(14, node.val * 2.2))

        ctx.beginPath()
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)

        if (matchesQuery) {
          ctx.fillStyle = isHovered ? '#38bdf8' : '#2563eb'
        } else {
          ctx.fillStyle = 'rgba(71, 85, 105, 0.4)'
        }
        ctx.fill()

        ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.3)'
        ctx.lineWidth = isHovered ? 2 : 1
        ctx.stroke()

        // Label
        if (scale > 0.6 || isHovered || (query && matchesQuery)) {
          ctx.font = `${isHovered ? '600' : '400'} 11px Inter, sans-serif`
          ctx.fillStyle = matchesQuery ? (isHovered ? '#38bdf8' : '#e2e8f0') : 'rgba(148, 163, 184, 0.3)'
          ctx.textAlign = 'center'
          ctx.fillText(node.label, node.x, node.y + radius + 13)
        }
      }

      ctx.restore()
      simulationRef.current.rafId = requestAnimationFrame(render)
    }

    simulationRef.current.rafId = requestAnimationFrame(render)

    return () => {
      isRunning = false
      if (simulationRef.current.rafId) {
        cancelAnimationFrame(simulationRef.current.rafId)
      }
    }
  }, [tickPhysics, searchQuery, hoveredNodeId])

  // Mouse / Pointer Events for Dragging and Zooming
  const findNodeAtCoords = (clientX: number, clientY: number): SimNode | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const { x: panX, y: panY, k: scale } = transformRef.current
    const cx = canvas.clientWidth / 2 + panX
    const cy = canvas.clientHeight / 2 + panY
    const simX = (clientX - rect.left - cx) / scale
    const simY = (clientY - rect.top - cy) / scale

    for (const node of simulationRef.current.nodes) {
      const radius = Math.max(8, node.val * 2.5)
      const dx = node.x - simX
      const dy = node.y - simY
      if (dx * dx + dy * dy <= radius * radius) {
        return node
      }
    }
    return null
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const node = findNodeAtCoords(e.clientX, e.clientY)
    if (node) {
      draggedNodeRef.current = node
      node.fx = node.x
      node.fy = node.y
    } else {
      isDraggingCanvasRef.current = true
      dragStartRef.current = {
        x: e.clientX - transformRef.current.x,
        y: e.clientY - transformRef.current.y,
      }
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggedNodeRef.current) {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const { x: panX, y: panY, k: scale } = transformRef.current
      const cx = canvas.clientWidth / 2 + panX
      const cy = canvas.clientHeight / 2 + panY
      draggedNodeRef.current.fx = (e.clientX - rect.left - cx) / scale
      draggedNodeRef.current.fy = (e.clientY - rect.top - cy) / scale
      return
    }

    if (isDraggingCanvasRef.current) {
      transformRef.current.x = e.clientX - dragStartRef.current.x
      transformRef.current.y = e.clientY - dragStartRef.current.y
      return
    }

    const hit = findNodeAtCoords(e.clientX, e.clientY)
    setHoveredNodeId(hit ? hit.id : null)
  }

  const handlePointerUp = () => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current.fx = null
      draggedNodeRef.current.fy = null
      draggedNodeRef.current = null
    }
    isDraggingCanvasRef.current = false
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const node = findNodeAtCoords(e.clientX, e.clientY)
    if (node) {
      onOpenDocument(node.id)
    }
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88
    const nextScale = Math.max(0.2, Math.min(4.0, transformRef.current.k * zoomFactor))
    transformRef.current.k = nextScale
  }

  const handleZoomIn = () => {
    transformRef.current.k = Math.min(4.0, transformRef.current.k * 1.25)
  }

  const handleZoomOut = () => {
    transformRef.current.k = Math.max(0.2, transformRef.current.k * 0.8)
  }

  const handleResetZoom = () => {
    transformRef.current = { x: 0, y: 0, k: 1 }
  }

  return (
    <div className={css.container}>
      <div className={css.toolbar}>
        <div className={css.toolbarGroup}>
          <span className={css.title}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Knowledge Graph
          </span>

          <input
            type="text"
            className={css.searchInput}
            placeholder="Search document…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={css.toolbarGroup}>
          <button type="button" className={css.toolButton} onClick={handleZoomIn} title="Zoom In">
            +
          </button>
          <button type="button" className={css.toolButton} onClick={handleZoomOut} title="Zoom Out">
            -
          </button>
          <button type="button" className={css.toolButton} onClick={handleResetZoom} title="Reset View">
            ⛶ Fit
          </button>
          {onClose && (
            <button type="button" className={css.toolButton} onClick={onClose} title="Close Graph">
              ✕
            </button>
          )}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className={css.canvas}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        onWheel={handleWheel}
      />

      <div className={css.statsBar}>
        {graphData.nodes.length} nodes · {graphData.links.length} connections
      </div>
    </div>
  )
}
