import { JSDOM } from '/home/minhdn3/Documents/Code/Minh/deepseek-harness-plugins/node_modules/.pnpm/jsdom@26.1.0/node_modules/jsdom/lib/api.js'
const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>', { pretendToBeVisual: true })
;(globalThis as any).window = dom.window
;(globalThis as any).document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
for (const k of ['HTMLElement','Element','Node','DOMParser','getComputedStyle','MutationObserver','Range','NodeFilter','MouseEvent','Event','requestAnimationFrame','cancelAnimationFrame'])
  (globalThis as any)[k] = (dom.window as any)[k]

const base = process.cwd() + '/plugins/dsh-client-vscode-layout/src/client/tiptap/'
const { DocumentRegistry } = await import(base + 'documents.ts')
const { headingFoldPluginKey, foldRangeFor } = await import(base + 'headingFold/HeadingFoldPlugin.ts')

const src = `# Alpha\n\nAlpha body.\n\n## Beta\n\nBeta body.\n\n# Gamma\n\nGamma body.\n`
const reg = new DocumentRegistry()
reg.open('/f.md', src)
const host = dom.window.document.getElementById('host')!
const ed = reg.attach('/f.md', host)!
const view = ed.view

const btns = view.dom.querySelectorAll('[data-heading-fold-btn="true"]')
console.log('fold buttons rendered:', btns.length)

const first = btns[0] as any
console.log('has pmViewDesc:', !!first.pmViewDesc)
console.log('stopEvent(click) ->', first.pmViewDesc?.stopEvent?.(new dom.window.MouseEvent('click', {bubbles:true})))

// replicate ProseMirror's eventBelongsToView
function eventBelongsToView(v: any, event: any) {
  if (!event.bubbles) return true
  if (event.defaultPrevented) return false
  for (let node = event.target; node != v.dom; node = node.parentNode)
    if (!node || node.nodeType == 11 || (node.pmViewDesc && node.pmViewDesc.stopEvent(event))) return false
  return true
}
const evt = new dom.window.MouseEvent('mousedown', { bubbles: true, button: 0 })
Object.defineProperty(evt, 'target', { value: first })
console.log('eventBelongsToView(mousedown on chevron) =', eventBelongsToView(view, evt))

// Now the real thing: simulate a user click sequence on the chevron
const before = headingFoldPluginKey.getState(view.state)!.collapsed.size
for (const type of ['mousedown','mouseup','click']) {
  first.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, view: dom.window }))
}
const after = headingFoldPluginKey.getState(view.state)!.collapsed.size
console.log(`collapsed set: before=${before} after=${after}  ->`, after > before ? 'FOLDED (ok)' : 'NOTHING HAPPENED (bug)')

// foldRangeFor on the LAST heading (Gamma), whose section is the final paragraph
const doc = view.state.doc
const positions: number[] = []
doc.forEach((n, off) => { if (n.type.name === 'heading') positions.push(off) })
console.log('heading positions:', positions)
console.log('last node type:', doc.lastChild?.type.name, 'empty?', doc.lastChild?.content.size === 0)
for (const p of positions) {
  console.log(`  foldRangeFor(${p}) =`, JSON.stringify(foldRangeFor(doc, p)))
}
