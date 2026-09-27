import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../features/advisor/chatContext'
import { suggestedLesson } from './lessonSuggestions'

const reply = (text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ id: 'reply', role: 'advisor', text, safety: { status: 'passed', grounding: 'not_requested' }, ...extra })

describe('answer-to-lesson recommendations', () => {
  it('connects overlap explanations to diversification before the generic fund lesson', () => {
    expect(suggestedLesson(reply('Your ETFs overlap in several stocks.'))?.id).toBe('diversification')
  })
  it('prefers an existing cited lesson and ignores invented or external lesson links', () => {
    const source = { label: 'Lesson', kind: 'lesson' as const, asOf: '2026-09-27', text: 'A lesson', url: '/learn/starting-early' }
    expect(suggestedLesson(reply('These stocks can compound.', { sources: [source] }))?.id).toBe('starting-early')
    expect(suggestedLesson(reply('Hello.', { sources: [{ ...source, url: '/learn/invented' }] }))).toBeNull()
    expect(suggestedLesson(reply('Hello.', { sources: [{ ...source, url: 'https://example.com/learn/funds' }] }))).toBeNull()
  })
  it('does not attach learning prompts to refused, unavailable, unknown, or user messages', () => {
    for (const status of ['intervened', 'unavailable'] as const) expect(suggestedLesson(reply('Diversification', { safety: { status, grounding: 'withheld' } }))).toBeNull()
    expect(suggestedLesson(reply('Diversification', { safety: undefined }))).toBeNull()
    expect(suggestedLesson(reply('Diversification', { role: 'user' }))).toBeNull()
    expect(suggestedLesson(reply(''))).toBeNull()
  })
  it('uses complete concepts rather than accidental substrings', () => {
    expect(suggestedLesson(reply('The company bonded its warehouse.'))).toBeNull()
    expect(suggestedLesson(reply('The answer is unavailable.'))).toBeNull()
    expect(suggestedLesson(reply('An ETF is a basket of holdings.'))?.id).toBe('funds')
    expect(suggestedLesson(reply('A 401(k) is an employer retirement plan.'))?.id).toBe('employer-plans')
    expect(suggestedLesson(reply('Compound growth means earnings on earnings.'))?.id).toBe('starting-early')
  })
})
