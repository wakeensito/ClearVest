import { createElement as h } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/errors'
import { AAPL, VOO } from '../lib/fundExplainer.fixtures'
import { renderSeeded, sampleHoldings, seedFunds, TEMPLATES } from '../components/portfolio/xray.fixtures'
import { PortfolioPage } from './PortfolioPage'

// ResearchPanel lazy-loads SecurityResearch, which a static render never resolves; render it eagerly
// so the page's own props to it (invite={false}) are exercised.
vi.mock('../components/market/ResearchPanel', async () => ({ SecurityResearch: (await import('../components/market/SecurityResearch')).SecurityResearch }))

describe('PortfolioPage', () => {
  it('opens the main column on "What you really own", above research and holdings (DESIGN.md §4.15)', () => {
    const html = renderSeeded(h(PortfolioPage), (c) => {
      c.setQueryData(['holdings'], sampleHoldings())
      c.setQueryData(['profile'], null)
      c.setQueryData(['templates'], TEMPLATES)
      seedFunds(c)
    })
    const xray = html.indexOf('id="xray"')
    const research = html.indexOf('Security research')
    const holdings = html.indexOf('id="holdings-heading"')
    expect(xray).toBeGreaterThan(-1)
    expect(research).toBeGreaterThan(xray)
    expect(holdings).toBeGreaterThan(research)
    expect(html).toContain('data-plan-vs-actual')
  })

  it('an unlinked account never gets the what-if invite here: it would link /portfolio to itself', () => {
    const html = renderSeeded(h(PortfolioPage), (c) => {
      c.getQueryCache().build(c, { queryKey: ['holdings'] }).setState({ status: 'error', error: new ApiError(409, 'NOT_LINKED', 'No linked account'), fetchStatus: 'idle' })
      c.setQueryData(['profile'], null)
      c.setQueryData(['fund', 'VOO'], VOO)
      c.setQueryData(['fund', 'AAPL'], AAPL)
    })
    expect(html).toContain('data-identity-row')
    expect(html).not.toContain('data-what-if-invite')
  })
})
