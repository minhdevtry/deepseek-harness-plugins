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
export const FILE_SOURCE = 'files'

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
    name: FILE_SOURCE,
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
      return result.value.slice(0, LIMIT).map((hit) => {
        if (hit.rel !== hit.name) {
          return { name: hit.name, description: hit.rel }
        }
        return { name: hit.name }
      })
    },
    onPick({ candidate }) {
      return {
        insert: {
          source: FILE_SOURCE,
          ref: candidate.name,
          label: candidate.name,
          clipboardText: `@${candidate.name}`,
        },
      }
    },
    codec: {
      clipboardText: ref => `@${ref}`,
      serialize: async (ref) => {
        const hash = ref.lastIndexOf('#L')
        if (hash === -1) return `@${ref}`
        const path = ref.slice(0, hash).trim()
        const rangePart = ref.slice(hash + 2)
        const [aStr, bStr] = rangePart.split('-')
        const a = parseInt(aStr || '1', 10)
        const b = bStr ? parseInt(bStr.replace(/^L/, ''), 10) : a

        const win = typeof window !== 'undefined' ? (window as any) : (globalThis as any)
        const text = win.__dsh_get_active_text?.(path)
        if (typeof text !== 'string' || isNaN(a)) return `@${ref}`

        const lines = text.split('\n').slice(Math.max(0, a - 1), b)
        // Guard against massive prompts (limit to 200 lines or 8KB)
        if (lines.length > 200 || lines.join('\n').length > 8192) {
          return `@${ref}`
        }
        return `@${path}#L${a}${b !== a ? `-${b}` : ''}\n\`\`\`\n${lines.join('\n')}\n\`\`\``
      },
    },
  }
}
