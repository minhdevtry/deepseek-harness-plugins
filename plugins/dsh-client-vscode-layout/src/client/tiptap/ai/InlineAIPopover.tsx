/**
 * Inline AI Popover component for TipTap Editor.
 *
 * Provides prompt input, quick actions, streaming preview,
 * Accept/Reject review actions, and seamless chat panel integration.
 */
import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import type { AIState, AIActionId, AITone, AILanguage } from './types.ts'
import { executeAITransform, LANGUAGE_NAMES, TONE_NAMES } from './aiEngine.ts'
import { appendToComposer, focusComposer } from '../../composer.ts'
import css from './InlineAI.module.css'

export interface InlineAIPopoverProps {
  editor: Editor
  aiState: AIState
  onClose: () => void
}

interface ActionItem {
  id: AIActionId
  icon: string
  label: string
  hint?: string
  tone?: AITone
  targetLang?: AILanguage
}

const QUICK_ACTIONS: ActionItem[] = [
  { id: 'improve', icon: '✨', label: 'Trau chuốt văn phong', hint: 'Improve writing' },
  { id: 'fix_grammar', icon: '🔍', label: 'Sửa lỗi chính tả & ngữ pháp', hint: 'Fix spelling & grammar' },
  { id: 'shorten', icon: '✂️', label: 'Rút gọn văn bản', hint: 'Make shorter' },
  { id: 'lengthen', icon: '📖', label: 'Mở rộng chi tiết', hint: 'Make longer' },
  { id: 'summarize', icon: '📝', label: 'Tóm tắt ý chính', hint: 'Summarize' },
  { id: 'tasks', icon: '📋', label: 'Trích xuất việc cần làm', hint: 'To-do checklist' },
  { id: 'table', icon: '📊', label: 'Chuyển thành bảng dữ liệu', hint: 'Markdown table' },
  { id: 'continue', icon: '✍️', label: 'Viết tiếp nội dung', hint: 'Continue writing' },
]

export function InlineAIPopover({ editor, aiState, onClose }: InlineAIPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const [prompt, setPrompt] = useState<string>(
    typeof aiState.customPrompt === 'string' ? aiState.customPrompt : ''
  )
  const [status, setStatus] = useState<'prompting' | 'generating' | 'reviewing'>(
    aiState.status === 'idle' ? 'prompting' : (aiState.status as any)
  )
  const [streamedText, setStreamedText] = useState(aiState.generatedText || '')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [submenu, setSubmenu] = useState<'none' | 'tone' | 'translate'>('none')

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Outside click to dismiss
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        handleDiscard()
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick)
    }, 120)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  const handleRunAction = async (
    action: AIActionId,
    tone?: AITone,
    targetLang?: AILanguage,
    customPromptText?: string
  ) => {
    setStatus('generating')
    setStreamedText('')
    abortControllerRef.current = new AbortController()

    try {
      const result = await executeAITransform({
        action,
        text: aiState.originalText,
        customPrompt: customPromptText || prompt,
        tone,
        targetLang,
        signal: abortControllerRef.current.signal,
        onChunk: (_chunk, fullText) => {
          setStreamedText(fullText)
        },
      })
      setStreamedText(result)
      setStatus('reviewing')
    } catch (err: any) {
      if (err?.message !== 'AI generation cancelled') {
        setStreamedText(`Lỗi: ${err?.message || 'Không thể tạo nội dung'}`)
        setStatus('reviewing')
      }
    }
  }

  const handleAccept = () => {
    if (!streamedText) return onClose()

    const { from, to } = aiState.range
    if (from !== to) {
      editor.chain().focus().setTextSelection({ from, to }).deleteSelection().run()
    } else {
      editor.chain().focus().setTextSelection(from).run()
    }

    // Insert structured markdown nodes into ProseMirror
    editor.commands.insertContent(streamedText, {
      contentType: 'markdown',
    })
    onClose()
  }

  const handleInsertBelow = () => {
    if (!streamedText) return onClose()

    const { to } = aiState.range
    editor.chain().focus().setTextSelection(to).insertContent(`\n\n${streamedText}`, {
      contentType: 'markdown',
    }).run()
    onClose()
  }

  const handleSendToChat = () => {
    const context = aiState.originalText ? `Đoạn văn bản trích dẫn:\n"""\n${aiState.originalText}\n"""\n\n` : ''
    const userPrompt = prompt.trim() || 'Hãy hỗ trợ tôi xử lý đoạn văn bản này'
    appendToComposer(`${context}${userPrompt}`)
    focusComposer()
    onClose()
  }

  const handleDiscard = () => {
    abortControllerRef.current?.abort()
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleDiscard()
      return
    }

    if (status === 'prompting') {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (prompt.trim()) {
          handleRunAction('custom', undefined, undefined, prompt)
        } else if (submenu === 'none' && QUICK_ACTIONS[selectedIndex]) {
          const act = QUICK_ACTIONS[selectedIndex]!
          handleRunAction(act.id, act.tone, act.targetLang)
        }
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % QUICK_ACTIONS.length)
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + QUICK_ACTIONS.length) % QUICK_ACTIONS.length)
        return
      }
    }

    if (status === 'reviewing') {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAccept()
      }
    }
  }

  // Safe viewport bounds calculation
  const top = Math.max(10, Math.min(window.innerHeight - 380, aiState.pos.top + 6))
  const left = Math.max(10, Math.min(window.innerWidth - 470, aiState.pos.left))

  return (
    <div
      ref={popoverRef}
      className={css.popover}
      style={{ top: `${top}px`, left: `${left}px` }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Header with gradient sparkle and unified input */}
      <div className={css.header}>
        <span className={css.sparkle}>✨</span>
        <input
          ref={inputRef}
          type="text"
          className={css.input}
          placeholder="Hỏi AI chỉnh sửa hoặc viết tiếp... (Enter để gửi, Esc để đóng)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={status === 'generating'}
        />
        {typeof prompt === 'string' && prompt.trim().length > 0 && status === 'prompting' && (
          <button
            type="button"
            className={css.btnSendChat}
            title="Gửi sang AI Chat Panel bên phải"
            onClick={handleSendToChat}
          >
            💬 Chat
          </button>
        )}
      </div>

      {/* State: Prompting with Action List */}
      {status === 'prompting' && (
        <div className={css.actionsList}>
          {submenu === 'none' && (
            <>
              <div className={css.subSectionTitle}>Tác vụ thông minh</div>
              {QUICK_ACTIONS.map((action, idx) => (
                <button
                  key={action.id}
                  type="button"
                  className={css.actionItem}
                  data-active={idx === selectedIndex}
                  onClick={() => handleRunAction(action.id, action.tone, action.targetLang)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className={css.actionIcon}>{action.icon}</span>
                  <span className={css.actionLabel}>{action.label}</span>
                  {action.hint && <span className={css.actionHint}>{action.hint}</span>}
                </button>
              ))}

              <div className={css.divider} />
              <button
                type="button"
                className={css.actionItem}
                onClick={() => setSubmenu('tone')}
              >
                <span className={css.actionIcon}>🎭</span>
                <span className={css.actionLabel}>Đổi tông giọng...</span>
                <span className={css.actionHint}>Change tone</span>
              </button>
              <button
                type="button"
                className={css.actionItem}
                onClick={() => setSubmenu('translate')}
              >
                <span className={css.actionIcon}>🌐</span>
                <span className={css.actionLabel}>Dịch sang ngôn ngữ khác...</span>
                <span className={css.actionHint}>Translate</span>
              </button>
              <button
                type="button"
                className={css.actionItem}
                onClick={handleSendToChat}
              >
                <span className={css.actionIcon}>💬</span>
                <span className={css.actionLabel}>Mở trong AI Chat panel</span>
                <span className={css.actionHint}>Open in chat</span>
              </button>
            </>
          )}

          {submenu === 'tone' && (
            <>
              <button
                type="button"
                className={css.actionItem}
                onClick={() => setSubmenu('none')}
              >
                <span className={css.actionIcon}>⬅️</span>
                <span className={css.actionLabel}>Quay lại</span>
              </button>
              <div className={css.divider} />
              <div className={css.subSectionTitle}>Chọn tông giọng</div>
              {(Object.keys(TONE_NAMES) as AITone[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={css.actionItem}
                  onClick={() => handleRunAction('change_tone', t)}
                >
                  <span className={css.actionIcon}>🎭</span>
                  <span className={css.actionLabel}>{TONE_NAMES[t]}</span>
                </button>
              ))}
            </>
          )}

          {submenu === 'translate' && (
            <>
              <button
                type="button"
                className={css.actionItem}
                onClick={() => setSubmenu('none')}
              >
                <span className={css.actionIcon}>⬅️</span>
                <span className={css.actionLabel}>Quay lại</span>
              </button>
              <div className={css.divider} />
              <div className={css.subSectionTitle}>Chọn ngôn ngữ đích</div>
              {(Object.keys(LANGUAGE_NAMES) as AILanguage[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className={css.actionItem}
                  onClick={() => handleRunAction('translate', undefined, lang)}
                >
                  <span className={css.actionIcon}>🌐</span>
                  <span className={css.actionLabel}>{LANGUAGE_NAMES[lang]}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* State: Generating / Reviewing with Stream Shimmer */}
      {(status === 'generating' || status === 'reviewing') && (
        <div className={css.streamingBox}>
          <div className={css.streamingText}>
            {streamedText}
            {status === 'generating' && <span className={css.streamingIndicator} />}
          </div>
        </div>
      )}

      {/* Review Bar with Commit & Rollback Controls */}
      {status === 'reviewing' && (
        <div className={css.reviewBar}>
          <button type="button" className={css.btnPrimary} onClick={handleAccept}>
            <span>✓</span> Chấp nhận (Enter)
          </button>
          <button type="button" className={css.btnSecondary} onClick={handleInsertBelow}>
            <span>↓</span> Chèn xuống dưới
          </button>
          <button
            type="button"
            className={css.btnSecondary}
            onClick={() => {
              setStatus('prompting')
              setStreamedText('')
            }}
          >
            <span>🔄</span> Thử lại
          </button>
          <button type="button" className={css.btnDanger} onClick={handleDiscard}>
            <span>✕</span> Huỷ bỏ (Esc)
          </button>
        </div>
      )}
    </div>
  )
}
