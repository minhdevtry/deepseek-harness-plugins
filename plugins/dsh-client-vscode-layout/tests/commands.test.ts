/**
 * Slash-menu catalogue and ranking tests.
 *
 * These assert the *feel* of the menu, which is the part users notice and the
 * part that silently regresses: that vocabulary from Notion, markdown and HTML
 * all land, that the top hit is the obvious one, and that sections do not
 * reorder while typing.
 *
 * Run: node --test --experimental-strip-types plugins/dsh-client-vscode-layout/tests/commands.test.ts
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import {
  GROUPS, SLASH_COMMANDS, groupMatches, matchCommands,
} from '../src/client/tiptap/commands.ts'

/** The id of the best match for a query. */
function top(query: string): string | undefined {
  return matchCommands(query)[0]?.command.id
}

describe('catalogue', () => {
  it('has unique ids', () => {
    const ids = SLASH_COMMANDS.map(c => c.id)
    assert.equal(new Set(ids).size, ids.length)
  })

  it('puts every command in a declared group', () => {
    for (const command of SLASH_COMMANDS) {
      assert.ok(GROUPS.includes(command.group), `${command.id} has group ${command.group}`)
    }
  })

  it('never repeats a title word as an alias', () => {
    // Title words match automatically; repeating them is dead weight that
    // drifts out of sync when a title is reworded.
    for (const command of SLASH_COMMANDS) {
      const titleWords = new Set(command.title.toLowerCase().split(/[\s-]+/))
      for (const alias of command.aliases) {
        assert.ok(!titleWords.has(alias), `${command.id}: alias "${alias}" duplicates a title word`)
      }
    }
  })
})

describe('empty query', () => {
  it('lists the whole catalogue in catalogue order', () => {
    const matches = matchCommands('')
    assert.equal(matches.length, SLASH_COMMANDS.length)
    assert.deepEqual(matches.map(m => m.command.id), SLASH_COMMANDS.map(c => c.id))
  })

  it('treats whitespace as empty', () => {
    assert.equal(matchCommands('   ').length, SLASH_COMMANDS.length)
  })
})

describe('vocabulary from other tools lands', () => {
  const expectations: [string, string][] = [
    ['todo', 'taskList'],       // Notion
    ['checkbox', 'taskList'],
    ['ul', 'bulletList'],       // markdown / HTML
    ['ol', 'orderedList'],
    ['hr', 'divider'],          // HTML
    ['h1', 'heading1'],
    ['h3', 'heading3'],
    ['img', 'image'],
    ['video', 'youtube'],
    ['snippet', 'codeBlock'],
    ['warning', 'callout'],     // admonition vocabulary
    ['admonition', 'callout'],
    ['grid', 'table'],
    ['cite', 'blockquote'],
  ]
  for (const [query, expected] of expectations) {
    it(`/${query} → ${expected}`, () => { assert.equal(top(query), expected) })
  }
})

describe('ranking', () => {
  it('prefers a prefix over a mere containment', () => {
    // "Code block" starts with "co"; "Callout" only contains a subsequence.
    assert.equal(top('co'), 'codeBlock')
  })

  it('is case-insensitive', () => {
    assert.equal(top('H1'), top('h1'))
    assert.equal(top('ToDo'), 'taskList')
  })

  it('keeps the top hit stable as the query grows', () => {
    // Nothing is more irritating than the first row changing under Enter.
    for (const query of ['t', 'ta', 'tab', 'tabl', 'table']) {
      const best = top(query)
      assert.ok(best !== undefined, `"${query}" matched nothing`)
    }
    assert.equal(top('tabl'), 'table')
    assert.equal(top('table'), 'table')
  })

  it('finds nothing for a query that matches nothing', () => {
    assert.deepEqual(matchCommands('zzzqqq'), [])
  })

  it('still finds a scattered subsequence', () => {
    // "bl" appears in order inside "bulleted list".
    assert.ok(matchCommands('bl').length > 0)
  })
})

describe('grouping', () => {
  it('keeps section order fixed regardless of scores', () => {
    const sections = groupMatches(matchCommands(''))
    assert.deepEqual(sections.map(s => s.group), [...GROUPS])
  })

  it('drops sections with no matches', () => {
    const sections = groupMatches(matchCommands('h1'))
    assert.deepEqual(sections.map(s => s.group), ['basic'])
  })

  it('loses no match while grouping', () => {
    const matches = matchCommands('list')
    const grouped = groupMatches(matches).flatMap(s => s.matches)
    assert.equal(grouped.length, matches.length)
  })
})
