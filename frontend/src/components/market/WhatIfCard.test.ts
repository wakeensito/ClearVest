import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { Fund } from '../../api/client'
import { ApiError } from '../../api/errors'
import type { FundState } from '../../lib/fundExplainer'
import { AAPL, SPX, VOO } from '../../lib/fundExplainer.fixtures'
import { renderSeeded, sampleHoldings, seedFunds, text } from '../portfolio/xray.fixtures'
import { SecurityResearch } from './SecurityResearch'
import { WhatIfCard } from './WhatIfCard'

const NVDA: Fund = { ...AAPL, symbol: 'NVDA', name: 'NVIDIA Corp', summary: 'NVIDIA designs chips.' }
const ok = (fund: Fund): FundState => ({ status: 'success', fund })
const profile = { age: 25, horizon: 'long', riskTolerance: 'high', goals: [] }

const render = (symbol: string, state: FundState, seed: Parameters<typeof renderSeeded>[1]) =>
  renderSeeded(h(WhatIfCard, { symbol, state }), seed)

const linked: Parameters<typeof renderSeeded>[1] = (c) => {
  c.setQueryData(['holdings'], sampleHoldings())
  c.setQueryData(['profile'], profile)
  seedFunds(c)
}

function seedApiError(c: Parameters<Parameters<typeof renderSeeded>[1]>[0], key: readonly unknown[], error: ApiError) {
  c.getQueryCache().build(c, { queryKey: key }).setState({ status: 'error', error, fetchStatus: 'idle', errorUpdateCount: 1, errorUpdatedAt: Date.now() })
}

describe('WhatIfCard', () => {
  it('leads with the what-if sentence for $1,000, then risk and exposure before → after', () => {
    const html = render('NVDA', ok(NVDA), linked)
    const t = text(html)
    expect(html).toContain('data-what-if="NVDA"')
    expect(t).toContain('What would this do to my portfolio?')
    expect(t).toMatch(/Adding \$1,000 of NVDA: your NVDA exposure goes from \d+% to \d+% \(counting what your funds hold\), and your risk score from \d+ to \d+/)
    expect(t).toMatch(/Risk score \d+ → \d+/)
    expect(t).toMatch(/NVDA exposure \d+% → \d+%/)
    expect(t).toContain("Counting each fund's top 10 holdings (3 of 3 funds checked). Educational, not a recommendation.")
    expect(html).toMatch(/aria-pressed="true"[^>]*>\$1,000</)
  })

  it('draws the bars for sighted readers only and offers no buy action', () => {
    const html = render('NVDA', ok(NVDA), linked)
    expect(html.match(/<dd class="[^"]*" aria-hidden="true">/g)).toHaveLength(2)
    expect(text(html)).not.toMatch(/\bbuy\b|you should|recommend(?!ation)/i)
  })

  it('says when the biggest single company would change, and only then', () => {
    expect(text(render('NVDA', ok(NVDA), linked))).toContain('NVDA would become your biggest single company.')
    expect(text(render('AAPL', ok(AAPL), linked))).not.toContain('biggest single company')
  })

  it('adding a fund not yet held counts it in the "N of M" caption', () => {
    const vti = { ...VOO, symbol: 'VTI', name: 'Vanguard Total Stock Market ETF' }
    const t = text(render('VTI', ok(vti), linked))
    expect(t).toContain('(4 of 4 funds checked)')
    expect(t).toContain("you'd go from owning no VTI to")
  })

  it('renders nothing when the account is not linked', () => {
    const html = render('NVDA', ok(NVDA), (c) => {
      seedApiError(c, ['holdings'], new ApiError(409, 'NOT_LINKED', 'No linked account'))
      c.setQueryData(['profile'], profile)
    })
    expect(html).toBe('')
  })

  it('scores without a profile when none is saved (404)', () => {
    const html = render('NVDA', ok(NVDA), (c) => {
      c.setQueryData(['holdings'], sampleHoldings())
      seedFunds(c)
      seedApiError(c, ['profile'], new ApiError(404, 'NOT_FOUND', 'No profile'))
    })
    expect(text(html)).toContain('Adding $1,000 of NVDA')
  })

  it('renders nothing while loading, for an index, for a failed fund lookup, or an empty account', () => {
    expect(render('NVDA', ok(NVDA), () => {})).toBe('')
    expect(render('NVDA', { status: 'pending' }, linked)).toBe('')
    expect(render('NVDA', { status: 'error' }, linked)).toBe('')
    expect(render('^GSPC', ok(SPX), linked)).toBe('')
    expect(render('NVDA', ok(NVDA), (c) => {
      c.setQueryData(['holdings'], { asOf: '2026-09-26', totalValue: 0, holdings: [] })
      c.setQueryData(['profile'], profile)
    })).toBe('')
  })

  it('waits for the first fund of the account rather than showing a stock-only answer', () => {
    const html = render('NVDA', ok(NVDA), (c) => {
      c.setQueryData(['holdings'], sampleHoldings())
      c.setQueryData(['profile'], profile)
    })
    expect(html).toBe('')
  })
})

describe('on the ticker page', () => {
  const history = { series: [{ symbol: 'NVDA', returnPct: 0.1, volatility: 0.3, points: [{ date: '2026-08-01', close: 200 }, { date: '2026-09-25', close: 225.07 }] }] }
  const page = (url: string, seed: Parameters<typeof renderSeeded>[1]) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } })
    client.setQueryData(['history', 'NVDA', '1y'], history)
    client.setQueryData(['fund', 'NVDA'], NVDA)
    seed(client)
    return renderToStaticMarkup(h(QueryClientProvider, { client }, h(MemoryRouter, { initialEntries: [url] }, h(SecurityResearch, { initialSymbol: 'NVDA' }))))
  }

  it('sits under the identity row and above the chart; an open explainer stays directly under the identity row', () => {
    const closed = page('/markets?symbol=NVDA', linked)
    const [identity, whatIfAt, chart] = ['data-identity-row', 'data-what-if="NVDA"', 'NVDA interactive price chart'].map(s => closed.indexOf(s))
    expect(identity).toBeGreaterThan(-1)
    expect(whatIfAt).toBeGreaterThan(identity)
    expect(chart).toBeGreaterThan(whatIfAt)

    const open = page('/markets?symbol=NVDA&explain=1', linked)
    expect(open.indexOf('data-fund-explainer="NVDA"')).toBeLessThan(open.indexOf('data-what-if="NVDA"'))
  })

  it('an unlinked account sees the research card exactly as before', () => {
    const html = page('/markets?symbol=NVDA', (c) => seedApiError(c, ['holdings'], new ApiError(409, 'NOT_LINKED', 'No linked account')))
    expect(html).not.toContain('data-what-if')
    expect(html).toContain('NVDA interactive price chart')
  })
})
