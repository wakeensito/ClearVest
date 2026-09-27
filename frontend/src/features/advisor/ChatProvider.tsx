import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ScoutPageContext } from './scoutContext'
import { api, type ChatReply } from '../../api/client'
import { read, write } from '../../lib/storage'
import { getUserId } from '../../lib/userId'
import { ChatContext, FALLBACK_DISCLAIMER, type ChatMessage, type ChatState } from './chatContext'

// The API keeps the last 10 turns for context but has no "get history" route, so the thread shown
// here lives in localStorage, per user id, capped so it can't grow without bound.
const MAX_KEPT = 50
const storageKey = () => `cv-chat:${getUserId()}`

function load(): { messages: ChatMessage[]; disclaimer: string } {
  try {
    const saved = JSON.parse(read(storageKey()) ?? 'null') as { messages?: unknown; disclaimer?: unknown } | null
    const messages = Array.isArray(saved?.messages) ? saved.messages.filter((message): message is ChatMessage =>
      message && typeof message === 'object' && message.screened === true && typeof message.id === 'string' && typeof message.text === 'string' &&
      (message.role === 'user' || message.role === 'advisor'),
    ).slice(-MAX_KEPT) : []
    return { messages, disclaimer: typeof saved?.disclaimer === 'string' && saved.disclaimer.trim() ? saved.disclaimer : FALLBACK_DISCLAIMER }
  } catch {
    return { messages: [], disclaimer: FALLBACK_DISCLAIMER }
  }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState('')
  const [initial] = useState(load)
  const [messages, setMessages] = useState<ChatMessage[]>(initial.messages)
  const [disclaimer, setDisclaimer] = useState(initial.disclaimer)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const inFlight = useRef<'text' | 'voice' | null>(null)
  const [voicePending, setVoicePending] = useState(false)
  const beginVoiceTurn = useCallback(() => {
    if (inFlight.current) return false
    inFlight.current = 'voice'
    setVoicePending(true)
    setError(null)
    return true
  }, [])
  const endVoiceTurn = useCallback(() => {
    if (inFlight.current !== 'voice') return
    inFlight.current = null
    setVoicePending(false)
  }, [])

  useEffect(() => {
    write(storageKey(), JSON.stringify({ messages: messages.filter(m => m.screened).slice(-MAX_KEPT), disclaimer }))
  }, [messages, disclaimer])

  const ask = useCallback(async (id: string, text: string, grounded = false, context?: ScoutPageContext) => {
    // One request at a time: /advisor/* is capped at 2 req/s (template.yaml RouteSettings; 429 copy in DESIGN.md §11).
    if (inFlight.current) return
    inFlight.current = 'text'
    setPending(true)
    setError(null)
    try {
      const res = await api.chat(text, grounded, context)
      setDisclaimer(res.disclaimer || FALLBACK_DISCLAIMER)
      setMessages((m) => [
        ...m.map((x) => (x.id === id ? { ...x, failed: false, text: res.userMessage ?? x.text, screened: typeof res.userMessage === 'string' } : x)),
        { id: crypto.randomUUID(), role: 'advisor', text: res.reply, context, safety: res.safety, sources: res.sources, screened: !!res.safety && res.safety.status !== 'unavailable' },
      ])
    } catch (e) {
      setError(e)
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, failed: true } : x)))
    } finally {
      inFlight.current = null
      setPending(false)
    }
  }, [])

  const send = useCallback(
    (raw: string, grounded = false, context?: ScoutPageContext) => {
      const text = raw.trim()
      if (!text || inFlight.current) return
      const id = crypto.randomUUID()
      setMessages((m) => [...m, { id, role: 'user', text, grounded, context, screened: false }])
      void ask(id, text, grounded, context)
    },
    [ask],
  )

  const addTurn = useCallback((userText: string, reply: string, disclaimer?: string, evidence?: Pick<ChatReply, 'safety' | 'sources'>, context?: ScoutPageContext) => {
    const replyId = crypto.randomUUID()
    if (disclaimer) setDisclaimer(disclaimer)
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: 'user', text: userText, screened: !!evidence?.safety && evidence.safety.status !== 'unavailable' },
      { id: replyId, role: 'advisor', text: reply, context, ...evidence, screened: !!evidence?.safety && evidence.safety.status !== 'unavailable' },
    ])
    return replyId
  }, [])

  const retry = useCallback(
    (id: string) => {
      const msg = messages.find((m) => m.id === id)
      if (msg) void ask(id, msg.text, msg.grounded, msg.context)
    },
    [ask, messages],
  )

  const clear = useCallback(async () => {
    if (inFlight.current) return
    await api.clearChatHistory()
    setMessages([])
    setError(null)
  }, [])

  const value = useMemo<ChatState>(
    () => ({ draft, setDraft, messages, disclaimer, pending, busy: pending || voicePending, beginVoiceTurn, endVoiceTurn, error, send, addTurn, retry, clear }),
    [draft, messages, disclaimer, pending, voicePending, beginVoiceTurn, endVoiceTurn, error, send, addTurn, retry, clear],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
