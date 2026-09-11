import { useMemo, useState } from 'react'
import { parseFrontmatter } from './parseFrontmatter.ts'
import { splitFrontmatter } from './splitFrontmatter.ts'
import css from './FrontmatterWidget.module.css'

export interface FrontmatterWidgetProps {
  rawMarkdown: string
  /** Pre-write frontmatter block while a review is active; see TipTapEditorProps. */
  frontmatterBaseline?: string | undefined
  onAcceptFrontmatter?: (() => void) | undefined
  onRejectFrontmatter?: (() => void) | undefined
}

export function FrontmatterWidget({
  rawMarkdown,
  frontmatterBaseline,
  onAcceptFrontmatter,
  onRejectFrontmatter,
}: FrontmatterWidgetProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const { meta, hasFrontmatter, rawYaml } = useMemo(() => {
    return parseFrontmatter(rawMarkdown)
  }, [rawMarkdown])

  // Compared against splitFrontmatter's own fenced-block form (what
  // documents.ts actually stores/reverts), not parseFrontmatter's inner
  // `rawYaml` above — two different parsers for two different jobs, and
  // `frontmatterBaseline` is only ever meaningful in the first one's shape.
  const currentFrontmatter = useMemo(() => splitFrontmatter(rawMarkdown).frontmatter, [rawMarkdown])
  const frontmatterChanged = frontmatterBaseline !== undefined && frontmatterBaseline !== currentFrontmatter

  // An AI edit can delete the whole frontmatter block — parseFrontmatter
  // then reports `hasFrontmatter: false`, which used to mean "render
  // nothing" here, silently hiding exactly the kind of change this banner
  // exists to surface. Only skip the whole widget when there is neither a
  // block to show now nor a review pending over one that used to exist.
  if (!hasFrontmatter && !frontmatterChanged) return null

  const keys = Object.keys(meta)

  return (
    <div className={css.card}>
      {frontmatterChanged && (
        <div className={css.reviewBanner}>
          <span className={css.reviewLabel}>🏷️ AI đã sửa frontmatter</span>
          <div className={css.reviewActions}>
            <button
              type="button"
              className={`${css.reviewBtn} ${css.reviewBtnReject}`}
              onClick={onRejectFrontmatter}
              title="Khôi phục frontmatter về trước khi AI sửa"
            >
              Bỏ
            </button>
            <button
              type="button"
              className={`${css.reviewBtn} ${css.reviewBtnAccept}`}
              onClick={onAcceptFrontmatter}
              title="Giữ frontmatter của AI"
            >
              Giữ
            </button>
          </div>
        </div>
      )}

      {hasFrontmatter && (
        <>
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
        </>
      )}
    </div>
  )
}
