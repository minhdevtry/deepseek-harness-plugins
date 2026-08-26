import { JSDOM } from '/home/minhdn3/Documents/Code/Minh/deepseek-harness-plugins/node_modules/.pnpm/jsdom@26.1.0/node_modules/jsdom/lib/api.js'
const dom = new JSDOM('<!doctype html><html><body><div id=h></div></body></html>', { pretendToBeVisual: true })
;(globalThis as any).window = dom.window
;(globalThis as any).document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
for (const k of ['HTMLElement','Element','Node','DOMParser','getComputedStyle','MutationObserver','Range','NodeFilter','MouseEvent','requestAnimationFrame','cancelAnimationFrame']) (globalThis as any)[k] = (dom.window as any)[k]
const base = process.cwd() + '/plugins/dsh-client-vscode-layout/src/client/tiptap/'
const { DocumentRegistry } = await import(base + 'documents.ts')

const reg = new DocumentRegistry()
const ed = reg.open('/s.md', 'Hello world, this is a sentence.\n')
reg.attach('/s.md', dom.window.document.getElementById('h')!)

// exactly what useEditorSnapshot's getSnapshot computes
const snap = () => ed.state.doc.nodeSize + ed.state.selection.from

ed.commands.setTextSelection({ from: 1, to: 6 })   // select "Hello"
const before = snap()
console.log('snapshot before toggleBold:', before, ' canUndo:', ed.can().undo())
ed.chain().toggleBold().run()
const after = snap()
console.log('snapshot after  toggleBold:', after, ' canUndo:', ed.can().undo(), ' isActive(bold):', ed.isActive('bold'))
console.log('=> re-render triggered?', before !== after ? 'YES' : 'NO  <-- BUG: toolbar/bubble state stays stale')

// second case: replace a 1-char selection with 1 char
ed.commands.setTextSelection({ from: 1, to: 2 })
const b2 = snap()
ed.chain().insertContent('X').run()
ed.commands.setTextSelection({ from: 1, to: 1 })
const a2 = snap()
console.log('\nreplace 1 char, caret back to same pos:', b2, '->', a2, b2 !== a2 ? 'YES' : 'NO  <-- BUG')

// third: the very first edit of a clean doc -- does Undo button light up?
const reg2 = new DocumentRegistry()
const ed2 = reg2.open('/t.md', '# Title\n\ntext\n')
reg2.attach('/t.md', dom.window.document.getElementById('h')!)
console.log('\nfresh doc canUndo:', ed2.can().undo(), 'snapshot:', ed2.state.doc.nodeSize + ed2.state.selection.from)
