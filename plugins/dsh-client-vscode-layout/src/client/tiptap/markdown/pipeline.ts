/**
 * Markdown AST Normalization Pipeline.
 *
 * Inspired by inkeep/open-knowledge pipeline architecture:
 * Runs deterministic, single-pass AST promoters to guarantee that markdown
 * text converges to a stable fixed-point immediately without requiring
 * expensive multi-pass headless editor instantiations.
 */

import {
  promoteVoidBr,
  promoteMath,
  promoteCallout,
  normalizeListFences,
  cleanEntitiesAndSpacing,
} from './promoters.ts'

/**
 * Normalizes Markdown text through the AST promoter pipeline.
 * Idempotent: normalizeMarkdownAST(normalizeMarkdownAST(text)) === normalizeMarkdownAST(text)
 */
export function normalizeMarkdownAST(markdown: string): string {
  let text = markdown

  // Step 1: Promote void <br /> tags into clean newlines
  text = promoteVoidBr(text)

  // Step 2: Normalize callouts (> [!NOTE])
  text = promoteCallout(text)

  // Step 3: Normalize math tokens ($...$)
  text = promoteMath(text)

  // Step 4: Stabilize nested list code fences
  text = normalizeListFences(text)

  // Step 5: Clean artifacts and normalize spacing
  text = cleanEntitiesAndSpacing(text)

  return text
}

/**
 * Fast, deterministic serializer for Markdown editor output.
 * Converts raw markdown into canonical, fixed-point normalized form.
 */
export function serializeStableAST(rawMarkdown: string): string {
  return normalizeMarkdownAST(rawMarkdown)
}
