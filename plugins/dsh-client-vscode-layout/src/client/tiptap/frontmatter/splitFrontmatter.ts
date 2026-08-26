/**
 * Frontmatter is a file-level header, not document content: it must never
 * reach the ProseMirror parser (CommonMark turns `---` into a thematic break
 * plus a setext heading and the YAML is destroyed).
 */
export interface SplitMarkdown {
  /** The frontmatter block INCLUDING both `---` fences and the trailing newline, or ''. */
  frontmatter: string
  /** Everything after it. */
  body: string
}

const FRONTMATTER_RE = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/

const YAML_LINE = /^\s*(?:#|-\s|(?:"[^"]*"|'[^']*'|[\w.$-]+)\s*:(?:\s|$))/

export function splitFrontmatter(source: string): SplitMarkdown {
  const match = FRONTMATTER_RE.exec(source)
  if (match === null) return { frontmatter: '', body: source }
  const lines = match[0].split(/\r?\n/)
  const inner = lines.slice(1, -1)
  // Frontmatter is a YAML mapping or sequence, so at least one line must be a
  // `key:` (bare or quoted), a `- item`, or a `#` comment. A plain `---`
  // divider followed by prose has none of those and must not be swallowed.
  if (!inner.some((l) => YAML_LINE.test(l))) return { frontmatter: '', body: source }
  return { frontmatter: match[0], body: source.slice(match[0].length) }
}

/** Re-attach a frontmatter block to serialized body markdown. */
export function joinFrontmatter(frontmatter: string, body: string): string {
  if (frontmatter === '') return body
  // Exactly one blank line between the closing fence and the first block.
  return frontmatter.replace(/\r?\n*$/, '\n') + '\n' + body.replace(/^\r?\n+/, '')
}
