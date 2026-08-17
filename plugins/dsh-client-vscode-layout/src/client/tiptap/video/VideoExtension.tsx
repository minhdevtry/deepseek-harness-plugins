import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    videoEmbed: {
      setVideoEmbed: (options: { src: string }) => ReturnType
    }
  }
}

function parseVideoSrc(src: string): { type: 'youtube' | 'bilibili' | 'direct'; embedUrl: string; originalUrl: string } {
  const trimmed = src.trim()

  // 1. YouTube Match
  const ytMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([\w-]{11})/i)
  if (ytMatch && ytMatch[1] && /^[\w-]{11}$/.test(ytMatch[1])) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
      originalUrl: `https://www.youtube.com/watch?v=${ytMatch[1]}`,
    }
  }

  // 2. Bilibili Match
  const biliMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i)
  if (biliMatch) {
    return {
      type: 'bilibili',
      embedUrl: `https://player.bilibili.com/player.html?bvid=${biliMatch[1]}&page=1&high_quality=1&danmaku=0`,
      originalUrl: trimmed,
    }
  }

  // 3. Direct Video
  return {
    type: 'direct',
    embedUrl: trimmed,
    originalUrl: trimmed,
  }
}

function VideoEmbedComponent(props: any) {
  const src = props.node.attrs.src || ''
  const parsed = parseVideoSrc(src)

  return (
    <NodeViewWrapper className="tiptap-video-wrapper" contentEditable={false}>
      <div className="tiptap-video-toolbar">
        <div className="tiptap-video-title">
          {parsed.type === 'youtube' && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff0000" style={{ marginRight: 6 }}>
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          )}
          <span>Video Player ({parsed.type})</span>
        </div>
        <div>
          <a
            href={parsed.originalUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#38bdf8', fontSize: 11, textDecoration: 'none' }}
          >
            Open ↗
          </a>
        </div>
      </div>
      <div className="tiptap-video-iframe-wrapper">
        {parsed.type === 'direct' ? (
          <video src={parsed.embedUrl} controls style={{ width: '100%', height: '100%' }} />
        ) : (
          <iframe
            src={parsed.embedUrl}
            title="Video Player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        )}
      </div>
    </NodeViewWrapper>
  )
}

export const VideoEmbedExtension = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-src') || element.getAttribute('src') || '',
        renderHTML: (attributes) => ({
          'data-src': attributes.src,
          class: 'tiptap-video-embed',
        }),
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'div.tiptap-video-embed' },
      { tag: 'div[data-src]' },
      {
        tag: 'video',
        getAttrs: (element) => {
          const el = element as HTMLElement
          return { src: el.getAttribute('src') || '' }
        },
      },
      {
        tag: 'iframe',
        getAttrs: (element) => {
          const el = element as HTMLElement
          return { src: el.getAttribute('src') || '' }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'tiptap-video-embed' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedComponent)
  },

  addCommands() {
    return {
      setVideoEmbed:
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
