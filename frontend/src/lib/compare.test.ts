import { describe, expect, it } from 'vitest'
import { arrangeCompanies, METRICS, metricTone, normalizeSymbols, symbolsError, symbolsFromParam, type Company } from './compare'

const company = (symbol: string, over: Partial<Company> = {}): Company => ({
  symbol, pe: 95.1, ps: 11.2, grossMargin: 0.532, revenueGrowth: 0.343, epsTTM: 1.9, fcfPerShare: 4.1, debtToEquity: 0.06, ...over,
})

describe('normalizeSymbols', () => {
  it('uppercases, trims, dedupes and keeps request order', () => {
    expect(normalizeSymbols([' amd', 'NVDA', 'Amd', 'brk-b', ''])).toEqual({ symbols: ['AMD', 'NVDA', 'BRK-B'], invalid: [] })
  })
  it('reports tickers that break the 12-character rule instead of sending them', () => {
    expect(normalizeSymbols(['AMD', 'bad ticker', 'ABCDEFGHIJKL', 'ABCDEFGHIJKLM'])).toEqual({ symbols: ['AMD', 'ABCDEFGHIJKL'], invalid: ['bad ticker', 'ABCDEFGHIJKLM'] })
  })
  it('dedupes invalid entries case-insensitively too', () => {
    expect(normalizeSymbols(['bad x', 'BAD X'])).toEqual({ symbols: [], invalid: ['bad x'] })
  })
})

describe('symbolsError', () => {
  it('needs two to four tickers', () => {
    expect(symbolsError([])).toMatch(/at least two/)
    expect(symbolsError(['AMD'])).toMatch(/at least two/)
    expect(symbolsError(['A', 'B'])).toBeNull()
    expect(symbolsError(['A', 'B', 'C', 'D'])).toBeNull()
    expect(symbolsError(['A', 'B', 'C', 'D', 'E'])).toMatch(/up to four/)
  })
})

describe('symbolsFromParam', () => {
  it('reads a comma-separated param and falls back when it cannot be compared', () => {
    expect(symbolsFromParam('amd,nvda', ['VOO', 'QQQ'])).toEqual(['AMD', 'NVDA'])
    expect(symbolsFromParam('AMD', ['VOO', 'QQQ'])).toEqual(['VOO', 'QQQ'])
    // Duplicates collapse to one ticker, which is too few.
    expect(symbolsFromParam('AMD,amd', ['VOO', 'QQQ'])).toEqual(['VOO', 'QQQ'])
    expect(symbolsFromParam('A,B,C,D,E', ['VOO', 'QQQ'])).toEqual(['VOO', 'QQQ'])
    expect(symbolsFromParam(null, ['VOO', 'QQQ'])).toEqual(['VOO', 'QQQ'])
    // Invalid entries are dropped; the rest still compares.
    expect(symbolsFromParam('AMD,bad ticker,NVDA', ['VOO', 'QQQ'])).toEqual(['AMD', 'NVDA'])
  })
})

describe('arrangeCompanies', () => {
  it('orders columns by the request and names tickers the API left out', () => {
    const result = arrangeCompanies(['INTC', 'NVDA', 'AMD'], [company('AMD'), company('nvda')])
    expect(result.companies.map((c) => c.symbol)).toEqual(['nvda', 'AMD'])
    expect(result.missing).toEqual(['INTC'])
  })
})

describe('METRICS', () => {
  it('formats every field with its DESIGN.md unit and shows a dash for null', () => {
    const c = company('AMD')
    const shown = Object.fromEntries(METRICS.map((m) => [m.key, m.format(c[m.key])]))
    expect(shown).toEqual({ pe: '95.1×', ps: '11.2×', grossMargin: '53.2%', revenueGrowth: '+34.3%', epsTTM: '$1.90', fcfPerShare: '$4.10', debtToEquity: '0.06×' })
    for (const m of METRICS) expect(m.format(null)).toBe('—')
  })
  it('colors only revenue growth, by sign', () => {
    const growth = METRICS.find((m) => m.key === 'revenueGrowth')
    const pe = METRICS.find((m) => m.key === 'pe')
    if (!growth || !pe) throw new Error('metric table changed')
    expect(metricTone(growth, 0.2)).toBe('c-gain')
    expect(metricTone(growth, -0.2)).toBe('c-loss')
    expect(metricTone(growth, null)).toBe('')
    expect(metricTone(pe, 95)).toBe('')
  })
})
