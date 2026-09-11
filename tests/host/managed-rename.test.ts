import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  rewriteWikiLinks,
  rewriteMarkdownLinks,
  rewriteAllLinks,
  healWorkspaceLinksOnRename,
} from '../../src/host/managedRenameRewrite.ts'

test('rewriteWikiLinks rewrites wiki links preserving code blocks', () => {
  const content = [
    'See [[old-doc#Section|Old Title]]',
    '```markdown',
    '[[old-doc]] in fence should remain',
    '```',
    'Inline `[[old-doc]]` should remain',
  ].join('\n')

  const res = rewriteWikiLinks(content, 'old-doc.md', 'new-doc.md')
  assert.equal(res.rewrites, 1)
  assert.match(res.markdown, /\[\[new-doc#Section\|Old Title\]\]/)
  assert.match(res.markdown, /```markdown\n\[\[old-doc\]\]/)
  assert.match(res.markdown, /`\[\[old-doc\]\]`/)
})

test('rewriteMarkdownLinks rewrites relative markdown links', () => {
  const content = 'Check [Guide](./docs/old-guide.md) here.'
  const res = rewriteMarkdownLinks(content, 'docs/old-guide.md', 'docs/new-guide.md')
  assert.equal(res.rewrites, 1)
  assert.match(res.markdown, /\[Guide\]\(\.\/docs\/new-guide\.md\)/)
})

test('rewriteMarkdownLinks handles 4-arg format with source file', () => {
  const content = 'See [Other Doc](../../notes/old-note.md#tips) for info.'
  const res = rewriteMarkdownLinks(content, 'src/deep/file.md', 'notes/old-note.md', 'notes/new-note.md')
  assert.equal(res.rewrites, 1)
  assert.match(res.markdown, /\[Other Doc\]\(\.\.\/\.\.\/notes\/new-note\.md#tips\)/)
})

test('rewriteAllLinks combines markdown and wiki link healing', () => {
  const content = [
    'Read [Old Guide](./docs/old.md) and [[docs/old|Wiki Doc]].',
    '```',
    '[Old Guide](./docs/old.md)',
    '```',
  ].join('\n')

  const res = rewriteAllLinks(content, '.', 'docs/old.md', 'docs/new.md')
  assert.equal(res.rewrites, 2)
  assert.match(res.markdown, /\[Old Guide\]\(\.\/docs\/new\.md\)/)
  assert.match(res.markdown, /\[\[docs\/new\|Wiki Doc\]\]/)
  assert.match(res.markdown, /```\n\[Old Guide\]\(\.\/docs\/old\.md\)\n```/)
})

test('healWorkspaceLinksOnRename updates markdown files on disk', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'heal-test-'))
  try {
    const fileA = join(tempDir, 'fileA.md')
    const fileB = join(tempDir, 'fileB.md')
    await writeFile(fileA, 'Reference to [[fileB#overview]] and [Link](fileB.md).', 'utf8')
    await writeFile(fileB, '# File B Content', 'utf8')

    const healed = await healWorkspaceLinksOnRename(tempDir, fileB, join(tempDir, 'renamedB.md'))
    assert.equal(healed.length, 1)
    assert.equal(healed[0], fileA)

    const updatedContent = await readFile(fileA, 'utf8')
    assert.match(updatedContent, /\[\[renamedB#overview\]\]/)
    assert.match(updatedContent, /\[Link\]\(renamedB\.md\)/)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
