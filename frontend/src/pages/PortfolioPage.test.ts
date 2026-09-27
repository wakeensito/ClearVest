import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { renderSeeded, sampleHoldings, seedFunds, TEMPLATES } from '../components/portfolio/xray.fixtures'
import { PortfolioPage } from './PortfolioPage'

describe('PortfolioPage', () => {
  it('opens the main column on "What you really own", above research and holdings (DESIGN.md §4.14)', () => {
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
})
