import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseFrontmatter } from '../src/client/tiptap/frontmatter/parseFrontmatter.ts'

describe('parseFrontmatter', () => {
  test('parses simple key-value YAML frontmatter', () => {
    const md = `---
title: System Architecture Guide
author: Minh
date: 2026-08-17
---
# Document Body
Hello world.`

    const { meta, hasFrontmatter } = parseFrontmatter(md)
    assert.equal(hasFrontmatter, true)
    assert.equal(meta.title, 'System Architecture Guide')
    assert.equal(meta.author, 'Minh')
    assert.equal(meta.date, '2026-08-17')
  })

  test('parses inline tags array in YAML', () => {
    const md = `---
title: My Post
tags: [react, wysiwyg, notion, mermaid]
---
# Content`

    const { meta, hasFrontmatter } = parseFrontmatter(md)
    assert.equal(hasFrontmatter, true)
    assert.deepEqual(meta.tags, ['react', 'wysiwyg', 'notion', 'mermaid'])
  })

  test('parses multi-line list tags in YAML', () => {
    const md = `---
title: Post with list
tags:
  - architecture
  - plugins
  - design
---
Content`

    const { meta, hasFrontmatter } = parseFrontmatter(md)
    assert.equal(hasFrontmatter, true)
    assert.deepEqual(meta.tags, ['architecture', 'plugins', 'design'])
  })

  test('returns hasFrontmatter false when no YAML block exists', () => {
    const md = `# Regular Markdown
No frontmatter here.`

    const { hasFrontmatter, meta } = parseFrontmatter(md)
    assert.equal(hasFrontmatter, false)
    assert.deepEqual(meta, {})
  })
})
