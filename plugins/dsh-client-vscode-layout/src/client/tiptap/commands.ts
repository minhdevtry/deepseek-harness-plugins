/**
 * The slash-menu catalogue and its matcher.
 *
 * Pure data plus a pure ranking function — no editor, no DOM. The menu's
 * *behaviour* is decided here and tested directly; the popup only draws what
 * this returns.
 *
 * Three design rules, and the reasoning behind each:
 *
 * 1. **Grouped by intent, not by schema.** "Basic / Lists / Media / Advanced"
 *    maps to what someone is trying to insert. Grouping by ProseMirror concept
 *    (node vs mark vs wrapper) would be honest to the implementation and
 *    useless to the writer.
 *
 * 2. **Aliases are load-bearing.** Someone arriving from Notion types `/todo`,
 *    from markdown `/ul`, from HTML `/hr`. All three have to land. A catalogue
 *    that only matches its own display names quietly fails everyone whose
 *    vocabulary came from somewhere else.
 *
 * 3. **Subsequence match, prefix-first ranking** — the same rule the platform's
 *    own chat command menu uses. Typing `/h1` should feel identical wherever
 *    you do it in this product.
 */

/** Menu sections, in display order. */
export const GROUPS = ['basic', 'lists', 'media', 'advanced'] as const

/** One menu section. */
export type Group = (typeof GROUPS)[number]

/** Stable identifier of a command; the editor maps these to transactions. */
export type CommandId =
  | 'paragraph' | 'heading1' | 'heading2' | 'heading3'
  | 'bulletList' | 'orderedList' | 'taskList' | 'blockquote'
  | 'codeBlock' | 'table' | 'image' | 'youtube'
  | 'callout' | 'divider'

/** One entry in the slash menu. */
export interface SlashCommand {
  id: CommandId
  group: Group
  /** Shown in the row. */
  title: string
  /** One line under the title; says what it does, not what it is. */
  hint: string
  /**
   * Extra words that should find this entry. Display title words are matched
   * automatically and are not repeated here.
   */
  aliases: readonly string[]
  /** Markdown shorthand shown right-aligned, when one exists. */
  shortcut?: string
}

/**
 * The catalogue.
 *
 * Deliberately *not* everything TipTap can do. Text colour, font family and
 * alignment are formatting applied to a selection — they belong on the bubble
 * menu, where there is something selected to apply them to. Putting them here
 * would offer a writer an "insert alignment" that inserts nothing.
 */
export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { id: 'paragraph', group: 'basic', title: 'Text', hint: 'Plain paragraph', aliases: ['paragraph', 'plain', 'body', 'p'] },
  { id: 'heading1', group: 'basic', title: 'Heading 1', hint: 'Top-level section title', aliases: ['h1', 'title', 'big'], shortcut: '#' },
  { id: 'heading2', group: 'basic', title: 'Heading 2', hint: 'Section title', aliases: ['h2', 'subtitle'], shortcut: '##' },
  { id: 'heading3', group: 'basic', title: 'Heading 3', hint: 'Sub-section title', aliases: ['h3'], shortcut: '###' },
  { id: 'blockquote', group: 'basic', title: 'Quote', hint: 'Set text apart as a quotation', aliases: ['blockquote', 'cite'], shortcut: '>' },

  { id: 'bulletList', group: 'lists', title: 'Bulleted list', hint: 'An unordered list', aliases: ['ul', 'unordered', 'bullet', 'point'], shortcut: '-' },
  { id: 'orderedList', group: 'lists', title: 'Numbered list', hint: 'An ordered list', aliases: ['ol', 'ordered', 'number'], shortcut: '1.' },
  { id: 'taskList', group: 'lists', title: 'To-do list', hint: 'Checkboxes you can tick', aliases: ['todo', 'task', 'checkbox', 'check'], shortcut: '[]' },

  { id: 'image', group: 'media', title: 'Image', hint: 'Embed a picture by URL', aliases: ['picture', 'photo', 'img'] },
  { id: 'youtube', group: 'media', title: 'YouTube', hint: 'Embed a video', aliases: ['video', 'yt', 'embed'] },
  { id: 'table', group: 'media', title: 'Table', hint: 'Insert a table with header row', aliases: ['grid', 'spreadsheet'] },

  { id: 'codeBlock', group: 'advanced', title: 'Code block', hint: 'Syntax-highlighted code', aliases: ['snippet', 'fence', 'pre'], shortcut: '```' },
  { id: 'callout', group: 'advanced', title: 'Callout', hint: 'Highlight a note, tip or warning', aliases: ['note', 'info', 'tip', 'warning', 'admonition', 'alert'] },
  { id: 'divider', group: 'advanced', title: 'Divider', hint: 'Horizontal rule', aliases: ['hr', 'rule', 'separator', 'line'], shortcut: '---' },
]

/** A command plus why it matched, ready to render. */
export interface Match {
  command: SlashCommand
  /** Higher is better. */
  score: number
}

/**
 * Rank the catalogue against what has been typed after the slash.
 *
 * An empty query returns everything in catalogue order — the menu opens as a
 * browsable list, not an empty box waiting to be filled.
 * @param query - text typed after `/`, without the slash.
 * @returns matches, best first; catalogue order breaks ties.
 */
export function matchCommands(query: string): Match[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) {
    return SLASH_COMMANDS.map((command, index) => ({ command, score: -index }))
  }

  const matches: Match[] = []
  SLASH_COMMANDS.forEach((command, index) => {
    const score = scoreCommand(command, needle)
    // Catalogue order as the tie-break, expressed as a tiny penalty so it can
    // never outrank a genuinely better match.
    if (score > 0) matches.push({ command, score: score - index * 0.001 })
  })
  return matches.sort((a, b) => b.score - a.score)
}

/** Best score across a command's title words and aliases. */
function scoreCommand(command: SlashCommand, needle: string): number {
  let best = 0
  for (const candidate of [command.title.toLowerCase(), ...command.aliases]) {
    best = Math.max(best, scoreTerm(candidate, needle))
    // A whole-string prefix is as good as it gets; stop looking.
    if (best >= 100) break
  }
  return best
}

/**
 * Score one candidate term.
 *
 * Prefix beats word-boundary beats scattered subsequence. The tiers are far
 * enough apart that a weaker tier can never overtake a stronger one, which is
 * what keeps `/co` putting "Code block" above "Callout" — prefix over
 * boundary — instead of shuffling on every keystroke.
 */
function scoreTerm(candidate: string, needle: string): number {
  if (candidate.startsWith(needle)) return 100
  const words = candidate.split(/[\s-]+/)
  if (words.some(word => word.startsWith(needle))) return 60
  if (candidate.includes(needle)) return 40
  return isSubsequence(candidate, needle) ? 20 : 0
}

/** Whether `needle`'s characters appear in `candidate`, in order. */
function isSubsequence(candidate: string, needle: string): boolean {
  let index = 0
  for (const character of candidate) {
    if (character === needle[index]) index += 1
    if (index === needle.length) return true
  }
  return needle.length === 0
}

/**
 * Split ranked matches into their groups, dropping groups with no matches.
 *
 * Group order is fixed (`GROUPS`) rather than following the best score in each:
 * a menu whose sections reorder as you type is unusable for anyone building
 * muscle memory.
 * @param matches - output of {@link matchCommands}.
 * @returns non-empty groups, in display order.
 */
export function groupMatches(matches: readonly Match[]): { group: Group; matches: Match[] }[] {
  return GROUPS
    .map(group => ({ group, matches: matches.filter(match => match.command.group === group) }))
    .filter(section => section.matches.length > 0)
}
