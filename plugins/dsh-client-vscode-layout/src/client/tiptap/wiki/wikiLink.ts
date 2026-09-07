/**
 * Wiki-Links (`[[document]]`) extension and Knowledge Graph Link Resolver.
 */
import { Node, mergeAttributes } from '@tiptap/core'

export interface WikiLinkAttrs {
  target: string
  alias: string | null
  anchor: string | null
}

const WIKI_LINK_RE = /^\[\[([^[\]|#]+?)(?:#([^\]|]+?))?(?:\|([^\]]+?))?\]\]/

export function parseWikiLinkText(src: string): WikiLinkAttrs | null {
  const match = src.trim().match(WIKI_LINK_RE)
  if (!match) return null
  const target = (match[1] || '').trim()
  if (!target) return null
  return {
    target,
    anchor: match[2]?.trim() || null,
    alias: match[3]?.trim() || null,
  }
}

export function formatWikiLink(attrs: WikiLinkAttrs): string {
  let res = `[[${attrs.target}`
  if (attrs.anchor) res += `#${attrs.anchor}`
  if (attrs.alias) res += `|${attrs.alias}`
  return `${res}]]`
}

export interface GraphNodeItem {
  id: string
  label: string
  val: number
}

export interface GraphLinkItem {
  source: string
  target: string
}

export interface KnowledgeGraphData {
  nodes: GraphNodeItem[]
  links: GraphLinkItem[]
}

function normalizeDocKey(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.md$/i, '')
}

export function buildGraphFromDocuments(
  docs: Array<{ path: string; content: string }>,
): KnowledgeGraphData {
  const nodeMap = new Map<string, { id: string; label: string; linksCount: number }>()
  const docKeyToPath = new Map<string, string>()

  for (const doc of docs) {
    const key = normalizeDocKey(doc.path)
    const baseName = doc.path.split(/[/\\]/).pop()?.replace(/\.md$/i, '') || doc.path
    nodeMap.set(doc.path, { id: doc.path, label: baseName, linksCount: 1 })
    docKeyToPath.set(key, doc.path)
    docKeyToPath.set(baseName, doc.path)
  }

  const links: GraphLinkItem[] = []
  const linkSet = new Set<string>()

  for (const doc of docs) {
    const sourcePath = doc.path
    const content = doc.content

    // 1. Extract Wiki links [[target]]
    const wikiMatches = content.matchAll(/\[\[([^[\]|#]+?)(?:#[^\]|]+?)?(?:\|[^\]]+?)?\]\]/g)
    for (const match of wikiMatches) {
      const rawTarget = match[1]?.trim()
      if (!rawTarget) continue
      const targetKey = normalizeDocKey(rawTarget)
      const targetBase = rawTarget.split(/[/\\]/).pop()?.replace(/\.md$/i, '') || rawTarget
      const resolvedPath = docKeyToPath.get(targetKey) || docKeyToPath.get(targetBase)

      if (resolvedPath && resolvedPath !== sourcePath) {
        const linkKey = `${sourcePath}->${resolvedPath}`
        if (!linkSet.has(linkKey)) {
          linkSet.add(linkKey)
          links.push({ source: sourcePath, target: resolvedPath })
          const srcNode = nodeMap.get(sourcePath)
          if (srcNode) srcNode.linksCount++
          const tgtNode = nodeMap.get(resolvedPath)
          if (tgtNode) tgtNode.linksCount++
        }
      }
    }

    // 2. Extract standard relative markdown links [text](path.md)
    const mdMatches = content.matchAll(/\[(?:[^[\]]+)\]\(([^)]+)\)/g)
    for (const match of mdMatches) {
      const rawHref = match[1]?.trim()
      if (!rawHref || /^[a-z]+:/i.test(rawHref) || rawHref.startsWith('#')) continue
      const pathPart = rawHref.split(/[?#]/)[0]
      if (!pathPart) continue
      const targetKey = normalizeDocKey(pathPart)
      const targetBase = pathPart.split(/[/\\]/).pop()?.replace(/\.md$/i, '') || pathPart
      const resolvedPath = docKeyToPath.get(targetKey) || docKeyToPath.get(targetBase)

      if (resolvedPath && resolvedPath !== sourcePath) {
        const linkKey = `${sourcePath}->${resolvedPath}`
        if (!linkSet.has(linkKey)) {
          linkSet.add(linkKey)
          links.push({ source: sourcePath, target: resolvedPath })
          const srcNode = nodeMap.get(sourcePath)
          if (srcNode) srcNode.linksCount++
          const tgtNode = nodeMap.get(resolvedPath)
          if (tgtNode) tgtNode.linksCount++
        }
      }
    }
  }

  const nodes: GraphNodeItem[] = Array.from(nodeMap.values()).map((n) => ({
    id: n.id,
    label: n.label,
    val: Math.max(2, n.linksCount),
  }))

  return { nodes, links }
}

export const WikiLinkExtension = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  priority: 60,

  addAttributes() {
    return {
      target: { default: '' },
      alias: { default: null },
      anchor: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-wiki-link]',
        getAttrs: (dom) => {
          const el = dom as HTMLElement
          return {
            target: el.getAttribute('data-target') || '',
            alias: el.getAttribute('data-alias') || null,
            anchor: el.getAttribute('data-anchor') || null,
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const target = (HTMLAttributes.target as string) || ''
    const alias = (HTMLAttributes.alias as string) || null
    const anchor = (HTMLAttributes.anchor as string) || null
    const displayText = alias || (anchor ? `${target}#${anchor}` : target)

    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-wiki-link': '',
        'data-target': target,
        'data-alias': alias || undefined,
        'data-anchor': anchor || undefined,
        class: 'tiptap-wiki-link',
        href: '#',
      }),
      displayText,
    ]
  },

  markdownTokenName: 'wikiLink',

  parseMarkdown: (token: any, helpers: any) => {
    return helpers.createNode('wikiLink', {
      target: token.target || '',
      alias: token.alias || null,
      anchor: token.anchor || null,
    })
  },

  renderMarkdown: (node: any) => {
    return formatWikiLink({
      target: node.attrs.target || '',
      alias: node.attrs.alias || null,
      anchor: node.attrs.anchor || null,
    })
  },
})
