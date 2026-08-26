/**
 * Clean SVG Vector Icons for the TipTap Editor Toolbar and Menus.
 * All icons use `currentColor` for seamless theme (Dark/Light) and disabled state support.
 */

interface IconProps {
  size?: number | undefined
  className?: string | undefined
}

export function IconSparkles({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  )
}

export function IconTocOutline({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="7" y1="12" x2="21" y2="12" />
      <line x1="11" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export function IconSearch({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function IconUndo({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  )
}

export function IconRedo({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
    </svg>
  )
}

export function IconMermaid({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

export function IconMath({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 4H6l7 8-7 8h12" />
    </svg>
  )
}

export function IconCallout({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  )
}

export function IconDetails({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  )
}

export function IconCopy({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  )
}

export function IconCode({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

export function IconPrint({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" />
    </svg>
  )
}

export function IconCheck({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/* =========================================================================
 * Exact Notion SVG Icons
 * ========================================================================= */

export function NotionIconTextNormal({ size = 16, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      role="graphics-symbol"
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M4.875 4.825c0-.345.28-.625.625-.625h9c.345 0 .625.28.625.625v1.8a.625.625 0 1 1-1.25 0V5.45h-3.25v9.1h.725a.625.625 0 1 1 0 1.25h-2.7a.625.625 0 1 1 0-1.25h.725v-9.1h-3.25v1.175a.625.625 0 1 1-1.25 0z" />
    </svg>
  )
}

export function NotionIconChevronRight({ size = 12, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      role="graphics-symbol"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M6.722 3.238a.625.625 0 1 0-.884.884L9.716 8l-3.878 3.878a.625.625 0 0 0 .884.884l4.32-4.32a.625.625 0 0 0 0-.884z" />
    </svg>
  )
}

export function NotionIconBold({ size = 16, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      role="graphics-symbol"
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M6.428 3.95a.875.875 0 0 0-.875.875v10.35c0 .483.392.875.875.875h3.81c1.377 0 2.461-.298 3.203-.963.763-.682 1.006-1.607 1.006-2.5 0-1.199-.582-2.18-1.483-2.788.704-.64 1.007-1.494 1.007-2.386 0-2.145-2.08-3.463-4.086-3.463zm.875 6.925h3.359c1.303 0 2.035.805 2.035 1.713 0 .586-.153.954-.423 1.196-.29.26-.873.516-2.036.516H7.303zm2.165-1.75H7.303V5.7h2.582c1.452 0 2.336.9 2.336 1.713 0 .515-.172.89-.516 1.16-.373.294-1.057.55-2.237.552" />
    </svg>
  )
}

export function NotionIconItalic({ size = 16, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      role="graphics-symbol"
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="m10.541 5.45-2.374 9.1H6.4a.625.625 0 1 0 0 1.25h4.5a.625.625 0 1 0 0-1.25H9.46l2.374-9.1H13.6a.625.625 0 1 0 0-1.25H9.1a.625.625 0 1 0 0 1.25z" />
    </svg>
  )
}

export function NotionIconUnderline({ size = 16, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      role="graphics-symbol"
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M15.4 5.45a.625.625 0 1 0 0-1.25h-2.7a.625.625 0 0 0 0 1.25h.725v5.54c0 1.743-1.434 3.335-3.425 3.335-1.235 0-2.07-.414-2.602-.996-.541-.594-.823-1.423-.823-2.339V5.45H7.3a.625.625 0 1 0 0-1.25H4.6a.625.625 0 1 0 0 1.25h.725v5.54c0 1.163.358 2.314 1.15 3.181.8.877 1.989 1.404 3.525 1.404 2.699 0 4.675-2.17 4.675-4.585V5.45zm1.525 12.2c0 .345-.28.625-.625.625H3.7a.625.625 0 1 1 0-1.25h12.6c.345 0 .625.28.625.625" />
    </svg>
  )
}

export function NotionIconClearFormat({ size = 16, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      role="graphics-symbol"
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M12.75 4.2c.345 0 .625.28.625.625v1.8a.625.625 0 0 1-1.25 0V5.45h-3.25v9.1h.726a.626.626 0 0 1 0 1.25H6.9a.625.625 0 1 1 0-1.25h.724v-9.1h-3.25v1.175a.625.625 0 0 1-1.25 0v-1.8c0-.345.28-.625.625-.625z" />
      <path d="M16.176 9.558a.626.626 0 0 1 .884.884l-1.68 1.68 1.68 1.679a.625.625 0 0 1-.884.884l-1.68-1.68-1.679 1.68a.626.626 0 0 1-.884-.884l1.678-1.68-1.678-1.679a.626.626 0 0 1 .884-.884l1.68 1.678z" />
    </svg>
  )
}

export function NotionIconLink({ size = 16, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      role="graphics-symbol"
      viewBox="2.5 0 14.92 20"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M10.61 3.61a3.776 3.776 0 0 1 5.34 0l.367.368a3.776 3.776 0 0 1 0 5.34l-1.852 1.853a.625.625 0 1 1-.884-.884l1.853-1.853a2.526 2.526 0 0 0 0-3.572l-.368-.367a2.526 2.526 0 0 0-3.572 0L9.641 6.347a.625.625 0 1 1-.883-.883z" />
      <path d="M12.98 6.949a.625.625 0 0 1 0 .884L7.53 13.28a.625.625 0 0 1-.884-.884l5.448-5.448a.625.625 0 0 1 .884 0" />
      <path d="M6.348 8.757a.625.625 0 0 1 0 .884l-1.853 1.853a2.526 2.526 0 0 0 0 3.572l.367.367a2.525 2.525 0 0 0 3.572 0l1.853-1.852a.625.625 0 1 1 .884.883l-1.853 1.853a3.776 3.776 0 0 1-5.34 0l-.367-.367a3.776 3.776 0 0 1 0-5.34l1.853-1.853a.625.625 0 0 1 .884 0" />
    </svg>
  )
}

export function NotionIconStrikethrough({ size = 16, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      role="graphics-symbol"
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M10.065 9.373H16.3a.627.627 0 1 1 0 1.255h-3.233l.122.107c.723.665 1.038 1.505 1.038 2.456 0 1.024-.503 1.868-1.288 2.436-.772.56-1.81.85-2.939.85s-2.167-.29-2.94-.85c-.784-.568-1.288-1.412-1.288-2.436a.628.628 0 0 1 1.255 0c0 .571.268 1.057.77 1.42.513.37 1.276.611 2.203.611.928 0 1.69-.24 2.204-.612.5-.362.768-.848.768-1.42 0-.644-.199-1.133-.632-1.531-.452-.416-1.207-.777-2.405-1.032H3.7a.627.627 0 1 1 0-1.255h3.233l-.122-.107C6.088 8.6 5.773 7.76 5.773 6.81c0-1.024.503-1.868 1.288-2.436.772-.56 1.81-.85 2.94-.85s2.166.29 2.938.85c.785.568 1.289 1.412 1.289 2.436a.628.628 0 0 1-1.255 0c0-.571-.268-1.057-.77-1.42-.513-.37-1.275-.612-2.203-.612s-1.69.241-2.203.613c-.502.362-.77.848-.77 1.42 0 .644.2 1.133.633 1.531.452.416 1.207.777 2.405 1.032" />
    </svg>
  )
}

export function NotionIconCode({ size = 16, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      role="graphics-symbol"
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M11.971 3.1c.332.094.525.44.43.772l-3.6 12.6a.625.625 0 0 1-1.202-.343l3.6-12.6a.625.625 0 0 1 .772-.43M5.417 5.598a.626.626 0 0 1 .885.884L2.784 10l3.518 3.519a.625.625 0 0 1-.885.883l-3.96-3.96a.626.626 0 0 1 0-.884zm8.281 0a.626.626 0 0 1 .884 0l3.96 3.96a.626.626 0 0 1 0 .884l-3.96 3.96a.626.626 0 0 1-.884-.883L17.215 10l-3.517-3.518a.626.626 0 0 1 0-.884" />
    </svg>
  )
}

export function NotionIconComment({ size = 16, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      role="graphics-symbol"
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M5.875 7.505c0-.345.28-.625.625-.625h7a.625.625 0 1 1 0 1.25h-7a.625.625 0 0 1-.625-.625m0 3c0-.345.28-.625.625-.625h5a.625.625 0 1 1 0 1.25h-5a.625.625 0 0 1-.625-.625" />
      <path d="M17.625 5.255A2.125 2.125 0 0 0 15.5 3.13h-11a2.125 2.125 0 0 0-2.125 2.125v7.5c0 1.173.951 2.125 2.125 2.125h1.188v2.482a.625.625 0 0 0 1.006.496l3.87-2.978H15.5a2.125 2.125 0 0 0 2.125-2.125zM15.5 4.38c.483 0 .875.392.875.875v7.5a.875.875 0 0 1-.875.875h-5.148a.63.63 0 0 0-.38.13l-3.034 2.333v-1.838a.625.625 0 0 0-.625-.625H4.5a.875.875 0 0 1-.875-.875v-7.5c0-.483.392-.875.875-.875z" />
    </svg>
  )
}

export function NotionIconSquareRoot({ size = 16, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      role="graphics-symbol"
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M19.125 4.25c0 .345-.28.625-.625.625H9.07l-4.745 11.12a.626.626 0 0 1-1.07.137l-.049-.073-2.25-3.97-.05-.115a.626.626 0 0 1 1.065-.604l.073.103 1.626 2.869L8.081 4.005l.043-.083a.63.63 0 0 1 .532-.297H18.5c.345 0 .625.28.625.625" />
      <path d="M17.405 15.476a.625.625 0 0 1-.968.748l-.087-.092-2.694-3.487-2.693 3.487-.087.092a.624.624 0 0 1-.969-.748l.068-.108 2.892-3.743-2.892-3.743-.068-.108a.625.625 0 0 1 .97-.748l.086.092 2.693 3.486 2.694-3.486.087-.092a.624.624 0 0 1 .968.748l-.067.108-2.892 3.743 2.892 3.743z" />
    </svg>
  )
}

export function NotionIconEllipsis({ size = 16, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      role="graphics-symbol"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M3.2 6.725a1.275 1.275 0 1 0 0 2.55 1.275 1.275 0 0 0 0-2.55m4.8 0a1.275 1.275 0 1 0 0 2.55 1.275 1.275 0 0 0 0-2.55m4.8 0a1.275 1.275 0 1 0 0 2.55 1.275 1.275 0 0 0 0-2.55" />
    </svg>
  )
}

export function NotionIconSliders({ size = 14, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      role="graphics-symbol"
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M3 7.375h6.829a2.501 2.501 0 0 0 4.842 0H17a.625.625 0 1 0 0-1.25h-2.329a2.501 2.501 0 0 0-4.842 0H3a.625.625 0 1 0 0 1.25M12.25 5.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
      <path fillRule="evenodd" d="M7.75 15.75a2.5 2.5 0 0 0 2.421-1.875H17a.625.625 0 0 0 0-1.25h-6.829a2.5 2.5 0 0 0-4.842 0H3a.625.625 0 1 0 0 1.25h2.329A2.5 2.5 0 0 0 7.75 15.75m0-1.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5" clipRule="evenodd" />
    </svg>
  )
}

export function NotionIconPencil({ size = 13, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      role="graphics-symbol"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M11.243 3.457a.803.803 0 0 0-1.13 0l-.554.552a.075.075 0 0 0 0 .106l1.03 1.03a.075.075 0 0 0 .107 0l.547-.546a.1.1 0 0 0 .019-.032.804.804 0 0 0-.02-1.11m-2.246 1.22a.075.075 0 0 0-.106 0l-6.336 6.326a1.1 1.1 0 0 0-.237.393l-.27.87v.002c-.062.232.153.466.389.383l.863-.267q.221-.061.397-.239l6.332-6.331a.075.075 0 0 0 0-.106zm-3.355 6.898a.08.08 0 0 0-.053.022l-1.1 1.1a.075.075 0 0 0 .053.128h9.06a.625.625 0 1 0 0-1.25z" />
    </svg>
  )
}

export function NotionIconHeading({ level = 1, size = 16, className }: { level?: number; size?: number; className?: string }) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: level === 1 ? 13 : level === 2 ? 12 : 11,
        width: size,
        height: size,
        lineHeight: 1,
      }}
    >
      H{level}
    </span>
  )
}

export function NotionIconBulletList({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" role="graphics-symbol" viewBox="0 0 20 20" width={size} height={size} className={className} fill="currentColor">
      <path d="M4 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm0 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm0 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM8 4.5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 8 4.5zm0 5.5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 8 10zm0 5.5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75z" />
    </svg>
  )
}

export function NotionIconNumberedList({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" role="graphics-symbol" viewBox="0 0 20 20" width={size} height={size} className={className} fill="currentColor">
      <path d="M3.25 3.5a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0zm-.75 6.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v.5a1.5 1.5 0 0 1-1.5 1.5h-.75v.75h2.25a.75.75 0 0 1 0 1.5H3.25a.75.75 0 0 1-.75-.75v-1.5a1.5 1.5 0 0 1 1.5-1.5h.75v-.5H3.25a.75.75 0 0 1-.75-.75zM8 4.5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 8 4.5zm0 5.5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 8 10zm0 5.5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75z" />
    </svg>
  )
}

export function NotionIconTodoList({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" role="graphics-symbol" viewBox="0 0 20 20" width={size} height={size} className={className} fill="currentColor">
      <path d="M5.25 3.125A2.125 2.125 0 0 0 3.125 5.25v9.5c0 1.174.951 2.125 2.125 2.125h9.5a2.125 2.125 0 0 0 2.125-2.125v-9.5a2.125 2.125 0 0 0-2.125-2.125zM4.375 5.25c0-.483.392-.875.875-.875h9.5c.483 0 .875.392.875.875v9.5a.875.875 0 0 1-.875.875h-9.5a.875.875 0 0 1-.875-.875z" />
      <path d="M12.876 7.982a.625.625 0 1 0-1.072-.644L9.25 11.595 7.815 9.92a.625.625 0 1 0-.95.813l2 2.334a.625.625 0 0 0 1.01-.085z" />
    </svg>
  )
}

export function NotionIconQuote({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" role="graphics-symbol" viewBox="0 0 20 20" width={size} height={size} className={className} fill="currentColor">
      <path d="M3.75 6.5C3.75 5.12 4.87 4 6.25 4h.5a.75.75 0 0 1 .75.75v3.5A2.75 2.75 0 0 1 4.75 11H4a.75.75 0 0 1-.75-.75V6.5zm7.5 0C11.25 5.12 12.37 4 13.75 4h.5a.75.75 0 0 1 .75.75v3.5A2.75 2.75 0 0 1 12.25 11h-.75a.75.75 0 0 1-.75-.75V6.5z" />
    </svg>
  )
}

export function NotionIconCallout({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" role="graphics-symbol" viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
  )
}

export function NotionIconToggle({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" role="graphics-symbol" viewBox="0 0 20 20" width={size} height={size} className={className} fill="currentColor">
      <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l5.5 5.5a.75.75 0 0 1 0 1.06l-5.5 5.5a.75.75 0 0 1-1.06-1.06L11.19 10 6.22 5.03a.75.75 0 0 1 0-1.06z" />
    </svg>
  )
}

export function NotionIconAlignLeft({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" role="graphics-symbol" viewBox="0 0 20 20" width={size} height={size} className={className} fill="currentColor">
      <path d="M3 4.75a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 4.75zm0 4a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 3 8.75zm0 4a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75zm0 4a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 3 16.75z" />
    </svg>
  )
}

export function NotionIconAlignCenter({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" role="graphics-symbol" viewBox="0 0 20 20" width={size} height={size} className={className} fill="currentColor">
      <path d="M3 4.75a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 4.75zm3 4a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 6 8.75zm-3 4a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75zm3 4a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 6 16.75z" />
    </svg>
  )
}

export function NotionIconAlignRight({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" role="graphics-symbol" viewBox="0 0 20 20" width={size} height={size} className={className} fill="currentColor">
      <path d="M3 4.75a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 4.75zm4 4a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 7 8.75zm-4 4a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75zm4 4a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 7 16.75z" />
    </svg>
  )
}

export function NotionIconAlignJustify({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" role="graphics-symbol" viewBox="0 0 20 20" width={size} height={size} className={className} fill="currentColor">
      <path d="M3 4.75a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 4.75zm0 4a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 8.75zm0 4a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75zm0 4a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75z" />
    </svg>
  )
}

