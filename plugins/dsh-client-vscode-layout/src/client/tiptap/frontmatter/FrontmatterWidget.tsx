import { useMemo, useState } from 'react'
import { parseFrontmatter } from './parseFrontmatter.ts'
import css from './FrontmatterWidget.module.css'

export interface FrontmatterWidgetProps {
  rawMarkdown: string
}

export function FrontmatterWidget({ rawMarkdown }: FrontmatterWidgetProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const { meta, hasFrontmatter, rawYaml } = useMemo(() => {
    return parseFrontmatter(rawMarkdown)
  }, [rawMarkdown])

  if (!hasFrontmatter) return null

  const keys = Object.keys(meta)

  return (
    <div className={css.card}>
      <div className={css.header}>
        <div className={css.badge}>
          <span>🏷️ Frontmatter Metadata</span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className={css.toggleBtn}
            onClick={() => setShowRaw((prev) => !prev)}
            title="View raw YAML"
          >
            {showRaw ? '👁️ Card View' : '⚙️ Raw YAML'}
          </button>

          <button
            type="button"
            className={css.toggleBtn}
            onClick={() => setCollapsed((prev) => !prev)}
            title={collapsed ? 'Expand frontmatter' : 'Collapse frontmatter'}
          >
            {collapsed ? '▼ Expand' : '▲ Collapse'}
          </button>
        </div>
      </div>

      {!collapsed && !showRaw && (
        <div className={css.content}>
          {keys.map((key) => {
            const value = meta[key]
            const isArray = Array.isArray(value)

            return (
              <div key={key} className={css.field}>
                <span className={css.fieldLabel}>{key}</span>
                {isArray ? (
                  <div className={css.tagsWrap}>
                    {value.map((tag: string, i: number) => (
                      <span key={i} className={css.tagPill}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className={css.fieldValue}>{String(value)}</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!collapsed && showRaw && (
        <div className={css.rawEditor}>
          {rawYaml}
        </div>
      )}
    </div>
  )
}
