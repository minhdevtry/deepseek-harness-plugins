import type React from 'react'
import { CalloutIcon, ChevronDownIcon } from './CalloutIcons.tsx'
import type { CalloutType } from '../Callout.ts'
import css from './Callout.module.css'

export interface CalloutComponentProps {
  type: CalloutType
  title?: string
  icon?: string
  color?: string
  collapsible?: boolean
  defaultOpen?: boolean
  children?: React.ReactNode
}

const TYPE_CLASS_MAP: Record<CalloutType, string | undefined> = {
  note: css.typeNote,
  tip: css.typeTip,
  important: css.typeImportant,
  warning: css.typeWarning,
  caution: css.typeCaution,
  abstract: css.typeAbstract,
  info: css.typeInfo,
  todo: css.typeTodo,
  success: css.typeSuccess,
  question: css.typeQuestion,
  failure: css.typeFailure,
  danger: css.typeDanger,
  bug: css.typeBug,
  example: css.typeExample,
  quote: css.typeQuote,
}

export function CalloutComponent({
  type,
  title,
  color,
  collapsible,
  defaultOpen = true,
  children,
}: CalloutComponentProps) {
  const typeClass = TYPE_CLASS_MAP[type] || css.typeNote
  const style = color
    ? ({ '--callout-type-color': color, '--callout-type-bg': `${color}14`, borderLeftColor: color } as React.CSSProperties)
    : undefined

  if (collapsible) {
    return (
      <details
        className={`${css.callout} ${typeClass}`}
        data-callout-type={type}
        data-type="callout"
        data-collapsible="true"
        data-title={title || ''}
        open={defaultOpen}
        style={style}
      >
        <summary className={css.calloutSummary} contentEditable={false}>
          <CalloutIcon type={type} />
          <span>{title || type.toUpperCase()}</span>
          <span className={css.calloutChevron}>
            <ChevronDownIcon />
          </span>
        </summary>
        <div className={css.calloutBody}>{children}</div>
      </details>
    )
  }

  return (
    <div
      className={`${css.callout} ${typeClass}`}
      data-callout-type={type}
      data-type="callout"
      style={style}
    >
      <div className={css.calloutHeader} contentEditable={false}>
        <CalloutIcon type={type} />
        {title && <span>{title}</span>}
      </div>
      <div className={css.calloutBody}>{children}</div>
    </div>
  )
}
