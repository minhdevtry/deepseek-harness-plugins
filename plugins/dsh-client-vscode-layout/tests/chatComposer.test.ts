import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { getLineRangeForSelection } from '../src/client/utils/chatComposer.ts'
import {
  formatFileMention,
  normalizeLineRange,
  appendMentionToComposer,
  installComposerWriter,
  installReferenceWriter,
  toWorkspaceRelative,
} from '../src/client/composer.ts'
import { createFileSource, FILE_SOURCE } from '../src/client/inputTriggers/fileSource.ts'

describe('getLineRangeForSelection', () => {
  const doc = [
    '# Title',
    '',
    'First paragraph with some text.',
    'Second paragraph with specific content here.',
    'Third line is interesting.',
    '',
    '## Section 2',
    'List item 1',
    'List item 2',
    'List item 3',
    '',
    'Final paragraph.',
  ].join('\n')

  test('returns single line range when selection is within one line', () => {
    const res = getLineRangeForSelection(doc, 'First paragraph')
    assert.equal(res.startLine, 3)
    assert.equal(res.endLine, 3)
    assert.equal(res.rangeString, '#L3')
  })

  test('returns multi-line range when selection spans multiple lines', () => {
    const res = getLineRangeForSelection(doc, 'First paragraph with some text.\nSecond paragraph')
    assert.equal(res.startLine, 3)
    assert.equal(res.endLine, 4)
    assert.equal(res.rangeString, '#L3-4')
  })

  test('returns exact line numbers for nested sections', () => {
    const res = getLineRangeForSelection(doc, 'List item 1\nList item 2')
    assert.equal(res.startLine, 8)
    assert.equal(res.endLine, 9)
    assert.equal(res.rangeString, '#L8-9')
  })

  test('falls back gracefully when text is not found', () => {
    const res = getLineRangeForSelection(doc, 'Non-existent text')
    assert.equal(res.rangeString, '')
  })

  test('returns empty range for empty selection', () => {
    const res = getLineRangeForSelection(doc, '')
    assert.equal(res.rangeString, '')
  })

  test('disambiguates identical lines using cursor offsets', () => {
    const codeDoc = [
      'function foo() {',
      '  return 1',
      '}',
      '',
      'function bar() {',
      '  return 1',
      '}',
    ].join('\n')

    const firstIndex = codeDoc.indexOf('  return 1')
    const secondIndex = codeDoc.indexOf('  return 1', firstIndex + 1)

    // Selecting first occurrence (line 2)
    const res1 = getLineRangeForSelection(codeDoc, '  return 1', {
      from: firstIndex,
      to: firstIndex + '  return 1'.length,
    })
    assert.equal(res1.startLine, 2)
    assert.equal(res1.endLine, 2)
    assert.equal(res1.rangeString, '#L2')

    // Selecting second occurrence (line 6) - with offset must be #L6, not #L2
    const res2 = getLineRangeForSelection(codeDoc, '  return 1', {
      from: secondIndex,
      to: secondIndex + '  return 1'.length,
    })
    assert.equal(res2.startLine, 6)
    assert.equal(res2.endLine, 6)
    assert.equal(res2.rangeString, '#L6')

    // Selecting the second closing brace '}' (line 7)
    const firstBrace = codeDoc.indexOf('}')
    const secondBrace = codeDoc.indexOf('}', firstBrace + 1)
    const resBrace = getLineRangeForSelection(codeDoc, '}', {
      from: secondBrace,
      to: secondBrace + 1,
    })
    assert.equal(resBrace.startLine, 7)
    assert.equal(resBrace.endLine, 7)
    assert.equal(resBrace.rangeString, '#L7')
  })
})

describe('normalizeLineRange', () => {
  test('normalizes ranges removing duplicate L', () => {
    assert.equal(normalizeLineRange('#L36-L43'), '#L36-43')
    assert.equal(normalizeLineRange('L36-L43'), '#L36-43')
    assert.equal(normalizeLineRange('#L36-43'), '#L36-43')
    assert.equal(normalizeLineRange('36-43'), '#L36-43')
    assert.equal(normalizeLineRange('#L6'), '#L6')
    assert.equal(normalizeLineRange('L6'), '#L6')
    assert.equal(normalizeLineRange('6'), '#L6')
    assert.equal(normalizeLineRange(''), '')
  })
})

describe('formatFileMention', () => {
  test('formats pure filename without directory paths', () => {
    assert.equal(formatFileMention('/path/to/ARCHITECTURE.md'), '@ARCHITECTURE.md')
    assert.equal(formatFileMention('docs/guide/AppFrame.tsx'), '@AppFrame.tsx')
    assert.equal(formatFileMention('README.md'), '@README.md')
  })

  test('formats filename with line range and removes duplicate L', () => {
    assert.equal(formatFileMention('/path/to/ARCHITECTURE.md', '#L36-L43'), '@ARCHITECTURE.md#L36-43')
    assert.equal(formatFileMention('/path/to/ARCHITECTURE.md', '#L2-6'), '@ARCHITECTURE.md#L2-6')
    assert.equal(formatFileMention('src/AppFrame.tsx', '#L1-90'), '@AppFrame.tsx#L1-90')
    assert.equal(formatFileMention('main.py', '#L10'), '@main.py#L10')
    assert.equal(formatFileMention('main.py', '10'), '@main.py#L10')
  })
})

describe('appendMentionToComposer / sendFileMention', () => {
  test('routes reference through installed reference writer as blue chip', () => {
    const chips: any[] = []
    const dispose = installReferenceWriter((ref) => {
      chips.push(ref)
      return true
    })

    assert.equal(appendMentionToComposer('/repo/docs/ARCHITECTURE.md', '#L2-6'), true)
    assert.equal(chips.length, 1)
    assert.equal(chips[0].ref, 'ARCHITECTURE.md#L2-6')
    assert.equal(chips[0].label, 'ARCHITECTURE.md#L2-6')
    assert.equal(chips[0].clipboardText, '@ARCHITECTURE.md#L2-6')

    assert.equal(appendMentionToComposer('/repo/src/client/AppFrame.tsx'), true)
    assert.equal(chips.length, 2)
    assert.equal(chips[1].ref, 'AppFrame.tsx')
    assert.equal(chips[1].label, 'AppFrame.tsx')
    assert.equal(chips[1].clipboardText, '@AppFrame.tsx')

    dispose()
  })
})

describe('toWorkspaceRelative', () => {
  test('strips workspace root prefix when inside cwd', () => {
    assert.equal(toWorkspaceRelative('/workspace/repo/src/index.ts', '/workspace/repo'), 'src/index.ts')
    assert.equal(toWorkspaceRelative('/workspace/repo/src/index.ts', '/workspace/repo/'), 'src/index.ts')
  })

  test('leaves paths outside cwd untouched', () => {
    assert.equal(toWorkspaceRelative('/other/path/file.txt', '/workspace/repo'), '/other/path/file.txt')
  })

  test('leaves paths untouched when cwd is undefined', () => {
    assert.equal(toWorkspaceRelative('/workspace/repo/src/index.ts', undefined), '/workspace/repo/src/index.ts')
  })
})

describe('createFileSource', () => {
  test('returns candidate items with filename as name and relative path as description', async () => {
    const source = createFileSource(() => '/mock/root')
    assert.equal(source.name, FILE_SOURCE)
    assert.equal(source.trigger, '@')
  })

  test('onPick returns reference insert for blue chip', () => {
    const source = createFileSource(() => '/mock/root')
    const pickOutcome = source.onPick({
      candidate: { name: 'ARCHITECTURE.md', description: 'docs/ARCHITECTURE.md' },
      session: { sessionId: 'mock-session' as any },
      position: 'inline',
      via: 'menu',
      span: { start: 0, end: 1, draftRev: 1 },
    })

    assert.ok(pickOutcome && typeof pickOutcome === 'object' && 'insert' in pickOutcome)
    assert.equal(pickOutcome.insert.source, FILE_SOURCE)
    assert.equal(pickOutcome.insert.ref, 'ARCHITECTURE.md')
    assert.equal(pickOutcome.insert.label, 'ARCHITECTURE.md')
    assert.equal(pickOutcome.insert.clipboardText, '@ARCHITECTURE.md')
  })

  test('codec serializes reference with code snippet if active text matches', async () => {
    const source = createFileSource(() => '/mock/root')
    assert.equal(source.codec.clipboardText('src/main.ts'), '@src/main.ts')

    // Mock active text on window
    const sampleCode = ['const a = 1', 'const b = 2', 'const c = 3', 'const d = 4'].join('\n')
    ;(globalThis as any).__dsh_get_active_text = (path: string) => {
      if (path === 'src/main.ts') return sampleCode
      return undefined
    }

    const serialized = await source.codec.serialize('src/main.ts#L2-3', new AbortController().signal)
    assert.equal(
      serialized,
      '@src/main.ts#L2-3\n```\nconst b = 2\nconst c = 3\n```',
    )

    // Fallback if no #L
    const noRange = await source.codec.serialize('src/main.ts', new AbortController().signal)
    assert.equal(noRange, '@src/main.ts')

    delete (globalThis as any).__dsh_get_active_text
  })
})
