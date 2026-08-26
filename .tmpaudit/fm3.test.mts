import { JSDOM } from '/home/minhdn3/Documents/Code/Minh/deepseek-harness-plugins/node_modules/.pnpm/jsdom@26.1.0/node_modules/jsdom/lib/api.js'
const dom = new JSDOM('<!doctype html><html><body></body></html>')
;(globalThis as any).window = dom.window
;(globalThis as any).document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
for (const k of ['HTMLElement','Element','Node','DOMParser','getComputedStyle','MutationObserver','Range','NodeFilter']) (globalThis as any)[k] = (dom.window as any)[k]
const base = process.cwd() + '/plugins/dsh-client-vscode-layout/src/client/tiptap/'
const { DocumentRegistry } = await import(base + 'documents.ts')

const src = '---\n\nIntro paragraph that the user can see in raw view.\n\n---\n\n# Real content\n\nbody\n'
const reg = new DocumentRegistry()
const ed = reg.open('/hr.md', src)
console.log('editor text content:', JSON.stringify(ed.state.doc.textContent))
console.log('-> "Intro paragraph" visible in editor?', ed.state.doc.textContent.includes('Intro paragraph'))
console.log('preview():', JSON.stringify(reg.preview('/hr.md')))
