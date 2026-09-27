import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { CompanyResearch } from '../../api/client'
import { CompanyFinancials } from './CompanyFinancials'

const fetchedAt = '2026-09-26T12:00:00Z'
const research = (changes: { profile?: Partial<NonNullable<CompanyResearch['profile']>>; valuation?: Partial<NonNullable<CompanyResearch['valuation']>> | null } = {}): CompanyResearch => ({
  symbol: 'AAPL',
  profile: { name: 'Example company', description: null, sector: 'Technology', industry: null, currency: 'USD', isFund: false, beta: 1.1, marketCap: 3.4e12, nextEarningsDate: null, ...changes.profile },
  income: [],
  valuation: changes.valuation === null ? null : { pe: 28, eps: 5, ps: 4, dividendYield: 0.0045, ...changes.valuation },
  history: [24, 22, 26, 25, 20].map((pe, i) => ({ year: String(2025 - i), date: `${2025 - i}-09-27`, pe })),
  unavailable: changes.valuation === null ? ['valuation'] : [],
  sources: [{ section: 'profile', provider: 'FMP', fetchedAt, stale: false }],
})
const renderHtml = (data: CompanyResearch, initialStep = 0) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } })
  client.setQueryData(['company-research', data.symbol], data)
  return renderToStaticMarkup(h(QueryClientProvider, { client }, h(MemoryRouter, null, h(CompanyFinancials, { symbol: data.symbol, initialStep }))))
}
const render = (data: CompanyResearch, initialStep = 0) => {
  const html = renderHtml(data, initialStep)
  return html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')
}

describe('company research advisor lines', () => {
  it('states market value in the profile line, and never for a fund or a missing value', () => {
    expect(render(research())).toContain('Worth about USD 3.4T on the market')
    expect(render(research({ profile: { marketCap: null } }))).not.toContain('Worth about')
    expect(render(research({ profile: { isFund: true } }))).not.toContain('Worth about')
  })

  it('adds one neutral P/E-versus-usual sentence to the price step', () => {
    const text = render(research(), 2)
    expect(text).toContain('Investors are paying more than usual for each dollar of profit: 28.0× today vs about 24.0× over the last 5 years.')
    const sentence = /data-pe-comparison="[^"]*">([^<]*)</.exec(renderHtml(research(), 2))?.[1] ?? ''
    expect(sentence).toContain('more than usual')
    expect(sentence).not.toMatch(/cheap|expensive|bargain|overvalued|undervalued/i)
    expect(render(research({ valuation: { pe: 24.5 } }), 2)).toContain('About the same as its usual 24.0×.')
    expect(render(research({ valuation: { eps: -1 } }), 2)).not.toContain('than usual')
  })

  it('explains the dividend step with a yield, no dividend, or missing data', () => {
    const text = render(research(), 3)
    expect(text).toContain('Does it pay you to wait?')
    expect(text).toContain('0.45%')
    expect(text).toContain('Each year the company pays out about 0.45% of its share price in cash.')
    expect(render(research({ valuation: { dividendYield: null } }), 3)).toContain('No dividend')
    const missing = render(research({ valuation: null }), 3)
    expect(missing).toContain('Dividend information is not available')
    expect(missing).not.toContain('No dividend')
  })

  it('clamps an out-of-range initial step', () => {
    expect(render(research(), 9)).toContain('Does it pay you to wait?')
    expect(render(research(), -1)).toContain('What does this business do?')
  })
})
