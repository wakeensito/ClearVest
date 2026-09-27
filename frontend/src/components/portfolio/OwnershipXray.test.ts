import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import type { Holdings } from '../../api/client'
import { NO_XRAY_DATA, OwnershipXray, OwnershipXraySkeleton } from './OwnershipXray'
import { renderSeeded, sampleHoldings, seedError, seedFunds, text } from './xray.fixtures'

const render = (data: Holdings, seed: Parameters<typeof renderSeeded>[1], hideValues = false) =>
  renderSeeded(h(OwnershipXray, { data, hideValues }), seed)

describe('OwnershipXray', () => {
  it('leads with the top company, split into direct and inside funds, computed from the account', () => {
    const html = render(sampleHoldings(), (c) => seedFunds(c))
    expect(html).toContain('id="xray"')
    expect(text(html)).toContain('What you really own')
    expect(text(html)).toContain('Apple is about 20% of your money: 14% directly, 6% inside VOO, QQQ and VGT.')
  })

  it('lists five companies with a mono symbol, a 1-decimal share and a via line; bars are hidden from readers', () => {
    const html = render(sampleHoldings(), (c) => seedFunds(c))
    expect(html.match(/<li class/g)).toHaveLength(5)
    expect(text(html)).toMatch(/Apple AAPL 19\.7%/)
    expect(text(html)).toMatch(/14% direct · VOO 3% · QQQ 2% · VGT 1%/)
    expect(html).toMatch(/aria-hidden="true"[^>]*><span class="[^"]*direct/)
  })

  it('sums the top companies and says how many funds were looked inside, and when', () => {
    const t = text(render(sampleHoldings(), (c) => seedFunds(c)))
    expect(t).toMatch(/Your top 7 companies are \d+% of everything\./)
    expect(t).toContain("Counting each fund's top 10 holdings (3 of 3 funds checked) · as of Sep 26, 2026 · funds' smaller holdings aren't counted")
  })

  it('says what the funds cost, in dollars and percents, and never names a fund to buy', () => {
    const t = text(render(sampleHoldings(), (c) => seedFunds(c)))
    expect(t).toContain('What it costs')
    expect(t).toMatch(/Your funds cost about \$\d+ a year \(0\.\d\d% of the money in them\)\./)
    expect(t).toMatch(/At the same balance that's about \$\d+ over 10 years\./)
    expect(t).toMatch(/If every fund cost what your cheapest one does \(0\.03%\), it would be about \$\d+ a year\./)
    expect(t).toMatch(/QQQ 0\.2% \$\d+\.\d\d/)
    expect(t).not.toMatch(/switch to|you should|recommend/i)
  })

  it('renders partial data with dots and an "N of M" caption while a fund is still loading', () => {
    const html = render(sampleHoldings(), (c) => seedFunds(c, ['VOO', 'QQQ']))
    expect(html).toContain('aria-label="Checking more of your funds"')
    expect(text(html)).toContain('(2 of 3 funds checked)')
    expect(text(html)).toContain('Fee not available: VGT')
  })

  it('shows a skeleton until the first fund arrives, then counts a failed fund as unchecked', () => {
    expect(render(sampleHoldings(), () => {})).toContain('aria-label="Looking inside your funds"')
    const html = render(sampleHoldings(), (c) => { seedFunds(c, ['VOO', 'QQQ']); seedError(c, ['fund', 'VGT']) })
    expect(html).not.toContain('Checking more of your funds')
    expect(text(html)).toContain('(2 of 3 funds checked)')
  })

  it('hides every dollar figure in hidden-values mode but keeps the percents', () => {
    const t = text(render(sampleHoldings(), (c) => seedFunds(c), true))
    expect(t).not.toContain('$')
    expect(t).toContain('Apple is about 20% of your money')
    expect(t).toMatch(/Your funds cost about 0\.\d\d% of the money in them each year\./)
    expect(t).toContain('Hidden')
  })

  it('says a stock-only account holds its companies directly, with no fee panel', () => {
    const data = sampleHoldings()
    data.holdings = data.holdings.filter((x) => x.type === 'equity')
    const t = text(render(data, () => {}))
    expect(t).toMatch(/is about \d+% of your money, all of it held directly\./)
    expect(t).toContain('Based on your holdings as of Sep 26, 2026')
    expect(t).not.toContain('What it costs')
  })

  it('falls back to one sentence when there is nothing to look through', () => {
    const data = sampleHoldings()
    data.holdings = data.holdings.filter((x) => x.type === 'cash')
    expect(text(render(data, () => {}))).toContain(NO_XRAY_DATA)
  })

  it('keeps the #xray target while holdings load', () => {
    const html = renderSeeded(h(OwnershipXraySkeleton), () => {})
    expect(html).toContain('id="xray"')
    expect(html).toContain('role="status"')
  })
})
