# DSH Plugin Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the fragmented `deepseek-harness-plugins` repository into a canonical, single-package, dual-face DSH plugin (`@anoslide/dsh-vscode-workspace`) with 100% TypeScript source, comprehensive tests, and automated build/deployment.

**Architecture:** Dual-Face Cordis architecture combining a Node.js Host backend service (`src/host/` mounted on `webServer`) and a Browser Web Client layout (`src/client/` mounted via `dsh-client-modules`) built via a single unified `tsdown.config.ts`.

**Tech Stack:** TypeScript 5.9, React 18, Cordis 4+, TipTap, CodeMirror, rolldown/tsdown, lightningcss, Node test runner (`tsx --test`), DeepSeek Harness (`dsh`) v0.1.5-rc.2.

## Global Constraints
- Target platform is DeepSeek Harness (`dsh`) v0.1.5-rc.2+ with Node.js 22+.
- Single npm package with name `@anoslide/dsh-vscode-workspace`.
- No third-party plugin directories or obsolete scripts (`plugins/dsh-task-board`, `build-unified-vscode-layout.mjs`).
- 100% TypeScript for all newly authored host code; zero raw JS without type definitions.
- All file operations MUST enforce sandboxing within `SANDBOX_ROOT` (`process.env.DSH_SANDBOX_ROOT || process.cwd()`).
- All build outputs MUST conform to DSH module loader: `lib/index.js` (Host ESM) and `lib/client.js` (Client Lazy-CJS closure factory).

---

### Task 1: Clean Up Obsolete Debris & Configure Root Package Manifest

**Files:**
- Delete: `plugins/dsh-task-board/`
- Delete: `build-unified-vscode-layout.mjs`
- Delete: `build-tiptap.mjs`
- Delete: `pnpm-workspace.yaml`
- Modify: `cordis.patch.yml`
- Modify: `package.json`

**Interfaces:**
- Produces: Root `package.json` configured as a single package with scripts: `typecheck`, `build`, `test`, `deploy`.
- Produces: Root `cordis.patch.yml` inserting `@anoslide/dsh-vscode-workspace`.

- [ ] **Step 1: Delete obsolete directories and legacy scripts**

```bash
rm -rf plugins/dsh-task-board
rm -f build-unified-vscode-layout.mjs
rm -f build-tiptap.mjs
rm -f pnpm-workspace.yaml
```

- [ ] **Step 2: Update root `cordis.patch.yml`**

Create clean profile patch:
```yaml
# Profile bundle layer for the unified VS Code Workspace & Host Files plugin.
- insert:
    - id: vscode-workspace
      name: '@anoslide/dsh-vscode-workspace'
```

- [ ] **Step 3: Update root `package.json` manifest**

Configure unified dependencies, scripts, and DSH plugin fields:
```json
{
  "name": "@anoslide/dsh-vscode-workspace",
  "version": "1.0.0",
  "description": "Unified 3-Column VS Code Workspace & TipTap Notion WYSIWYG Suite for DeepSeek Harness",
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": {
      "types": "./lib/types/index.d.ts",
      "default": "./lib/index.js"
    },
    "./client": {
      "types": "./lib/types/client/index.d.ts",
      "default": "./lib/client.js"
    },
    "./package.json": "./package.json"
  },
  "dsh": {
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-ui-theme"
      ]
    },
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsdown",
    "test": "tsx --test tests/**/*.test.ts",
    "deploy": "node deploy.mjs"
  },
  "files": [
    "lib/**/*.js",
    "lib/**/*.d.ts",
    "cordis.patch.yml"
  ],
  "license": "MIT",
  "dependencies": {
    "lib0": "^0.2.117",
    "ws": "^8.21.3",
    "y-protocols": "^1.0.7",
    "yjs": "^13.6.32"
  }
}
```

- [ ] **Step 4: Commit cleanup and manifest update**

```bash
git add -A
git commit -m "chore: clean up obsolete debris and configure unified package manifest"
```

---

### Task 2: Host Subsystem TypeScript Migration & Unit Tests

**Files:**
- Create: `src/host/types.ts`
- Create: `src/host/managedRenameRewrite.ts`
- Create: `src/host/fileService.ts`
- Create: `src/host/gitService.ts`
- Create: `src/host/r2Service.ts`
- Create: `src/host/personaService.ts`
- Create: `src/host/routes.ts`
- Create: `src/index.ts`
- Create: `tests/host/managed-rename.test.ts`
- Create: `tests/host/routes.test.ts`

**Interfaces:**
- Produces: `src/index.ts` exporting `name = 'dsh-vscode-workspace'`, `inject = ['webServer']`, `apply(ctx)`.
- Produces: `src/host/routes.ts` exporting `registerHostRoutes(ctx: Context): void`.
- Produces: `src/host/types.ts` exporting `DirEntry`, `FileEntry`, `Listing`, `GitStatuses`, `ApiResult<T>`.
- Produces: `src/host/managedRenameRewrite.ts` exporting `rewriteWikiLinks`, `rewriteMarkdownLinks`, `healWorkspaceLinksOnRename`.

- [ ] **Step 1: Create `src/host/types.ts`**

Define exact interfaces for file listing, stats, git status, and API responses:
```typescript
export type ApiSuccess<T> = { ok: true } & T
export type ApiFailure = { ok: false; error: string }
export type ApiResult<T> = ApiSuccess<T> | ApiFailure

export interface DirEntry {
  name: string
  path: string
  hidden: boolean
}

export interface FileEntry extends DirEntry {
  size: number
  mtimeMs: number
}

export interface Listing {
  path: string
  sandboxRoot: string
  dirs: DirEntry[]
  files: FileEntry[]
}

export type GitStatuses = Record<string, string>

export interface GitFileChange {
  path: string
  status: string
}

export interface GitBranchInfo {
  branch: string
  upstream?: string
  ahead: number
  behind: number
}

export interface GitStatusResult extends GitBranchInfo {
  statuses: GitStatuses
  staged: GitFileChange[]
  unstaged: GitFileChange[]
}
```

- [ ] **Step 2: Write failing unit test for `managedRenameRewrite.ts`**

Create `tests/host/managed-rename.test.ts`:
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { rewriteWikiLinks, rewriteMarkdownLinks } from '../../src/host/managedRenameRewrite.ts'

test('rewriteWikiLinks rewrites wiki links preserving code blocks', () => {
  const content = [
    'See [[old-doc#Section|Old Title]]',
    '```markdown',
    '[[old-doc]] in fence should remain',
    '```',
    'Inline `[[old-doc]]` should remain',
  ].join('\n')

  const res = rewriteWikiLinks(content, 'old-doc.md', 'new-doc.md')
  assert.equal(res.rewrites, 1)
  assert.match(res.markdown, /\[\[new-doc#Section\|Old Title\]\]/)
  assert.match(res.markdown, /```markdown\n\[\[old-doc\]\]/)
})

test('rewriteMarkdownLinks rewrites relative markdown links', () => {
  const content = 'Check [Guide](./docs/old-guide.md) here.'
  const res = rewriteMarkdownLinks(content, 'docs/old-guide.md', 'docs/new-guide.md')
  assert.equal(res.rewrites, 1)
  assert.match(res.markdown, /\[Guide\]\(\.\/docs\/new-guide\.md\)/)
})
```

- [ ] **Step 3: Implement `src/host/managedRenameRewrite.ts`**

Migrate and strictly type the rename rewrite logic with AST / token protection for code fences and inline backticks.

- [ ] **Step 4: Run unit test to verify it passes**

```bash
npx tsx --test tests/host/managed-rename.test.ts
```
Expected: PASS

- [ ] **Step 5: Implement `src/host/fileService.ts` and `src/host/gitService.ts`**

Implement secure sandbox operations:
- `isInsideSandbox(targetPath: string, root: string): boolean`
- `listDirectory(dirPath: string, root: string): Promise<Listing>`
- `readFileContent(filePath: string, root: string): Promise<{ content: string; binary: boolean }>`
- `writeFileContent(filePath: string, content: string, root: string): Promise<number>`
- `createFile(filePath: string, root: string): Promise<void>`
- `createDirectory(dirPath: string, root: string): Promise<void>`
- `deleteItem(itemPath: string, root: string): Promise<void>`
- `renameItem(oldPath: string, newPath: string, root: string): Promise<{ healedFiles: string[] }>`
- `getGitStatus(root: string): Promise<GitStatusResult>`
- `gitStage(root: string, file: string): Promise<void>`
- `gitUnstage(root: string, file: string): Promise<void>`
- `gitDiscard(root: string, file: string): Promise<void>`
- `gitCommit(root: string, message: string): Promise<void>`

- [ ] **Step 6: Implement `src/host/r2Service.ts` and `src/host/personaService.ts`**

Implement Cloudflare R2 image upload and global persona handling.

- [ ] **Step 7: Implement `src/host/routes.ts` and `src/index.ts`**

Mount all HTTP `/vscode-files/*` endpoints on `ctx.webServer` and export Cordis `apply(ctx)`.

- [ ] **Step 8: Write unit test for route handlers & security**

Create `tests/host/routes.test.ts` testing sandbox path traversal protection (`../../outside` is rejected with 403).

- [ ] **Step 9: Run tests and commit host subsystem**

```bash
npx tsx --test tests/host/*.test.ts
git add src/index.ts src/host/ tests/host/
git commit -m "feat(host): implement unified TypeScript host services and unit tests"
```

---

### Task 3: Client Subsystem Migration & API Connector Alignment

**Files:**
- Move: `plugins/dsh-client-vscode-layout/src/client/` -> `src/client/`
- Move: `plugins/dsh-client-vscode-layout/assets/` -> `assets/`
- Modify: `src/client/api/files.ts`
- Delete: `plugins/dsh-client-vscode-layout/`
- Delete: `plugins/dsh-host-files/`
- Delete: `plugins/` directory

**Interfaces:**
- Consumes: `src/host/types.ts` in `src/client/api/files.ts`.
- Produces: `src/client/index.ts` exporting `name = 'dsh-vscode-workspace/client'`, `inject = ['@deepseek-ai/dsh-client-ui-theme']`, `apply(ctx)`.

- [ ] **Step 1: Move client source tree to root `src/client/`**

```bash
mkdir -p src/client
cp -r plugins/dsh-client-vscode-layout/src/client/* src/client/
mkdir -p assets
cp -r plugins/dsh-client-vscode-layout/assets/* assets/
```

- [ ] **Step 2: Update `src/client/api/files.ts` to consume types from `src/host/types.ts`**

Ensure `src/client/api/files.ts` imports canonical types from `../host/types.ts` (or local exports aligned with the host contract).

- [ ] **Step 3: Remove legacy `plugins/` directory completely**

```bash
rm -rf plugins/
```

- [ ] **Step 4: Commit client migration**

```bash
git add -A
git commit -m "refactor(client): migrate client layout to root src/client and eliminate plugins directory"
```

---

### Task 4: Unified Build Pipeline & Typecheck Verification

**Files:**
- Create: `tsdown.config.ts`
- Modify: `tsconfig.json`
- Test: `pnpm typecheck`
- Test: `pnpm build`

**Interfaces:**
- Produces: `lib/index.js` (Host ESM)
- Produces: `lib/client.js` (Client Lazy-CJS closure factory)

- [ ] **Step 1: Create unified root `tsdown.config.ts`**

Configure dual-target build using rolldown and lightningcss:
```typescript
import { defineConfig } from 'tsdown'
import { clientBundle } from './build/tsdown.client.ts'

export default defineConfig([
  // Target 1: Host Node.js Service
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node22',
    outDir: 'lib',
    clean: false,
    dts: true,
  },
  // Target 2: Web Client UI Bundle
  clientBundle('@anoslide/dsh-vscode-workspace', {
    entry: 'src/client/index.ts',
    outDir: 'lib',
  }),
])
```

- [ ] **Step 2: Align `tsconfig.json` for unified project**

Ensure `tsconfig.json` includes `src/**/*.ts`, `src/**/*.tsx`, and `tests/**/*.ts`.

- [ ] **Step 3: Run `pnpm typecheck` to verify zero type errors**

```bash
pnpm typecheck
```
Expected: PASS (0 errors)

- [ ] **Step 4: Run `pnpm build` to verify clean build**

```bash
pnpm build
```
Expected: `lib/index.js` and `lib/client.js` generated cleanly.

- [ ] **Step 5: Run test suite**

```bash
pnpm test
```
Expected: All tests PASS.

- [ ] **Step 6: Commit build configuration and verified outputs**

```bash
git add tsdown.config.ts tsconfig.json package.json
git commit -m "build: establish unified dual-target tsdown build pipeline"
```

---

### Task 5: Deployment Script, Documentation & Local Profile Verification

**Files:**
- Modify: `deploy.mjs`
- Modify: `README.md`
- Create: `docs/architecture.md`

**Interfaces:**
- Produces: Working `node deploy.mjs` registering single `@anoslide/dsh-vscode-workspace` plugin.
- Produces: Complete `README.md` and `docs/architecture.md`.

- [ ] **Step 1: Update `deploy.mjs`**

Implement automated build and single-step registration:
```javascript
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const profileFlag = process.argv.indexOf('--profile')
const profile = profileFlag === -1 ? 'web' : process.argv[profileFlag + 1]

console.log(`[+] Building @anoslide/dsh-vscode-workspace...`)
execFileSync('pnpm', ['run', 'build'], { cwd: here, stdio: 'inherit' })

console.log(`[+] Cleaning any legacy separate package links from profile "${profile}"...`)
try {
  execFileSync('dsh', ['plugin', '--profile', profile, 'remove', '@anoslide/dsh-host-files'], { cwd: here, stdio: 'ignore' })
} catch {}
try {
  execFileSync('dsh', ['plugin', '--profile', profile, 'remove', '@anoslide/dsh-client-vscode-layout'], { cwd: here, stdio: 'ignore' })
} catch {}

console.log(`[+] Installing unified plugin into profile "${profile}"...`)
execFileSync('dsh', ['plugin', '--profile', profile, 'add', `link:${here}`], {
  cwd: here,
  stdio: 'inherit',
})

console.log(`\n[✓] Installed successfully. Launch with: dsh web`)
```

- [ ] **Step 2: Update `README.md`**

Write a comprehensive, professional README including:
- Overview of 3-Column VS Code layout & TipTap Notion suite.
- Architectural diagram of the Dual-Face Cordis plugin.
- Keyboard shortcuts table (`Ctrl+K`, `Ctrl+L`, `Ctrl+B`, `Ctrl+P`, `Ctrl+Shift+F`).
- Installation & Quickstart via `deploy.mjs` or `dsh plugin add link:.`.
- Configuration and security sandboxing details.

- [ ] **Step 3: Create `docs/architecture.md`**

Document the internal design, HTTP route specifications, Cordis slot seats, and client module loader interaction.

- [ ] **Step 4: Run deployment test**

```bash
node deploy.mjs
```
Expected: Build succeeds, legacy plugins cleaned, unified plugin linked into `~/.dsh/profiles/web/`.

- [ ] **Step 5: Final commit**

```bash
git add deploy.mjs README.md docs/architecture.md
git commit -m "docs: finalize comprehensive documentation and single-step deployment script"
```
