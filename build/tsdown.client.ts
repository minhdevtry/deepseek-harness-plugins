/**
 * Shared tsdown preset for our UI plugin client bundles.
 *
 * Mirrors the upstream preset (`.ref/deepseek-harness/packages/client/tsdown.client.ts`)
 * so our artifacts are byte-compatible with what the dsh module loader expects:
 * the bundle calls `window.__ModuleLoader__.load({ id, factory })` and resolves
 * externals through the injected `require` (the loader's frozen module table —
 * cordis DI entities, no globals, no import map).
 *
 * CSS Modules are compiled by lightningcss inside the bundle: importing
 * `x.module.css` yields the hashed class map, and the css text auto-injects a
 * `<style data-plugin="<id>">` tag at factory execution (the loader removes
 * plugin-owned tags on unload).
 */
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve as resolvePath } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

/**
 * The module specifiers the shell shares into the frozen module table.
 * Kept in sync with `.ref/deepseek-harness/packages/client/web/src/platform.ts`
 * — a specifier missing here inlines a duplicate runtime instance instead of
 * sharing the shell's, which breaks React and cordis identity.
 */
export const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
] as const

/**
 * The snapshot-store engine (`defineStore`, `createSnapshotStore`) lives in the
 * runtime package and is answered natively by the lazy CJS table: runtime is an
 * `immediately`-tier row, so its factory is registered before any dependent
 * bundle materializes. Upstream carries the same documented exemption.
 */
const RUNTIME_STORE_EXEMPTION = '@deepseek-ai/dsh-client-runtime/client'

/** Externals resolved from the loader module table. */
export const CLIENT_EXTERNALS: readonly string[] = [...PLATFORM_MODULES, RUNTIME_STORE_EXEMPTION]

/**
 * Virtual-id wrapper keeping module CSS away from tsdown's own css pipeline
 * (which requires @tsdown/css). The suffix matters: tsdown's guard matches ids
 * ending in `.css`, so the virtual id must not.
 */
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/**
 * Build the tsdown config for one UI plugin package: the node half (`src/index.ts`
 * → `lib/index.js`) plus the browser client bundle (`src/client/index.ts` →
 * `lib/client.js`).
 * @param id - plugin id (package name), stamped into the `__ModuleLoader__.load`
 * handoff and onto the injected style tags.
 * @returns the two tsdown configs.
 */
export function clientBundle(id: string): UserConfig[] {
  return [nodeHalf(id), browserHalf(id)]
}

/** The node half: a thin cordis plugin the host Loader imports. */
function nodeHalf(id: string): UserConfig {
  return {
    name: id,
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  }
}

/** The browser half: the `__ModuleLoader__` closure-factory artifact. */
function browserHalf(id: string): UserConfig {
  return {
    name: `${id}/client`,
    entry: { client: 'src/client/index.ts' },
    // Browser bundle lands next to the node half; `clean` must stay off or it
    // would wipe the node-half output emitted above.
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      // Loader module-table entries stay external; tsdown auto-externalizes
      // package dependencies, so everything NOT in the table must inline
      // instead. A require() the table cannot answer is a guaranteed runtime
      // throw, which is why the rule is the table list itself.
      neverBundle: [...CLIENT_EXTERNALS],
      alwaysBundle: (source: string) => !CLIENT_EXTERNALS.includes(source),
    },
    // zustand/immer read process.env.NODE_ENV; zustand's esm build also probes
    // import.meta.env.MODE, which a CJS output cannot carry. Without these
    // substitutions the factory throws ReferenceError at boot.
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    plugins: [purityGate(), cssModules(id)],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  }
}

/**
 * Build-time mirror of the module-edge rules: platform seed entries stay
 * external, and every other `@deepseek-ai` **value** import is a build error —
 * it would either inline a duplicate runtime instance or require a specifier
 * the frozen module table cannot answer. Cross-plugin collaboration goes
 * through cordis services. Type-only imports are erased and never reach here.
 */
function purityGate() {
  return {
    name: 'dsh-client-bundle-purity',
    resolveId(source: string) {
      if (!source.startsWith('@deepseek-ai/')) return null
      if (CLIENT_EXTERNALS.includes(source)) return null
      throw new Error(
        `client bundle purity: "${source}" is not a platform module (CLIENT_EXTERNALS) — `
        + 'cross-plugin value imports are forbidden; collaborate through cordis services '
        + '(type-only imports are erased and never reach this gate)',
      )
    },
  }
}

/** Compile `*.module.css` to a hashed class map plus a self-injecting style tag. */
function cssModules(id: string) {
  return {
    name: 'dsh-css-modules-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      const abs = importer !== undefined ? resolvePath(dirname(importer), source) : source
      return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
    },
    async load(this: { addWatchFile: (id: string) => void }, virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      // The virtual id otherwise hides the physical stylesheet from the watch graph.
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: source,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap: Record<string, string> = {}
      for (const [local, exported] of Object.entries(cssExports ?? {})) classMap[local] = exported.name
      const tagId = `${id}/${basename(fileId)}`
      // One <style data-plugin> per module file; idempotent under re-evaluation.
      return [
        `const css = ${JSON.stringify(code.toString())};`,
        `const tagId = ${JSON.stringify(tagId)};`,
        'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
        '  const tag = document.createElement(\'style\');',
        `  tag.dataset.plugin = ${JSON.stringify(id)};`,
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        `export default ${JSON.stringify(classMap)};`,
      ].join('\n')
    },
  }
}
