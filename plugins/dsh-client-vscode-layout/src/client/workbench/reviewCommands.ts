/**
 * Cross-tree seat for AI-review commands.
 *
 * `TurnReviewCard` (the in-chat per-turn review card, registered into
 * `conversation.chat.turnTail` — a slot owned by `ui-conversation`) has no
 * React prop path to `Workbench` (registered into `root`'s own children):
 * they are separate subtrees the host mounts independently. Workbench seats
 * its live implementation here on mount; the card imports this module
 * directly, since both live in the same client bundle — the same
 * seat/decoration shape `fileOpener.ts` already uses for the reverse
 * direction (a click routed INTO the workbench), extended with a tiny
 * pub-sub so a card can re-render when review state changes underneath it.
 *
 * Every command here is a REAL verb — accept resolves the review (advancing
 * a mounted engine's baseline, or, for a background path, simply
 * acknowledging that its content is already the AI's version), and reject
 * reverts content and writes it to disk. Neither is "hide the chrome," which
 * is what a chat-side Accept/Reject used to mean.
 */

/** Real per-file line counts for one turn's still-open reviews. */
export interface ReviewFileSummary {
  path: string
  added: number
  removed: number
}

export interface ReviewCommandsApi {
  /** Every path still under AI review for one turn, with real +/- line counts. */
  summaryForTurn: (turnId: string) => ReviewFileSummary[]
  /** Resolve a path's review, keeping its current (already-adopted) content. */
  acceptAll: (path: string) => void
  /** Revert a path to its pre-AI baseline and write that to disk. */
  rejectAll: (path: string) => Promise<void>
}

const INERT: ReviewCommandsApi = {
  summaryForTurn: () => [],
  acceptAll: () => {},
  rejectAll: async () => {},
}

let api: ReviewCommandsApi = INERT
let version = 0
const listeners = new Set<() => void>()

function notify(): void {
  version += 1
  for (const listener of listeners) {
    // One throwing subscriber must not skip the rest.
    try { listener() } catch { /* not this module's problem */ }
  }
}

/**
 * Seat the live implementation. Called once from the mounted Workbench.
 * @returns disposer restoring the inert default (last-in wins).
 */
export function installReviewCommands(next: ReviewCommandsApi): () => void {
  api = next
  notify()
  return () => {
    if (api === next) { api = INERT; notify() }
  }
}

/** The current implementation — inert until Workbench installs one. */
export function reviewCommands(): ReviewCommandsApi {
  return api
}

/** Workbench calls this whenever tracked review state changes, so subscribers re-render. */
export function notifyReviewCommandsChanged(): void {
  notify()
}

export function subscribeReviewCommands(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** `useSyncExternalStore` snapshot: a bare version counter, cheap and stable until something changes. */
export function getReviewCommandsVersion(): number {
  return version
}
