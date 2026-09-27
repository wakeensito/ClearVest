import type { ChatMessage } from '../features/advisor/chatContext'
import { findLesson } from './lessons'

// Match curated concepts, not arbitrary model-provided links. Prefer a cited lesson.
const TOPICS: readonly [string, RegExp][] = [
  ['diversification', /\b(diversif\w*|overlap\w*|concentrat\w*|spread(?:ing)? (?:your |the )?risk)\b/i],
  ['roth-vs-traditional', /\b(roth|traditional (?:ira|account))\b/i],
  ['employer-plans', /(?:\b401(?:\(k\)|k\b)|\btsp\b|\bemployer match\b)/i],
  ['safety-net-first', /\b(emergency fund|safety net|high-interest debt)\b/i],
  ['starting-early', /\b(compound(?:ing)?|compound growth)\b/i],
  ['steady-investing', /\b(dollar.cost averaging|regular contributions|investing on a schedule)\b/i],
  ['hype-and-scams', /\b(scam\w*|guaranteed returns|investment fraud)\b/i],
  ['funds', /\b(etfs?|index funds?|mutual funds?|expense ratios?)\b/i],
  ['stocks-and-bonds', /\b(stocks?|bonds?|shares?|shareholders?)\b/i],
  ['market-drops', /\b(market (?:drops?|declines?|crash)|panic.selling|time horizon)\b/i],
  ['account-types', /\b(brokerage|retirement accounts?)\b/i],
  ['what-is-investing', /\b(investing|investment risk|saving and investing)\b/i],
]

export function suggestedLesson(message: ChatMessage) {
  if (message.role !== 'advisor' || message.safety?.status !== 'passed' || !message.text.trim()) return null
  for (const source of message.sources ?? []) {
    const id = /^\/learn\/([a-z0-9-]+)$/.exec(source.url ?? '')?.[1]
    const found = id ? findLesson(id) : null
    if (found) return found.lesson
  }
  const id = TOPICS.find(([, pattern]) => pattern.test(message.text))?.[0]
  return id ? findLesson(id)?.lesson ?? null : null
}
