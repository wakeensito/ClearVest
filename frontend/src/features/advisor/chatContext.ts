import { createContext, useContext } from 'react'
import type { ScoutPageContext } from './scoutContext'
import type { ChatReply } from '../../api/client'

export interface ChatMessage {
  id: string
  role: 'user' | 'advisor'
  text: string
  /** A user message that didn't get a reply; it can be retried. */
  failed?: boolean
  grounded?: boolean
  context?: ScoutPageContext
  /** Only screened responses/questions may be written to browser history. */
  screened?: boolean
  safety?: ChatReply['safety']
  sources?: ChatReply['sources']
}

export interface ChatState {
  /** In-memory draft shared by the companion and full Advisor. */
  draft: string
  setDraft: (text: string) => void
  messages: ChatMessage[]
  /** From the latest reply; the fallback matches the backend's text (DESIGN.md §12). */
  disclaimer: string
  pending: boolean
  busy: boolean
  beginVoiceTurn: () => boolean
  endVoiceTurn: () => void
  error: unknown
  send: (text: string, grounded?: boolean, context?: ScoutPageContext) => void
  /** A finished exchange from another channel (voice): both sides land at once, no request made. */
  addTurn: (userText: string, reply: string, disclaimer?: string, evidence?: Pick<ChatReply, 'safety' | 'sources'>, context?: ScoutPageContext) => string
  retry: (id: string) => void
  clear: () => Promise<void>
}

export const FALLBACK_DISCLAIMER =
  'ClearVest provides educational information, not financial advice. ' +
  'Consider a licensed professional before making investment decisions.'

export const SUGGESTED_PROMPTS = [
  'What does it mean to own a stock?',
  'How are sales different from profit?',
  'Explain an ETF in simple words.',
  'How can I understand the risks in my portfolio?',
]

export const ChatContext = createContext<ChatState | null>(null)

export function useChat(): ChatState {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>')
  return ctx
}
