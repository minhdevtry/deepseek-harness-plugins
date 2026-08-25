import test from 'node:test'
import assert from 'node:assert/strict'
import { executeAITransform, LANGUAGE_NAMES, TONE_NAMES } from '../src/client/tiptap/ai/aiEngine.ts'
import { SLASH_COMMANDS, matchCommands } from '../src/client/tiptap/commands.ts'

test('AI Engine: Improve writing transformation', async () => {
  const result = await executeAITransform({
    action: 'improve',
    text: 'thực ra là hệ thống này rất là nhanh',
  })
  assert.ok(!result.includes('thực ra là'))
  assert.ok(result.length > 0)
})

test('AI Engine: Fix grammar and punctuation', async () => {
  const result = await executeAITransform({
    action: 'fix_grammar',
    text: 'chính ta đã sai , và tôi sửa .',
  })
  assert.ok(result.includes('chính tả'))
  assert.ok(!result.includes(' ,'))
})

test('AI Engine: Make shorter and make longer', async () => {
  const longText = 'Câu thứ nhất rất dài. Câu thứ hai ở giữa giải thích chi tiết. Câu kết luận cuối cùng.'
  const shortened = await executeAITransform({
    action: 'shorten',
    text: longText,
  })
  assert.ok(shortened.length < longText.length)

  const shortText = 'Triển khai tính năng mới'
  const lengthened = await executeAITransform({
    action: 'lengthen',
    text: shortText,
  })
  assert.ok(lengthened.length > shortText.length)
})

test('AI Engine: Change tone and translate', async () => {
  const text = 'Chúng tôi sẽ bàn giao sản phẩm đúng hạn'
  const prof = await executeAITransform({
    action: 'change_tone',
    text,
    tone: 'professional',
  })
  assert.ok(prof.includes('Kính gửi') || prof.includes('Trân trọng'))

  const trans = await executeAITransform({
    action: 'translate',
    text: 'Hello world',
    targetLang: 'vi',
  })
  assert.ok(trans.length > 0)
})

test('AI Engine: Tasks and Table generation', async () => {
  const text = 'Thiết kế giao diện người dùng\nLập trình backend\nViết unit test'
  const tasks = await executeAITransform({
    action: 'tasks',
    text,
  })
  assert.ok(tasks.includes('- [ ]'))

  const table = await executeAITransform({
    action: 'table',
    text,
  })
  assert.ok(table.includes('| :--- |'))
})

test('Commands: Ask AI slash command is present and searchable', () => {
  const aiCmd = SLASH_COMMANDS.find((c) => c.id === 'ai')
  assert.ok(aiCmd, 'ai command exists in SLASH_COMMANDS')
  assert.strictEqual(aiCmd.title, 'Ask AI')

  const matches = matchCommands('ai')
  assert.ok(matches.some((m) => m.command.id === 'ai'))

  const promptMatches = matchCommands('prompt')
  assert.ok(promptMatches.some((m) => m.command.id === 'ai'))
})
