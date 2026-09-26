import { describe, expect, it } from 'vitest'
import { timeGreeting } from './greeting'
import { filterTerms, TERMS } from './learning'

describe('welcoming learning experience', () => {
  it('uses local morning, afternoon and evening boundaries', () => {
    expect(timeGreeting(4)).toBe('Good evening.')
    expect(timeGreeting(5)).toBe('Good morning.')
    expect(timeGreeting(11)).toBe('Good morning.')
    expect(timeGreeting(12)).toBe('Good afternoon.')
    expect(timeGreeting(17)).toBe('Good afternoon.')
    expect(timeGreeting(18)).toBe('Good evening.')
  })
  it('finds jargon by term or meaning, ignoring case and extra spaces', () => {
    expect(filterTerms('  etf  ').map(item => item.term)).toEqual(['ETF'])
    expect(filterTerms('changes')).toContainEqual(expect.objectContaining({term:'Risk tolerance'}))
    expect(filterTerms('not-a-finance-term')).toEqual([])
    expect(filterTerms('')).toHaveLength(TERMS.length)
    expect(TERMS.length).toBeGreaterThanOrEqual(20)
  })
})
