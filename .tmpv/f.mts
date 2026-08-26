import { JSDOM } from '/home/minhdn3/Documents/Code/Minh/deepseek-harness-plugins/node_modules/.pnpm/jsdom@26.1.0/node_modules/jsdom/lib/api.js'
const dom = new JSDOM('<!doctype html><html><body></body></html>')
;(globalThis as any).window = dom.window
;(globalThis as any).document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
for (const k of ['HTMLElement','Element','Node','DOMParser','getComputedStyle','MutationObserver','Range','NodeFilter']) (globalThis as any)[k] = (dom.window as any)[k]
const base = process.cwd() + '/plugins/dsh-client-vscode-layout/src/client/tiptap/'
const { roundTrip } = await import(base + 'markdown.ts')
const { splitFrontmatter } = await import(base + 'frontmatter/splitFrontmatter.ts')
const { parseFrontmatter } = await import(base + 'frontmatter/parseFrontmatter.ts')
const say = (s: string) => process.stdout.write(s + '\n')
let bad = 0

say('### R-1 blockquote + opaque line')
for (const [n, s] of Object.entries({
  'quote+comment+text': '> normal text\n> <!-- c -->\n> more text\n',
  'quote w/ footnote': '> [^1]: note\n',
  'quote only comment': '> <!-- c -->\n',
  'plain comment': '<!-- c -->\n',
  'indented comment': 'text\n\n  <!-- c -->\n\ntail\n',
  'anchor line': '<a id="x"></a>\n\n# H\n',
  'code fence w/ comment': '```\n<!-- not opaque -->\n```\n',
})) {
  const out = roundTrip(s); const ok = out.trim() === s.trim(); if (!ok) bad++
  say(`  ${n.padEnd(22)} ${ok ? 'OK' : 'CHANGED'}`)
  if (!ok) { say(`     IN : ${JSON.stringify(s)}`); say(`     OUT: ${JSON.stringify(out)}`) }
}

say('\n### R-2 frontmatter guard + parser')
for (const [n, s] of Object.entries({
  'quoted key': '---\n"my key": v\ntitle: x\n---\n\n# H\n',
  'single-quoted': "---\n'on': push\n---\n\n# H\n",
  'blank first line': '---\n\ntitle: x\n---\n\n# H\n',
  'list at root': '---\n- a\n- b\n---\n\n# H\n',
  'comment first': '---\n# note\ntitle: x\n---\n\n# H\n',
  'normal': '---\ntitle: x\ntags:\n  - a\n---\n\n# H\n',
  'PROSE must reject': '---\n\nIntro text here\n\n---\n\n# Real\n',
})) {
  const det = splitFrontmatter(s).frontmatter !== ''
  const rt = roundTrip(s)
  const shouldDetect = n !== 'PROSE must reject'
  const ok = det === shouldDetect && rt.trim() === s.trim()
  if (!ok) bad++
  say(`  ${n.padEnd(20)} detected=${det ? 'yes' : 'no '}  roundtrip=${rt.trim() === s.trim() ? 'OK' : 'CHANGED'} ${ok ? '' : ' <-- ISSUE'}`)
  if (!ok) say(`     OUT: ${JSON.stringify(rt)}`)
}

say('\n### parseFrontmatter (card display) with quoted keys')
const meta = parseFrontmatter('---\n"my key": v\n\'on\': push\ntitle: x\n---\n').meta
say('  ' + JSON.stringify(meta))

say(`\n${bad === 0 ? 'ALL CLEAN' : bad + ' issue(s)'}`)
