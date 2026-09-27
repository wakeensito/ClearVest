import { describe, expect, it } from 'vitest'
import { EXPLAINERS, explainPieces, learnLink, relatedLesson } from './explainTerms'
import { ALL_LESSONS } from './lessons'

const terms = (text: string, seen?: Set<string>) =>
  explainPieces(text, seen).flatMap((p) => (typeof p === 'string' ? [] : [`${p.text}→${p.explainer.label}`]))

describe('tap-to-explain jargon', () => {
  it('every explainer has a meaning and a real destination', () => {
    for (const e of EXPLAINERS) {
      expect(e.meaning.length, e.label).toBeGreaterThan(20)
      if ('lessonId' in e.learn) expect(ALL_LESSONS.some((l) => l.id === (e.learn as { lessonId: string }).lessonId), e.label).toBe(true)
    }
  })
  it('keeps the text intact and marks each term once', () => {
    const text = 'Index funds are cheap. An index fund, like an ETF, is diversified. ETFs again.'
    const pieces = explainPieces(text)
    expect(pieces.map((p) => (typeof p === 'string' ? p : p.text)).join('')).toBe(text)
    expect(terms(text)).toEqual(['Index funds→Index fund', 'ETF→ETF', 'diversified→Diversification'])
  })
  it('prefers longer phrases and respects word boundaries', () => {
    expect(terms('Check the P/E ratio and the expense ratio.')).toEqual(['P/E ratio→P/E ratio', 'expense ratio→Expense ratio'])
    expect(terms('Rebonds and bondage are not bonds.')).toEqual(['bonds→Bond'])
    expect(terms('A Roth IRA and a 401(k).')).toEqual(['Roth IRA→Roth IRA', '401(k)→401(k)'])
  })
  it('only matches acronyms in capitals', () => {
    expect(terms('a tsp of salt, steps, etfs')).toEqual([])
    expect(terms('The TSP holds ETFs')).toEqual(['TSP→TSP', 'ETFs→ETF'])
  })
  it('shares the seen set across a reply', () => {
    const seen = new Set<string>()
    expect(terms('Volatility matters.', seen)).toEqual(['Volatility→Volatility'])
    expect(terms('More volatility.', seen)).toEqual([])
  })
  it('links to lessons or guided research and suggests a related lesson', () => {
    const etf = EXPLAINERS.find((e) => e.label === 'ETF')!
    expect(learnLink(etf).href).toBe('/learn/funds')
    const pe = EXPLAINERS.find((e) => e.label === 'P/E ratio')!
    expect(learnLink(pe).href).toBe('/markets?symbol=AAPL&guided=1')
    expect(relatedLesson('Your P/E is high and you are concentrated in one stock.')?.id).toBe('diversification')
    expect(relatedLesson('Nothing to see here.')).toBeNull()
  })
})
