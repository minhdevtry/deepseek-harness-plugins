/**
 * Where a file click anywhere in the host lands.
 *
 * The chat's tool rows and its closing-prose file mentions both call one
 * function — ui-conversation injects `openFile` as
 * `workspaces.openPath(resolveWorkspacePath(cwd, path))` — and `openPath` is
 * documented as "open with the Host operating system's default application".
 * That is the right default for a shell with no editor in it. This plugin *is*
 * an editor, so a click on a workspace file belongs in a tab, not in whatever
 * the OS has registered for `.md`.
 *
 * There is no slot or event for this. `chatFileMentions` is providable, but the
 * reference provider is handed `owner.openFile` and the tool rows never consult
 * it at all, so it reaches only half the surface. So the seam here is a
 * decoration of the service method: claim what the workbench can genuinely
 * show, and **delegate everything else to the original**. Nothing is removed —
 * a PDF, an archive, a directory still opens exactly as it does today.
 *
 * Installed as a reversible `ctx.effect` (see index.ts), so unloading the
 * plugin restores the host's own method.
 */

/**
 * Show a path in the workbench.
 * @param path - absolute file path.
 * @returns whether a workbench took it; false when the frame is not mounted.
 */
export type WorkbenchOpener = (path: string) => boolean

/** Inert until the frame installs the real opener. */
const NO_WORKBENCH: WorkbenchOpener = () => false

let opener: WorkbenchOpener = NO_WORKBENCH

/**
 * Seat the frame's opener. Called once from the mounted frame.
 * @param next - the real opener.
 * @returns disposer restoring the inert default (last-in wins, and a stale
 *   disposer from an earlier install never clobbers a newer one).
 */
export function installWorkbenchOpener(next: WorkbenchOpener): () => void {
  opener = next
  return () => {
    if (opener === next) opener = NO_WORKBENCH
  }
}

/**
 * Extensions handed straight to the operating system.
 *
 * The inverse of an allowlist on purpose: an editor can show anything
 * text-shaped, including the extensionless files a repo is full of
 * (`Makefile`, `LICENSE`, `.gitignore`), and listing those exhaustively would
 * mean a click falling through to the OS every time the list missed one. What
 * genuinely does not belong in a text editor is a closed set — documents with
 * their own reader, archives, media, binaries — so that is what gets named.
 */
const OS_EXTENSIONS: ReadonlySet<string> = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf',
  'zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar', 'jar', 'iso', 'dmg',
  'mp3', 'wav', 'flac', 'ogg', 'm4a', 'mp4', 'mkv', 'mov', 'avi', 'webm',
  'exe', 'dll', 'so', 'dylib', 'bin', 'deb', 'rpm', 'appimage', 'msi',
  'ttf', 'otf', 'woff', 'woff2', 'eot', 'psd', 'ai', 'sketch', 'fig', 'blend',
  'sqlite', 'db', 'wasm', 'class', 'pyc', 'o', 'a',
])

/**
 * Extensions the workbench renders as a first-class view, which also settles
 * that the path is a file rather than a directory — no probe needed.
 */
const KNOWN_FILE = /\.(md|markdown|mdx|txt|log|json|jsonc|ya?ml|toml|ini|env|csv|tsv|html?|xml|svg|css|scss|less|[cm]?[jt]sx?|py|pyi|rs|go|java|kt|swift|c|h|cpp|cc|hpp|cs|rb|php|lua|sql|graphql|gql|sh|bash|zsh|fish|png|jpe?g|gif|webp|ico|bmp|patch|diff|lock)$/i

import { extensionOf } from './utils/path.ts'

/** How a clicked path should be routed. */
export type Route =
  /** Open in a workbench tab. */
  | 'workbench'
  /** Hand to the operating system — the host's own behaviour, untouched. */
  | 'os'
  /**
   * The name settles nothing. Claim it only on positive evidence that the host
   * can read it as a file; anything else (a directory, an unreachable path) is
   * the operating system's business.
   */
  | 'probe'

/**
 * Decide where a path goes, from its name alone.
 *
 * Exported and pure: this is the whole policy of the interception, so it is
 * asserted directly rather than only through a live click.
 * @param path - the clicked path.
 * @returns the route to take.
 */
export function routeFor(path: string): Route {
  const trimmed = path.trim()
  if (trimmed === '') return 'os'
  // A trailing separator is only ever written for a directory.
  if (trimmed.endsWith('/') || trimmed.endsWith('\\')) return 'os'
  if (OS_EXTENSIONS.has(extensionOf(trimmed))) return 'os'
  if (KNOWN_FILE.test(trimmed)) return 'workbench'
  // `Makefile` and `src/components` are spelled the same way; only the host knows.
  return 'probe'
}

/**
 * Try to show a path in the workbench.
 * @param path - absolute file path.
 * @returns whether the workbench took it.
 */
export function openInWorkbench(path: string): boolean {
  return opener(path)
}
