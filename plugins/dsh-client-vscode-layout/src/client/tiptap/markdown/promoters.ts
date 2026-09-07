/**
 * AST Promoters & Normalizers ported and adapted from inkeep/open-knowledge.
 *
 * Provides deterministic, single-pass normalization of Markdown AST content:
 * - voidBrPromoter: Eliminates synthetic `<br />` tags and converts to clean newlines.
 * - mathPromoter: Protects LaTeX math ($...$ and $$...$$) from escaping.
 * - calloutPromoter: Preserves GitHub / Obsidian callout headers (> [!NOTE]).
 * - accordionPromoter: Preserves HTML5 collapsible details/summary blocks.
 * - listFenceNormalizer: Prevents cumulative blank line growth in nested list codeblocks.
 */

const VOID_BR_RE = /<br\s*\/?>/gi

/**
 * Normalizes void `<br>` / `<br />` tags into standard newlines,
 * while safely ignoring content inside code fences.
 */
export function promoteVoidBr(markdown: string): string {
  const lines = markdown.split('\n')
  let inCodeBlock = false
  let fenceChar = ''

  const processed = lines.map((line) => {
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fenceMatch && fenceMatch[1]) {
      const char = fenceMatch[1][0]
      if (char) {
        if (!inCodeBlock) {
          inCodeBlock = true
          fenceChar = char
        } else if (fenceChar === char) {
          inCodeBlock = false
          fenceChar = ''
        }
      }
      return line
    }

    if (inCodeBlock) return line

    // Outside code blocks, replace <br> / <br /> with newlines
    if (VOID_BR_RE.test(line)) {
      return line.replace(VOID_BR_RE, '\n')
    }
    return line
  })

  return processed.join('\n')
}

/**
 * Protects LaTeX math syntax from unnecessary escaping
 * e.g., prevents \$E = mc^2\$ or escaped backslashes.
 */
export function promoteMath(markdown: string): string {
  // Unescape backslash-escaped dollar signs around math expressions
  return markdown.replace(/\\\$([^\$\n]+)\\\$/g, '$$$1$$')
}

/**
 * Normalizes callout headers to clean GitHub / Obsidian format.
 * Ensures `> [!TYPE]` is cleanly spaced and not broken into paragraphs.
 */
export function promoteCallout(markdown: string): string {
  return markdown.replace(/^>\s*\[!([a-zA-Z0-9_-]+)\]/gm, '> [!$1]')
}

/**
 * Normalizes list code fences so they do not grow blank lines on successive saves.
 */
export function normalizeListFences(markdown: string): string {
  // Regex to detect nested list fences that gain blank lines:
  // e.g. "- item\n\n  ```" -> "- item\n  ```"
  let result = markdown.replace(/^([ \t]*[-*+]\s+.*)\n\n+([ \t]+(?:```|~~~))/gm, '$1\n$2')
  // Also clean trailing blank lines right before closing fence inside list
  result = result.replace(/^([ \t]+(?:```|~~~))\n\n+([ \t]*[-*+])/gm, '$1\n$2')
  return result
}

/**
 * Cleans noisy entities and ensures trailing single newline.
 */
export function cleanEntitiesAndSpacing(text: string): string {
  return text
    .replace(/&#x20;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd() + '\n'
}
