import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement as h, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { Fund } from '../../api/client'
import { ApiError } from '../../api/errors'
import { AAPL, TOP_TEN, VFIAX, VOO } from '../../lib/fundExplainer.fixtures'
import type { FundState } from '../../lib/fundExplainer'
import { CompactFundExplainer, FundExplainer, FundIdentity, FundLesson, KeepLearning, RealDifference } from './FundExplainer'
import { SecurityResearch } from './SecurityResearch'

const ok = (fund: Fund): FundState => ({ status: 'success', fund })
const routed = (node: ReactNode, url = '/markets?symbol=VOO') => renderToStaticMarkup(h(MemoryRouter, { initialEntries: [url] }, node))
const noop = () => {}
const identity = (state: FundState, symbol = 'VOO') => renderToStaticMarkup(h(FundIdentity, { symbol, state, open: false, onToggle: noop, controls: 'x' }))
const lesson = (fund: Fund, extra: Partial<{ onSeeFinancials: () => void; compact: boolean }> = {}) =>
  routed(h(FundLesson, { fund, symbol: fund.symbol, ...extra }))
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')

describe('identity line', () => {
  it('names the kind and index, with a collapsed "What is this?" button', () => {
    const html = identity(ok(VOO))
    expect(text(html)).toContain('VOO · Index fund (ETF)')
    expect(text(html)).toContain("Tracks the Standard & Poor's 500 Index")
    expect(html).toContain('aria-expanded="false"')
    expect(text(html)).toContain('What is this?')
  })

  it('reads "Company stock" for a stock and omits "Tracks" when tracks is null', () => {
    const html = text(identity(ok(AAPL), 'AAPL'))
    expect(html).toContain('AAPL · Company stock')
    expect(html).not.toContain('Tracks')
  })

  it('shows a quiet, hidden skeleton while loading and nothing at all on error', () => {
    expect(identity({ status: 'pending' })).toContain('data-fund-identity="loading"')
    expect(identity({ status: 'pending' })).toContain('aria-hidden="true"')
    expect(identity({ status: 'error' })).toBe('')
  })

  it('keeps a long fund name as wrappable text rather than truncating it', () => {
    const long = { ...VOO, tracks: 'Center for Research in Security Prices US Total Market Index Including Micro-Capitalization Companies' }
    expect(text(identity(ok(long)))).toContain(`Tracks the ${long.tracks}`)
  })
})

describe('explainer steps', () => {
  it('a fund shows what it is, the dollar strip and the fee, with the rest behind chips', () => {
    const html = lesson(VOO)
    const words = text(html)
    expect(words).toContain('What is it?')
    expect(words).toContain('VOO is a fund that owns shares of about 500 of the biggest U.S. companies.')
    expect(words).not.toContain('When they do well') // first sentence only
    expect(html).toMatch(/<div[^>]*aria-hidden="true"[^>]*data-dollar-strip/)
    expect(words).toContain('Of every $1: 8¢ NVIDIA · 7¢ Apple · 6¢ Microsoft + 501 more')
    expect(words).toContain('About $3 a year on every $10,000 invested · expense ratio 0.03%')
    expect(words).toContain('Everything else')
    for (const chip of ['Who runs it?', 'Where is the money?', 'Why own it?', 'How do I buy it?', 'ETF or mutual fund?']) expect(words).toContain(chip)
    expect(html).not.toContain('data-topic') // no answer open until asked
    expect(html).not.toContain('<table')
  })

  it('a stock shows only what it is, with no strip, no fee step and a jump to its financials', () => {
    const html = lesson(AAPL, { onSeeFinancials: noop })
    expect(html).not.toContain('data-dollar-strip')
    expect(text(html)).not.toContain('What does it cost?')
    expect(text(html)).not.toContain('What’s inside?')
    expect(text(html)).toContain('See what this company earns')
    expect(text(html)).toContain('Summary written by AI')
  })

  it('a fund without holdings says so instead of drawing an empty strip', () => {
    const html = lesson({ ...VOO, topHoldings: [] })
    expect(html).not.toContain('data-dollar-strip')
    expect(text(html)).toContain('Holdings information isn’t available for this fund right now.')
  })

  it('a missing fee reads as unavailable, without an expense ratio caption', () => {
    const words = text(lesson({ ...VOO, expenseRatio: null }))
    expect(words).toContain("Fee information isn't available.")
    expect(words).not.toContain('expense ratio')
  })

  it('a holding with a null symbol still shows its name', () => {
    const words = text(lesson({ ...VOO, topHoldings: [{ symbol: null, name: 'US Treasury Note 4.25%', weight: 0.09 }, ...TOP_TEN.slice(1)] }))
    expect(words).toContain('9¢ US Treasury Note 4.25%')
  })

  it('compact mode (Compare securities) drops the data line and the financials jump', () => {
    const words = text(lesson(AAPL, { onSeeFinancials: noop, compact: true }))
    expect(words).not.toContain('See what this company earns')
    expect(words).not.toContain('Data as of')
  })
})

describe('keep learning chips', () => {
  const topics = [
    { id: 'who' as const, label: 'Who runs it?', answer: 'Vanguard runs it.' },
    { id: 'compare' as const, label: 'ETF or mutual fund?', answer: 'VOO is both.' },
  ]

  it('opens one answer that ends with the next question', () => {
    const html = routed(h(KeepLearning, { topics, symbol: 'VOO', initial: 'who' }))
    expect(html.match(/data-topic=/g)).toHaveLength(1)
    expect(text(html)).toContain('Next: ETF or mutual fund?')
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(1)
  })

  it('the comparison answer shows the three-column table and ends with the advisor', () => {
    const html = routed(h(KeepLearning, { topics, symbol: 'VOO', initial: 'compare' }))
    expect(html.match(/<th scope="col">/g)).toHaveLength(3)
    expect(text(html)).toContain('It can be an ETF or a mutual fund.')
    expect(html).toContain('href="/advisor?q=What%20is%20VOO')
    expect(text(html)).toContain('Ask the advisor about VOO')
  })
})

describe('explainer region', () => {
  const region = (state: FundState) => routed(h(FundExplainer, { id: 'e', symbol: 'VOO', state, onDone: noop, onRetry: noop, onSeeFinancials: noop }))

  it('has a labelled region, a heading and a Done button', () => {
    const html = region(ok(VOO))
    expect(html).toContain('aria-labelledby="e-heading"')
    expect(text(html)).toContain('VOO explained')
    expect(text(html)).toContain('Done')
  })

  it('loading and error stay inside the region', () => {
    expect(region({ status: 'pending' })).toContain('role="status"')
    expect(text(region({ status: 'error' }))).toContain('The chart below still works.')
  })
})

describe('compare securities', () => {
  it('the compact explainer renders nothing on error and the lesson when loaded', () => {
    expect(routed(h(CompactFundExplainer, { symbol: 'VOO', state: { status: 'error' } }))).toBe('')
    expect(text(routed(h(CompactFundExplainer, { symbol: 'VOO', state: ok(VOO) })))).toContain('VOO · Index fund (ETF)')
  })

  it('the difference strip waits for both sides', () => {
    expect(routed(h(RealDifference, { left: ok(VOO), right: { status: 'pending' } }))).toBe('')
    const words = text(routed(h(RealDifference, { left: ok(VOO), right: ok(VFIAX) })))
    expect(words).toContain('What’s the real difference?')
    expect(words).toContain('about $3 vs about $4 a year on $10,000')
  })

  it('two stocks link to Compare companies', () => {
    expect(routed(h(RealDifference, { left: ok(AAPL), right: ok({ ...AAPL, symbol: 'MSFT' }) }))).toContain('href="/markets?view=companies"')
  })
})

describe('the price chart is never blocked by fund data', () => {
  const history = { series: [{ symbol: 'VOO', returnPct: 0.1, volatility: 0.12, points: [{ date: '2026-08-01', close: 531.4 }, { date: '2026-09-25', close: 560.2 }] }] }
  const page = (fund: 'error' | 'pending' | 'success', url = '/markets?symbol=VOO') => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } })
    client.setQueryData(['history', 'VOO', '1y'], history)
    if (fund === 'success') client.setQueryData(['fund', 'VOO'], VOO)
    if (fund === 'error') {
      client.getQueryCache().build(client, { queryKey: ['fund', 'VOO'] }).setState({
        status: 'error', fetchStatus: 'idle', error: new ApiError(502, 'UPSTREAM_UNAVAILABLE', 'Upstream unavailable'),
        errorUpdateCount: 1, errorUpdatedAt: Date.now(),
      })
    }
    return renderToStaticMarkup(h(QueryClientProvider, { client }, h(MemoryRouter, { initialEntries: [url] }, h(SecurityResearch, { initialSymbol: 'VOO' }))))
  }

  it('a 502 hides the identity line and the chart renders', () => {
    const html = page('error')
    expect(html).toContain('aria-label="VOO interactive price chart"')
    expect(html).not.toContain('data-fund-identity')
    expect(html).not.toContain('What is this?')
  })

  it('loading shows a skeleton line above a rendered chart', () => {
    const html = page('pending')
    expect(html).toContain('data-fund-identity="loading"')
    expect(html).toContain('aria-label="VOO interactive price chart"')
  })

  it('explain=1 opens the explainer between the identity line and the chart', () => {
    const html = page('success', '/markets?symbol=VOO&explain=1')
    const [identityAt, explainerAt, chartAt] = ['data-fund-identity="ready"', 'data-fund-explainer="VOO"', 'VOO interactive price chart'].map(s => html.indexOf(s))
    expect(identityAt).toBeGreaterThan(-1)
    expect(explainerAt).toBeGreaterThan(identityAt)
    expect(chartAt).toBeGreaterThan(explainerAt)
    expect(html).toContain('aria-expanded="true"')
  })

  it('without explain=1 only the identity line is added', () => {
    const html = page('success')
    expect(html).toContain('data-fund-identity="ready"')
    expect(html).not.toContain('data-fund-explainer')
  })

  it('a 502 with explain=1 keeps the chart and offers a retry inside the explainer', () => {
    const html = page('error', '/markets?symbol=VOO&explain=1')
    expect(html).toContain('aria-label="VOO interactive price chart"')
    expect(text(html)).toContain('Try again')
  })
})
