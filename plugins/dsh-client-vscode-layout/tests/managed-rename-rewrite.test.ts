import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  rewriteWikiLinks,
  rewriteMarkdownLinks,
  rewriteAllLinks,
} from '../src/client/utils/managedRenameRewrite.ts'

describe('Managed Rename Rewrite Engine (Task 8)', () => {
  test('rewrites wiki-links pointing to renamed document', () => {
    const input = 'See [[design-system]] for tokens and [[design-system#colors|Color Specs]]. Other link [[other-doc]].'
    const result = rewriteWikiLinks(input, 'design-system', 'core-tokens')
    assert.equal(
      result.markdown,
      'See [[core-tokens]] for tokens and [[core-tokens#colors|Color Specs]]. Other link [[other-doc]].',
    )
    assert.equal(result.rewrites, 2)
  })

  test('does not rewrite wiki-links inside inline code or code blocks', () => {
    const input = 'Active link [[old-doc]]. Inline `code with [[old-doc]]`. \n```\nBlock with [[old-doc]]\n```\nAnother [[old-doc]].'
    const result = rewriteWikiLinks(input, 'old-doc', 'new-doc')
    assert.equal(
      result.markdown,
      'Active link [[new-doc]]. Inline `code with [[old-doc]]`. \n```\nBlock with [[old-doc]]\n```\nAnother [[new-doc]].',
    )
    assert.equal(result.rewrites, 2)
  })

  test('rewrites relative markdown links and preserves anchors & query params', () => {
    const sourceDoc = 'docs/architecture/overview.md'
    const oldTarget = 'docs/architecture/components.md'
    const newTarget = 'docs/architecture/deep-components.md'
    const input = 'Check out [Components](./components.md#buttons?version=2) and [Overview](./overview.md).'
    const result = rewriteMarkdownLinks(input, sourceDoc, oldTarget, newTarget)
    assert.equal(
      result.markdown,
      'Check out [Components](./deep-components.md#buttons?version=2) and [Overview](./overview.md).',
    )
    assert.equal(result.rewrites, 1)
  })

  test('rewrites markdown links across directories with relative path adjustment', () => {
    const sourceDoc = 'guides/getting-started.md'
    const oldTarget = 'api/reference.md'
    const newTarget = 'core/api-reference.md'
    const input = 'Refer to the [API Docs](../api/reference.md#endpoints).'
    const result = rewriteMarkdownLinks(input, sourceDoc, oldTarget, newTarget)
    assert.equal(
      result.markdown,
      'Refer to the [API Docs](../core/api-reference.md#endpoints).',
    )
    assert.equal(result.rewrites, 1)
  })

  test('rewriteAllLinks handles both wiki-links and standard markdown links in one pass', () => {
    const sourceDoc = 'README.md'
    const oldTarget = 'docs/setup.md'
    const newTarget = 'docs/quickstart.md'
    const input = 'Read [Setup](./docs/setup.md) or check [[setup#troubleshooting]].'
    const result = rewriteAllLinks(input, sourceDoc, oldTarget, newTarget)
    assert.equal(
      result.markdown,
      'Read [Setup](./docs/quickstart.md) or check [[quickstart#troubleshooting]].',
    )
    assert.equal(result.rewrites, 2)
  })
})
