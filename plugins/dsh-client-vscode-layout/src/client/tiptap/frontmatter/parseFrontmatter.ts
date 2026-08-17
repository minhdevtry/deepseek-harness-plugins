export interface FrontmatterResult {
  meta: Record<string, any>
  hasFrontmatter: boolean
  rawYaml: string
}

export function parseFrontmatter(markdown: string): FrontmatterResult {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match || !match[1]) {
    return { meta: {}, hasFrontmatter: false, rawYaml: '' }
  }

  const rawYaml = match[1]
  const meta: Record<string, any> = {}
  const lines = rawYaml.split('\n')
  let currentKey = ''
  let currentList: string[] | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const listMatch = trimmed.match(/^-\s+(.*)$/)
    if (listMatch && listMatch[1] && currentKey && currentList) {
      currentList.push(listMatch[1].replace(/^["']|["']$/g, ''))
      continue
    }

    const kvMatch = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
    if (kvMatch && kvMatch[1]) {
      if (currentKey && currentList) {
        meta[currentKey] = currentList
        currentList = null
      }

      currentKey = kvMatch[1]
      const val = (kvMatch[2] ?? '').trim()

      if (val.startsWith('[') && val.endsWith(']')) {
        meta[currentKey] = val
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean)
      } else if (!val) {
        currentList = []
      } else {
        meta[currentKey] = val.replace(/^["']|["']$/g, '')
      }
    }
  }

  if (currentKey && currentList) {
    meta[currentKey] = currentList
  }

  return { meta, hasFrontmatter: Object.keys(meta).length > 0, rawYaml }
}
