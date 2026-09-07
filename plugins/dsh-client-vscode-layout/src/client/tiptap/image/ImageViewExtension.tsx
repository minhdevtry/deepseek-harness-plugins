import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { useRef, useState, useEffect, type MouseEvent as ReactMouseEvent } from 'react'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    richImage: {
      setRichImage: (options: { src: string; alt?: string; title?: string; width?: string | number }) => ReturnType
    }
  }
}

function ImageViewComponent(props: any) {
  const { src = '', alt = '', title = '', width = 'auto', align = 'center' } = props.node.attrs
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [currentWidth, setCurrentWidth] = useState<string | number>(width)
  const [copiedLink, setCopiedLink] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isLightboxOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLightboxOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLightboxOpen])

  const handleMouseDownResize = (e: ReactMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = containerRef.current ? containerRef.current.offsetWidth : 400

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = Math.max(100, Math.min(1000, startWidth + deltaX))
      setCurrentWidth(newWidth)
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      props.updateAttributes({ width: currentWidth })
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleDelete = (e: ReactMouseEvent) => {
    e.stopPropagation()
    props.deleteNode()
  }

  const handleCopyLink = (e: ReactMouseEvent) => {
    e.stopPropagation()
    if (!src) return
    void navigator.clipboard.writeText(src).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 1500)
    })
  }

  return (
    <NodeViewWrapper
      className="tiptap-image-wrapper"
      contentEditable={false}
      style={{
        alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
      }}
    >
      <div
        ref={containerRef}
        className="tiptap-image-container"
        style={{ width: typeof currentWidth === 'number' ? `${currentWidth}px` : currentWidth }}
      >
        <img
          src={src}
          alt={alt}
          title={title}
          className="tiptap-image-element"
          onClick={() => setIsLightboxOpen(true)}
        />

        <div className="tiptap-image-toolbar">
          <button
            type="button"
            className="tiptap-image-tool-btn"
            onClick={() => setIsLightboxOpen(true)}
            title="View Fullscreen Lightbox"
          >
            🔍 Zoom
          </button>
          <button
            type="button"
            className="tiptap-image-tool-btn"
            onClick={() => props.updateAttributes({ align: align === 'left' ? 'center' : align === 'center' ? 'right' : 'left' })}
            title={`Align: ${align} (click to toggle)`}
          >
            {align === 'left' ? '⇥ Left' : align === 'right' ? '⇤ Right' : '↔ Center'}
          </button>
          <button
            type="button"
            className="tiptap-image-tool-btn"
            onClick={handleDelete}
            title="Delete Image"
            style={{ color: '#f87171' }}
          >
            🗑
          </button>
        </div>

        <div
          className="tiptap-image-resize-handle"
          onMouseDown={handleMouseDownResize}
          title="Drag to resize image"
        />
      </div>

      <input
        type="text"
        className="tiptap-image-caption"
        value={title || alt}
        placeholder="Add a caption…"
        onChange={(e) => props.updateAttributes({ title: e.target.value })}
      />

      {isLightboxOpen && (
        <div
          className="tiptap-lightbox-backdrop"
          onClick={() => setIsLightboxOpen(false)}
          title="Click or press ESC to close"
        >
          <div
            style={{
              position: 'fixed',
              top: 16,
              right: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              zIndex: 10001,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#fff',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              onClick={handleCopyLink}
            >
              {copiedLink ? '✓ Copied Link' : '🔗 Copy Link'}
            </button>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#fff',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              ↗ Open
            </a>
            <button
              type="button"
              style={{
                background: 'rgba(255,255,255,0.25)',
                border: 'none',
                color: '#fff',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => setIsLightboxOpen(false)}
            >
              ✕ ESC
            </button>
          </div>
          <img
            src={src}
            alt={alt}
            className="tiptap-lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </NodeViewWrapper>
  )
}

export const RichImageExtension = Node.create({
  name: 'richImage',
  group: 'block',
  atom: true,
  draggable: true,
  // Shares markdownTokenName 'image' with the stock Image extension (below,
  // in extensions.ts) — both unconditionally claim every image token, so
  // whichever sorts first wins every `![]()` on parse. Above the default 100
  // so that's this node, explicitly, rather than depending on which one
  // happens to be listed first in documentExtensions()'s array (the same
  // "ride an existing token, make the win order explicit" pattern used by
  // Mermaid/Video for their own fence collision with CodeBlockLowlight).
  priority: 110,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      title: { default: '' },
      width: { default: 'auto' },
      align: { default: 'center' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (dom) => {
          const el = dom as HTMLImageElement
          return {
            src: el.getAttribute('src'),
            alt: el.getAttribute('alt'),
            title: el.getAttribute('title'),
            width: el.getAttribute('width') || 'auto',
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },

  // `width` has no markdown representation (vanilla `![]()` carries no size),
  // so a resize done in the editor is a UI-only affordance that markdown
  // save/reload can't round-trip — same limitation the plain Image node has.
  markdownTokenName: 'image',

  parseMarkdown: (token, helpers) => {
    return helpers.createNode('richImage', {
      src: token.href,
      alt: token.text || '',
      title: token.title || '',
      width: 'auto',
    })
  },

  renderMarkdown: (node) => {
    const src = (node.attrs?.src as string) || ''
    const alt = (node.attrs?.alt as string) || ''
    const title = (node.attrs?.title as string) || ''
    return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageViewComponent)
  },

  addCommands() {
    return {
      setRichImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },
})
