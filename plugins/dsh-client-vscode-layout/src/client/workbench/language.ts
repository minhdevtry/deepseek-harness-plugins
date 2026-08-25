/**
 * Path → language: the CodeMirror grammar to load, and the name the status bar
 * shows.
 *
 * Those two are deliberately separate. Grammars are bundled eagerly (the
 * artifact is a single file served through the module loader, so there is no
 * code-splitting to lazily fetch one), which puts a real size cost on each,
 * and only six are carried. The *display* name has no such cost, so a Rust or
 * Go file still identifies itself in the status bar and simply renders
 * unhighlighted — better than claiming to be "Plain Text".
 */
import type { Extension } from '@codemirror/state'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'

/** Extension-keyed display names, including grammars we do not bundle. */
const DISPLAY_BY_EXT: Readonly<Record<string, string>> = {
  ts: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript', tsx: 'TypeScript JSX',
  js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript JSX',
  json: 'JSON', jsonc: 'JSON with Comments',
  md: 'Markdown', markdown: 'Markdown', mdx: 'MDX',
  py: 'Python', pyi: 'Python',
  css: 'CSS', scss: 'SCSS', less: 'Less',
  html: 'HTML', htm: 'HTML', vue: 'Vue', svelte: 'Svelte', xml: 'XML', svg: 'SVG',
  yml: 'YAML', yaml: 'YAML', toml: 'TOML', ini: 'INI',
  sh: 'Shell', bash: 'Shell', zsh: 'Shell', fish: 'Shell',
  rs: 'Rust', go: 'Go', java: 'Java', kt: 'Kotlin', swift: 'Swift',
  c: 'C', h: 'C', cpp: 'C++', cc: 'C++', hpp: 'C++', cs: 'C#',
  rb: 'Ruby', php: 'PHP', lua: 'Lua', sql: 'SQL', graphql: 'GraphQL', gql: 'GraphQL',
  dockerfile: 'Dockerfile', txt: 'Plain Text', log: 'Log',
}

/** Exact filenames that carry no useful extension. */
const DISPLAY_BY_NAME: Readonly<Record<string, string>> = {
  dockerfile: 'Dockerfile',
  makefile: 'Makefile',
  '.gitignore': 'Ignore File',
  '.editorconfig': 'INI',
  '.env': 'Properties',
}

import { basename, extensionOf } from '../utils/path.ts'

/**
 * Whether a path is markdown — the one extension that gets a WYSIWYG document
 * rather than a plain buffer, so several call sites need to agree on the test.
 * @param path - file path.
 * @returns true for `.md` and `.markdown`.
 */
export function isMarkdown(path: string): boolean {
  const ext = extensionOf(path)
  return ext === 'md' || ext === 'markdown'
}

/**
 * The language name for the status bar.
 * @returns a human name; 'Plain Text' when nothing is recognised.
 */
export function languageName(path: string): string {
  return DISPLAY_BY_NAME[basename(path).toLowerCase()] ?? DISPLAY_BY_EXT[extensionOf(path)] ?? 'Plain Text'
}

/**
 * The CodeMirror grammar for a path.
 * @returns the language extension, or undefined when none is bundled — the
 * editor then renders the file unhighlighted rather than failing.
 */
export function languageExtension(path: string): Extension | undefined {
  const ext = extensionOf(path)
  switch (ext) {
    case 'ts': case 'mts': case 'cts':
      return javascript({ typescript: true })
    case 'tsx':
      return javascript({ typescript: true, jsx: true })
    case 'jsx':
      return javascript({ jsx: true })
    case 'js': case 'mjs': case 'cjs':
      return javascript()
    case 'json': case 'jsonc':
      return json()
    case 'md': case 'markdown': case 'mdx':
      return markdown()
    case 'py': case 'pyi':
      return python()
    case 'css': case 'scss': case 'less':
      return css()
    case 'html': case 'htm': case 'vue': case 'svelte': case 'xml': case 'svg':
      return html()
    default:
      return undefined
  }
}
