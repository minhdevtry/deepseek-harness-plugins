/**
 * The one write path from this plugin into the host's chat composer.
 *
 * Everything that used to reach into the composer's DOM goes through here.
 * The real implementation is built in index.ts from `ctx.conversation.input`
 * — `IConversation` documents that registry as the input face "other plugins
 * may reach", and `SessionInput.setDraft` is its "single write path for draft
 * text (all mutation rides machine events)". So the draft, its revision
 * counter and its occurrence table stay the host's business; we hand it a
 * string and nothing else.
 *
 * Why a module seam instead of prop threading: the callers are scattered
 * across three unrelated subtrees (the frame's shortcut handler, the command
 * palette, TipTap's bubble menu four levels down) and only one of them sits
 * near a registration that could inject a callback. This mirrors the seam in
 * explorer/views.ts — installed once by the plugin body, retracted on unload,
 * inert if anything calls it in between.
 */

/**
 * Append text to the current session's composer draft.
 * @param text - the fragment to append (a mention, a mention plus prompt).
 * @returns whether a composer took it; false when no session is current.
 */
export type ComposerWriter = (text: string) => boolean

/** Inert until the plugin body installs the ctx-backed writer. */
const NO_COMPOSER: ComposerWriter = () => false

let writer: ComposerWriter = NO_COMPOSER

/**
 * Seat the ctx-backed writer. Called once from the plugin body.
 * @param next - the real writer.
 * @returns disposer restoring the inert default (last-in wins, and a stale
 *   disposer from an earlier install never clobbers a newer one).
 */
export function installComposerWriter(next: ComposerWriter): () => void {
  writer = next
  return () => {
    if (writer === next) writer = NO_COMPOSER
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
 * Put the caret in the composer after a programmatic append.
 *
 * The single DOM touch left in this file, and the reason it survives: the
 * input face exposes draft mutation but no focus verb, and the whole point of
 * Ctrl+L is that the operator types their question immediately afterwards.
 * Focusing cannot corrupt state the way the old value-setter write could — on
 * a markup change this degrades to "the operator clicks the composer".
 */
export function focusComposer(): void {
  const panel = document.querySelector('[data-dsh-chat-panel="true"]')
  if (panel === null) return
  const target = panel.querySelector<HTMLElement>('textarea, div[contenteditable="true"]')
  // offsetParent filters the hidden-but-mounted composer of an inactive tab.
  if (target === null || target.offsetParent === null) return
  target.focus()
}
