/**
 * Types and action definitions for TipTap In-line AI Assistant.
 */

export type AIActionId =
  | 'improve'
  | 'fix_grammar'
  | 'shorten'
  | 'lengthen'
  | 'change_tone'
  | 'translate'
  | 'summarize'
  | 'tasks'
  | 'table'
  | 'continue'
  | 'custom'

export type AITone = 'professional' | 'casual' | 'confident' | 'friendly' | 'direct'

export type AILanguage = 'en' | 'vi' | 'ja' | 'zh' | 'fr' | 'de'

export interface AIQuickAction {
  id: AIActionId
  icon: string
  label: string
  hint?: string | undefined
  tone?: AITone | undefined
  targetLang?: AILanguage | undefined
}

export type AIStatus = 'idle' | 'prompting' | 'generating' | 'reviewing'

export interface AIState {
  status: AIStatus
  pos: { top: number; left: number }
  range: { from: number; to: number }
  originalText: string
  generatedText: string
  action?: AIActionId | undefined
  customPrompt?: string | undefined
  error?: string | undefined
}
