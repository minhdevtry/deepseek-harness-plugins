/**
 * Workspace files as an `@` candidate source.
 *
 * This is the sanctioned way to extend the composer: `registerSource` ADDS a
 * group to the host's existing `@` menu, beside ui-subagent's running-agent
 * group. It replaces nothing and touches no DOM — the menu, keyboard
 * arbitration, IME guard, span CAS and reference decoration all stay the
 * host's.
 *
 * This is the only path that runs with a trigger token under the caret, so it
 * is the only one the `slash/input-*` events can serve (they are span-CAS'd
 * against the draft revision at menu-open time). Ctrl+L and the bubble menu
 * append a mention with no token to replace; they go through the host's other
 * input face, `ctx.conversation.input` — see composer.ts.
 */
import type { ClientSessionContext, InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { searchNames } from '../api/files.ts'

/** Menu group label; unique per trigger (a duplicate registration throws). */
const GROUP = 'files'

/**
 * How many hits reach the menu. The host renders one group among several, so a
 * long roll would bury ui-subagent's; the query narrows fast enough that the
 * tail is rarely what the operator wanted.
 */
const LIMIT = 20

/**
 * Build the `@` file source.
 *
 * The root is resolved per call from the asking session rather than captured at
 * registration: sources are registered once at boot, but each session has its
 * own cwd, and mentioning a file must search the directory that session's agent
 * will actually resolve the path against.
 *
 * @param resolveRoot - the asking session's workspace root, if it has one yet.
 * @returns the source to hand to `ctx.inputTriggers.registerSource`.
 */
export function createFileSource(
  resolveRoot: (session: ClientSessionContext) => string | undefined,
): InputTriggerSource {
  return {
    trigger: '@',
    name: GROUP,
    // Agents are the rarer, more deliberate mention; files are the bulk. A
    // higher order keeps this group under ui-subagent's default 0.
    order: 10,
    async candidates(session, { query, signal }) {
      const root = resolveRoot(session)
      if (root === undefined) return []
      const result = await searchNames(root, query, signal)
      // A failed or superseded search is an empty group, never a thrown menu:
      // the host drops a failing source silently and the operator keeps typing.
      if (!result.ok) return []
      return result.value.slice(0, LIMIT).map(hit => ({
        name: hit.rel,
        description: hit.name,
      }))
    },
    onPick({ candidate }) {
      // Plain-text reference: the literal lands in the draft and ships to the
      // model verbatim. The trailing space closes the token, which is what
      // stops the menu from immediately reopening on the same span.
      return { text: `@${candidate.name} ` }
    },
    codec: {
      clipboardText: ref => `@${ref}`,
      // The workspace path IS the model representation — the agent resolves it
      // against the session cwd, so there is nothing to expand here.
      serialize: ref => Promise.resolve(`@${ref}`),
    },
  }
}
