import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    richImage: {
      setRichImage: (options: { src: string; alt?: string; title?: string; width?: string | number }) => ReturnType
    }
  }
}

function ImageViewComponent(props: any) {
  const { src = '', alt = '', title = '', width = 'auto' } = props.node.attrs
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [currentWidth, setCurrentWidth] = useState<string | number>(width)
  const containerRef = useRef<HTMLDivElement>(null)

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

  return (
    <NodeViewWrapper className="tiptap-image-wrapper" contentEditable={false}>
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
            title="View Fullscreen"
          >
            🔍 Zoom
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
        <div className="tiptap-lightbox-backdrop" onClick={() => setIsLightboxOpen(false)}>
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

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      title: { default: '' },
      width: { default: 'auto' },
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
