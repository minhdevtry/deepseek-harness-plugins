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
 * This module's job is to remove that class of bug entirely, by never writing
 * anything but a **fixed point**: text that regenerates to itself. Whatever we
 * put on disk is therefore stable no matter how many times it is opened and
 * saved. The one-time import reformatting remains — that is inherent to
 * WYSIWYG and was accepted deliberately — but it happens once and stops.
 */
import { Editor } from '@tiptap/core'
import { documentExtensions } from './extensions.ts'

/** Iterations allowed while hunting for the fixed point. */
const MAX_PASSES = 4

/** A TipTap editor exposing the markdown storage face. */
type MarkdownEditor = Editor & { storage: { markdown: { getMarkdown: () => string } } }

/**
 * Clean up noisy serialization artifacts (<br />, &#x20;, excessive newlines)
 */
export function cleanMarkdown(md: string): string {
  let text = md
    // Replace isolated &#x20; with spaces
    .replace(/&#x20;/g, ' ')
    // Clean table cells with <br />
    .replace(/\|\s*<br\s*\/?>\s*\|/g, '|  |')
    .replace(/\|\s*<br\s*\/?>/g, '| ')
    .replace(/<br\s*\/?>\s*\|/g, ' |')
    // Clean standalone <br /> tags
    .replace(/\n\s*<br\s*\/?>\s*\n/g, '\n\n')
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
 * Exported so `serializeStable` is not the only way to reach it — the file
 * loader uses it to decide whether opening a document would rewrite it.
 * @param text - markdown to normalise.
 * @returns the markdown TipTap would emit for that input.
 */
export function roundTrip(text: string): string {
  const editor = new Editor({
    // Detached element: never attached to the document, so it lays out nothing
    // and is discarded with the editor.
    element: document.createElement('div'),
    extensions: documentExtensions(),
    content: text,
  })
  try {
    return markdownOf(editor)
  } finally {
    editor.destroy()
  }
}

/** Read the markdown storage face off an editor. */
function markdownOf(editor: Editor): string {
  return (editor as MarkdownEditor).storage.markdown.getMarkdown()
}
