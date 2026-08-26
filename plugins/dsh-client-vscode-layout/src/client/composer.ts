/**
 * The write path from this plugin into the host's chat composer.
 *
 * Everything that reaches into the composer's input face goes through here.
 * The real implementation is built in index.ts from `ctx.conversation.input`
 * — `IConversation` documents that registry as the input face "other plugins
 * may reach", and `SessionInput` is its single write path.
 *
 * Supports two distinct verbs:
 * 1. `appendToComposer(text)` — appends raw plain text to the draft.
 * 2. `appendReferenceToComposer(ref)` — inserts an authentic U+FFFC reference chip
 *    into the draft, backed by the host's ReferenceInsert and Occurrence system.
 */

/** Reference chip data structure for the composer. */
export interface ComposerReference {
  /** Registered source name — must match FILE_SOURCE ('files'). */
  readonly source: string
  /** Identifier for source; this is what codec.serialize() receives. */
  readonly ref: string
  /** Label displayed on the 4em chip. */
  readonly label: string
  /** Text representation for clipboard/persist, NOT what's sent to model. */
  readonly clipboardText: string
}

/**
 * Append text to the current session's composer draft.
 * @param text - the fragment to append (a mention, a mention plus prompt).
 * @returns whether a composer took it; false when no session is current.
 */
export type ComposerWriter = (text: string) => boolean

/** Writer for reference chips. */
export type ReferenceWriter = (ref: ComposerReference) => boolean

/** Inert until the plugin body installs the ctx-backed writers. */
const NO_COMPOSER: ComposerWriter = () => false
const NO_REFERENCE: ReferenceWriter = () => false

let writer: ComposerWriter = NO_COMPOSER
let referenceWriter: ReferenceWriter = NO_REFERENCE

/**
 * Seat the ctx-backed writer. Called once from the plugin body.
 * @param next - the real writer.
 * @returns disposer restoring the inert default.
 */
export function installComposerWriter(next: ComposerWriter): () => void {
  writer = next
  return () => {
    if (writer === next) writer = NO_COMPOSER
  }
}

/**
 * Seat the ctx-backed reference chip writer. Called once from the plugin body.
 * @param next - the real reference writer.
 * @returns disposer restoring the inert default.
 */
export function installReferenceWriter(next: ReferenceWriter): () => void {
  referenceWriter = next
  return () => {
    if (referenceWriter === next) referenceWriter = NO_REFERENCE
  }
}

/**
 * Append text to the composer draft, separated from whatever is already
 * typed there and left with a trailing space so the operator can keep typing.
 * @param text - the fragment to append.
 * @returns whether the write landed.
 */
export function appendToComposer(text: string): boolean {
  return writer(text)
}

/**
 * Append a reference chip to the end of the composer draft.
 * @param ref - the reference chip definition.
 * @returns whether the chip was successfully inserted.
 */
export function appendReferenceToComposer(ref: ComposerReference): boolean {
  return referenceWriter(ref)
}

/**
 * Resolve an absolute path to a workspace-relative path against session cwd.
 */
export function toWorkspaceRelative(abs: string, cwd: string | undefined): string {
  if (cwd === undefined) return abs
  const root = cwd.endsWith('/') ? cwd : `${cwd}/`
  return abs.startsWith(root) ? abs.slice(root.length) : abs
}

/**
 * Short label for 4em (~64px) chip cell: fits ~10 characters.
 * Prioritizes line numbers since that distinguishes chips of the same file.
 */
import { basename } from './utils/path.ts'
import { FILE_SOURCE } from './inputTriggers/fileSource.ts'

/**
 * Normalize any line range into canonical `#Lstart-end` or `#Lstart` format.
 * Strips duplicate `L`s: e.g. `#L36-L43` -> `#L36-43`, `L36-L43` -> `#L36-43`.
 */
export function normalizeLineRange(range: string): string {
  const trimmed = range.trim()
  if (!trimmed) return ''
  // Strip duplicate -L\d+ to -\d+
  const singleL = trimmed.replace(/-L(\d+)/g, '-$1')
  if (singleL.startsWith('#L')) return singleL
  if (singleL.startsWith('#')) return `#L${singleL.slice(1)}`
  if (singleL.startsWith('L')) return `#L${singleL.slice(1)}`
  return `#L${singleL}`
}

/**
 * Format a file mention using pure filename (basename) and optional line range #L...
 * Examples:
 * - formatFileMention('/path/to/ARCHITECTURE.md') -> '@ARCHITECTURE.md'
 * - formatFileMention('/path/to/AppFrame.tsx', '#L36-L43') -> '@AppFrame.tsx#L36-43'
 * - formatFileMention('/path/to/AppFrame.tsx', '#L2-6') -> '@AppFrame.tsx#L2-6'
 * - formatFileMention('file.ts', '1-90') -> '@file.ts#L1-90'
 */
export function formatFileMention(path: string, range?: string): string {
  const filename = basename(path) || path
  if (!range) return `@${filename}`
  const lineTag = normalizeLineRange(range)
  return `@${filename}${lineTag}`
}

/**
 * Send a file mention as an authentic blue reference chip into the chat composer,
 * falling back to plain text if reference chips are unsupported.
 */
export function sendFileMention(path: string, range?: string): boolean {
  const filename = basename(path) || path
  const cleanRange = range ? normalizeLineRange(range) : ''
  const ref = `${filename}${cleanRange}`
  const label = `${filename}${cleanRange}`
  const clipboardText = `@${filename}${cleanRange}`

  const ok = appendReferenceToComposer({
    source: FILE_SOURCE,
    ref,
    label,
    clipboardText,
  })
  if (ok) return true
  return appendToComposer(clipboardText)
}

/**
 * Append a formatted file mention string to the chat composer.
 */
export function appendMentionToComposer(path: string, range?: string): boolean {
  return sendFileMention(path, range)
}

/**
 * Put the caret in the composer after a programmatic append.
 */
export function focusComposer(): void {
  const panel = document.querySelector('[data-dsh-chat-panel="true"]')
  if (panel === null) return
  const target = panel.querySelector<HTMLElement>('textarea, div[contenteditable="true"]')
  // offsetParent filters the hidden-but-mounted composer of an inactive tab.
  if (target === null || target.offsetParent === null) return
  target.focus()
}
