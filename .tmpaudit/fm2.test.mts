import { JSDOM } from '/home/minhdn3/Documents/Code/Minh/deepseek-harness-plugins/node_modules/.pnpm/jsdom@26.1.0/node_modules/jsdom/lib/api.js'
const dom = new JSDOM('<!doctype html><html><body></body></html>')
;(globalThis as any).window = dom.window
;(globalThis as any).document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
for (const k of ['HTMLElement','Element','Node','DOMParser','getComputedStyle','MutationObserver','Range','NodeFilter']) (globalThis as any)[k] = (dom.window as any)[k]
const base = process.cwd() + '/plugins/dsh-client-vscode-layout/src/client/tiptap/'
const { splitFrontmatter } = await import(base + 'frontmatter/splitFrontmatter.ts')
const { DocumentRegistry } = await import(base + 'documents.ts')
const { roundTrip } = await import(base + 'markdown.ts')

console.log('### A. False-positive frontmatter detection')
const cases: Record<string,string> = {
  'leading hr then hr': '---\n\nIntro text\n\n---\n\n# Real content\n',
  'setext h2 doc':      'Title\n---\n\nbody\n\n---\n',
  'real frontmatter':   '---\ntitle: x\n---\n\n# H\n',
  'yaml w/ blank line': '---\ntitle: x\n\nauthor: y\n---\n\n# H\n',
  'no frontmatter':     '# H\n\ntext\n',
}
for (const [n, s] of Object.entries(cases)) {
  const r = splitFrontmatter(s)
  console.log(`  ${n.padEnd(22)} fm=${JSON.stringify(r.frontmatter)}`)
}

console.log('\n### B. Save an UNEDITED frontmatter doc — bytes preserved?')
for (const [n, s] of Object.entries({ simple: '---\ntitle: x\n---\n\n# H\n\nbody\n', blankInYaml: '---\ntitle: x\n\nauthor: y\n---\n\n# H\n', noBlankAfter: '---\ntitle: x\n---\n# H\n' })) {
  const reg = new DocumentRegistry()
  reg.open('/a.md', s)
  const out = reg.markdown('/a.md')!
  console.log(`  ${n.padEnd(14)} identical=${out === s}`)
  if (out !== s) { console.log('    IN :', JSON.stringify(s)); console.log('    OUT:', JSON.stringify(out)) }
}

console.log('\n### C. roundTrip idempotence on frontmatter')
const s = '---\ntitle: x\n\nauthor: y\n---\n\n# H\n'
let cur = s
for (let i=0;i<3;i++){ const n = roundTrip(cur); console.log(`  pass${i+1}`, JSON.stringify(n)); if(n===cur){console.log('  converged');break} cur=n }
