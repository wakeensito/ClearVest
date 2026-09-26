import { createContext, useContext } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'advisor'
  text: string
  /** A user message that didn't get a reply; it can be retried. */
  failed?: boolean
}

export interface ChatState {
  messages: ChatMessage[]
  /** From the latest reply; the fallback matches the backend's text (DESIGN.md §12). */
  disclaimer: string
  pending: boolean
  error: unknown
  send: (text: string) => void
  retry: (id: string) => void
  clear: () => Promise<void>
}

export const FALLBACK_DISCLAIMER =
  'ClearVest provides educational information, not financial advice. ' +
  'Consider a licensed professional before making investment decisions.'

export const SUGGESTED_PROMPTS = [
  'How risky is my portfolio?',
  'Which retirement account fits me?',
  'How does inflation affect my bonds?',
  'Am I too concentrated in one position?',
]

export const ChatContext = createContext<ChatState | null>(null)

export function useChat(): ChatState {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>')
  return ctx
}
