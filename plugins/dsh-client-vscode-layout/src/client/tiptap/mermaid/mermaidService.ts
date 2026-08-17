import { getMermaidConfig } from './mermaidThemes.ts'

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null
let isMermaidInitialized = false
let lastThemeIsDark: boolean | null = null

export async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => m.default)
  }
  return mermaidPromise
}

/**
 * Render Mermaid code to SVG string with dynamic lazy loading
 */
export async function renderMermaidSvg(code: string, isDark: boolean): Promise<string> {
  const mm = await getMermaid()
  if (!isMermaidInitialized || lastThemeIsDark !== isDark) {
    mm.initialize(getMermaidConfig(isDark))
    isMermaidInitialized = true
    lastThemeIsDark = isDark
  }
  const id = 'mermaid-' + Math.random().toString(36).slice(2, 8)
  const { svg } = await mm.render(id, code)
  return svg
}

/**
 * Re-initialize mermaid when theme changes (only if already loaded)
 */
export async function reinitializeMermaidTheme(isDark: boolean): Promise<void> {
  if (mermaidPromise && isMermaidInitialized) {
    const mm = await mermaidPromise
    mm.initialize(getMermaidConfig(isDark))
    lastThemeIsDark = isDark
  }
}
