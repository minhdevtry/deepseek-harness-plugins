/**
 * Install the unified @anoslide/dsh-vscode-workspace plugin into a dsh profile.
 *
 * Automates:
 * 1. Building host and client bundles via pnpm run build
 * 2. Pruning legacy decoupled packages (@anoslide/dsh-host-files, @anoslide/dsh-client-vscode-layout)
 * 3. Registering the unified plugin link into the target dsh profile
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const profileFlag = process.argv.indexOf('--profile')
const profile = profileFlag === -1 ? 'web' : process.argv[profileFlag + 1]

if (profile === undefined || profile.startsWith('-')) {
  console.error('usage: node deploy.mjs [--profile <name>]')
  process.exit(1)
}

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

console.log(`\n[✓] Installed successfully. Launch with: dsh ${profile}`)
