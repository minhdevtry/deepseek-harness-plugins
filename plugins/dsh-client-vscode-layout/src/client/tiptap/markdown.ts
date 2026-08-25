/**
 * Markdown in, markdown out — and the one guarantee that makes it safe to save.
 *
 * A WYSIWYG editor cannot edit markdown text; it parses markdown into a
 * document tree and regenerates markdown on the way out. That regeneration is
 * lossy, which was measured rather than assumed (see
 * `docs/dual-workspace-plan.md`): of ten real-world samples, all ten came back
 * changed on first import.
 *
 * Most of that is one-time reformatting and settles immediately. One case does
 * not: a nested list containing a fenced code block gains a blank line on
 * *every* pass. Left alone, a file grows a blank line each time it is saved —
 * quiet, cumulative rot.
 *
 * This module's job is to remove that class of bug entirely, by never treating
 * anything but a **fixed point** — text that regenerates to itself — as "the
 * document's markdown". `stabilizedRoundTrip`/`serializeStable` are how that
 * fixed point gets computed; what actually reaches disk is `reconcile.ts`'s
 * job, which patches that fixed point onto the file's real bytes so an edit to
 * one paragraph does not silently re-canonicalize the other 500 lines around
 * it (see `tiptap/documents.ts`). The one-time reformat on first open remains
 * — reconciliation has nothing to preserve until a file has been saved once
 * through it — but every save after that only touches what actually changed.
 */
import { Editor } from '@tiptap/core'
import { documentExtensions } from './extensions.ts'
import { encodeRawHtmlLines } from './html/rawHtmlLine.ts'
// Registers `Editor#getMarkdown()` via ambient module augmentation.
import '@tiptap/markdown'

/**
 * Iterations allowed while hunting for the fixed point.
 *
 * Eight rather than four: this used to run on every keystroke, where the budget
 * had to stay tiny, and now runs once per save (see tiptap/documents.ts). More
 * passes means *less* residual drift, paid for at a moment nobody is typing.
 */
const MAX_PASSES = 8

/**
 * Clean up noisy serialization artifacts.
 *
 * Used to also strip stray `<br />` tags the old `tiptap-markdown` library
 * emitted around empty table cells and paragraph boundaries — checked against
 * the current `@tiptap/markdown` pipeline and that noise no longer happens
 * (empty cells stay empty, hard breaks stay real newlines). Those regexes are
 * gone: `rawHtmlLine.ts` now models a standalone `<br>` line as real, deliberately-preserved
 * content, and a "clean up `<br>` noise" pass with no noise left to clean was
 * deleting it outright.
 */
export function cleanMarkdown(md: string): string {
  let text = md
    // Replace isolated &#x20; with spaces
    .replace(/&#x20;/g, ' ')
    // Normalize 3+ newlines down to 2
    .replace(/\n{3,}/g, '\n\n')

  return text.trimEnd() + '\n'
}

/**
 * Serialize the editor's document to markdown, normalised to a fixed point.
 *
 * The extra passes run on a throwaway headless editor, never on the live one:
 * re-parsing the operator's document to normalise whitespace would move their
 * cursor and add a bogus entry to the undo history.
 * @param editor - the live editor.
 * @returns markdown that regenerates to itself.
 */
export function serializeStable(editor: Editor): string {
  const source = cleanMarkdown(markdownOf(editor))
  return cleanMarkdown(stabilize(source, (input) => cleanMarkdown(roundTrip(input))))
}

/**
 * Drive `text` to a fixed point of `once`.
 *
 * Exported and pure: convergence is the whole safety argument, so it is tested
 * directly with a stand-in transform rather than only through a real editor.
 * @param text - starting markdown.
 * @param once - one parse/serialize round trip.
 * @returns the first stable text, or the last one tried if it never settles.
 */
export function stabilize(text: string, once: (input: string) => string): string {
  let current = text
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const next = once(current)
    if (next === current) return current
    current = next
  }
  // Not converged within the budget. The last value is still the better one:
  // it has absorbed several passes of normalisation, so the residual drift per
  // save is smaller than the first pass would leave.
  console.warn('[vscode-layout] markdown did not reach a stable form; saving the last pass')
  return current
}

/**
 * One real parse/serialize round trip, on a detached editor.
 *
 * Exported for the fixed-point tests, which need a real round trip to assert
 * that convergence is a property of the actual serializer and not just of the
 * stand-in transform. Nothing else calls it: an earlier plan had the file loader
 * use it to warn that opening a document would reformat it, and that warning was
 * dropped on purpose — reformat-on-open is the accepted cost of WYSIWYG, so the
 * dialog would have fired on nearly every markdown file and taught operators to
 * dismiss it.
 * @param text - markdown to normalise.
 * @returns the markdown TipTap would emit for that input.
 */
export function roundTrip(text: string): string {
  const editor = new Editor({
    // Detached element: never attached to the document, so it lays out nothing
    // and is discarded with the editor.
    element: document.createElement('div'),
    extensions: documentExtensions(),
    // `text` here is markdown that already regenerated raw HTML lines back to
    // their real bytes (see rawHtmlLine.ts), same as any file loaded from
    // disk — it has to go through the same encoding before this throwaway
    // editor parses it, or every stabilize() pass would drop them again.
    content: encodeRawHtmlLines(text),
    contentType: 'markdown',
  })
  try {
    return markdownOf(editor)
  } finally {
    editor.destroy()
  }
}

/**
 * One serialization pass, no fixed-point hunt — markdown for *reading*.
 *
 * Where {@link serializeStable} is for text that will be written to disk, this
 * is for text that will be measured or displayed: line-number arithmetic for a
 * mention, the raw view, a copy to the clipboard. Convergence does not matter
 * when nothing is saved, and one pass instead of up to {@link MAX_PASSES} keeps
 * it cheap enough to call from a click handler.
 * @param editor - the live editor.
 * @returns the markdown TipTap emits for the current document.
 */
export function serializeOnce(editor: Editor): string {
  return cleanMarkdown(markdownOf(editor))
}

/** Read the markdown projection off an editor. */
function markdownOf(editor: Editor): string {
  return editor.getMarkdown()
}

/**
 * The string analog of {@link serializeStable}: canonical form of `text`,
 * hunted to a fixed point, for callers that have markdown text rather than a
 * live editor. Used to seed and re-verify `reconcile.ts`'s baseline, since
 * that comparison is only meaningful against the same fixed point the live
 * editor's own save path produces.
 * @param text - markdown to normalise.
 * @returns markdown that regenerates to itself.
 */
export function stabilizedRoundTrip(text: string): string {
  return cleanMarkdown(stabilize(cleanMarkdown(roundTrip(text)), (input) => cleanMarkdown(roundTrip(input))))
}
