import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { useEffect, useState } from 'react'
import katex from 'katex'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathBlock: {
      setMathBlock: (options?: { formula?: string }) => ReturnType
    }
  }
}

/** `$$` on its own line, the formula, then `$$` on its own line (KaTeX/MathJax convention). */
const MATH_BLOCK_START = /^ {0,3}\$\$/m
const MATH_BLOCK_PATTERN = /^ {0,3}\$\$[ \t]*\n([\s\S]*?)\n {0,3}\$\$[ \t]*(?:\n|$)/

function MathBlockComponent(props: any) {
  const formula = props.node.attrs.formula || ''
  const [isEditing, setIsEditing] = useState<boolean>(!formula.trim())
  const [editValue, setEditValue] = useState<string>(formula)
  const [html, setHtml] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!formula.trim()) {
      setHtml('')
      setError(null)
      return
    }

    try {
      const rendered = katex.renderToString(formula, {
        displayMode: true,
        throwOnError: false,
      })
      setHtml(rendered)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setHtml('')
    }
  }, [formula])

  const handleApply = () => {
    props.updateAttributes({ formula: editValue })
    setIsEditing(false)
  }

  return (
    <NodeViewWrapper className="tiptap-math-wrapper" contentEditable={false}>
      <div className="tiptap-math-header">
        <div className="tiptap-math-badge">
          <span>∑ LaTeX Formula</span>
        </div>
        <div>
          <button
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--dsw-alias-state-business-primary, #2563eb)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={() => setIsEditing((prev) => !prev)}
          >
            {isEditing ? '👁 View' : '✏️ Edit'}
          </button>
        </div>
      </div>

      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <textarea
            className="tiptap-math-edit-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx"
            rows={3}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 10px', background: 'var(--dsw-alias-bg-base, #ffffff)' }}>
            <button
              type="button"
              style={{
                background: 'var(--dsw-alias-state-business-primary, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={handleApply}
            >
              Apply
            </button>
          </div>
        </div>
      ) : (
        <div
          className="tiptap-math-preview"
          onClick={() => setIsEditing(true)}
        >
          {error ? (
            <div className="tiptap-math-error">{error}</div>
          ) : html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Click to edit formula ($$...$$)</span>
          )}
        </div>
      )}
    </NodeViewWrapper>
  )
}

export const MathBlockExtension = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      formula: {
        default: 'E = mc^2',
        parseHTML: (element) => element.getAttribute('data-formula') || element.textContent || '',
        renderHTML: (attributes) => ({
          'data-formula': attributes.formula,
          class: 'katex-math-block',
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div.katex-math-block',
      },
      {
        tag: 'pre[data-language="math"]',
        getAttrs: (node) => ({
          formula: (node as HTMLElement).textContent || '',
        }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'katex-math-block' })]
  },

  markdownTokenName: 'mathBlock',

  markdownTokenizer: {
    name: 'mathBlock',
    level: 'block',
    start(src) {
      const match = MATH_BLOCK_START.exec(src)
      return match ? match.index : -1
    },
    tokenize(src) {
      const match = MATH_BLOCK_PATTERN.exec(src)
      if (!match || match.index !== 0) {
        return undefined
      }
      return {
        type: 'mathBlock',
        raw: match[0],
        formula: match[1],
      }
    },
  },

  parseMarkdown: (token, helpers) => {
    return helpers.createNode('mathBlock', { formula: token.formula || '' })
  },

  renderMarkdown: (node) => `$$\n${(node.attrs?.formula as string) || ''}\n$$`,

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockComponent)
  },

  addCommands() {
    return {
      setMathBlock:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              formula: options?.formula || 'f(x) = \\int_0^1 x^2 dx',
            },
          })
        },
    }
  },
})
