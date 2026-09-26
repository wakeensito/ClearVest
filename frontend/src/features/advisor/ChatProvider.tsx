import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '../../api/client'
import { read, write } from '../../lib/storage'
import { getUserId } from '../../lib/userId'
import { ChatContext, FALLBACK_DISCLAIMER, type ChatMessage, type ChatState } from './chatContext'

// The API keeps the last 10 turns for context but has no "get history" route, so the thread shown
// here lives in localStorage, per user id, capped so it can't grow without bound.
const MAX_KEPT = 50
const storageKey = () => `cv-chat:${getUserId()}`

function load(): { messages: ChatMessage[]; disclaimer: string } {
  try {
    const saved = JSON.parse(read(storageKey()) ?? 'null') as { messages?: ChatMessage[]; disclaimer?: string } | null
    return { messages: saved?.messages ?? [], disclaimer: saved?.disclaimer ?? FALLBACK_DISCLAIMER }
  } catch {
    return { messages: [], disclaimer: FALLBACK_DISCLAIMER }
  }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(load)
  const [messages, setMessages] = useState<ChatMessage[]>(initial.messages)
  const [disclaimer, setDisclaimer] = useState(initial.disclaimer)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    write(storageKey(), JSON.stringify({ messages: messages.slice(-MAX_KEPT), disclaimer }))
  }, [messages, disclaimer])

  const ask = useCallback(async (id: string, text: string) => {
    // One request at a time: /advisor/* is capped at 2 req/s (DESIGN.md §4.8).
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      const res = await api.chat(text)
      setDisclaimer(res.disclaimer || FALLBACK_DISCLAIMER)
      setMessages((m) => [
        ...m.map((x) => (x.id === id ? { ...x, failed: false } : x)),
        { id: crypto.randomUUID(), role: 'advisor', text: res.reply },
      ])
    } catch (e) {
      setError(e)
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, failed: true } : x)))
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }, [])

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim()
      if (!text || inFlight.current) return
      const id = crypto.randomUUID()
      setMessages((m) => [...m, { id, role: 'user', text }])
      void ask(id, text)
    },
    [ask],
  )

  const retry = useCallback(
    (id: string) => {
      const msg = messages.find((m) => m.id === id)
      if (msg) void ask(id, msg.text)
    },
    [ask, messages],
  )

  const clear = useCallback(async () => {
    await api.clearChatHistory()
    setMessages([])
    setError(null)
  }, [])

  const value = useMemo<ChatState>(
    () => ({ messages, disclaimer, pending, error, send, retry, clear }),
    [messages, disclaimer, pending, error, send, retry, clear],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
