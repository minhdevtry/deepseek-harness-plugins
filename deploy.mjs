/**
 * Install both plugin halves into a dsh profile.
 *
 * This is a thin wrapper around the sanctioned path — `dsh plugin --profile
 * <name> add link:<dir>` — and deliberately does almost nothing itself.
 *
 * What it replaced is worth recording. The previous deploy script:
 *
 *   - regex-edited the operator's own `~/.dsh/profiles/web/cordis.patch.yml`,
 *     stripping and re-adding blocks with `String.replace`;
 *   - recursively hand-copied both packages into two profile `node_modules`
 *     directories;
 *   - hand-copied `yjs`, `ws`, `y-protocols` and `lib0` alongside them, because
 *     the host package never declared them as dependencies.
 *
 * All three are now the package manager's job. Each package declares
 * `dsh.bundle.patch` and carries its own `cordis.patch.yml`; `dsh plugin add`
 * installs it, resolves its dependencies, and appends it to the profile's
 * `dsh.profile.bundles`, which the launcher composes at boot. Removal is
 * `dsh plugin --profile <name> remove <name>` and unwinds the same way — the
 * old script had no removal path at all.
 *
 * The operator's own patch file is never touched.
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

/** Profile to install into; `--profile <name>` overrides. */
const profileFlag = process.argv.indexOf('--profile')
const profile = profileFlag === -1 ? 'web' : process.argv[profileFlag + 1]

if (profile === undefined || profile.startsWith('-')) {
  console.error('usage: node deploy.mjs [--profile <name>]')
  process.exit(1)
}

/** Both halves. Order is irrelevant — patches compose over the entry list. */
const packages = ['plugins/dsh-host-files', 'plugins/dsh-client-vscode-layout']

console.log(`[+] Building…`)
execFileSync('npm', ['run', 'build'], { cwd: here, stdio: 'inherit' })

for (const relative of packages) {
  const dir = join(here, relative)
  console.log(`[+] Installing ${relative} into profile "${profile}"…`)
  // `link:` keeps the profile pointing at this working tree, so a rebuild is
  // picked up without reinstalling.
  execFileSync('dsh', ['plugin', '--profile', profile, 'add', `link:${dir}`], {
    cwd: here,
    stdio: 'inherit',
  })
}

console.log(`\n[✓] Installed. Start with:  dsh ${profile}`)
