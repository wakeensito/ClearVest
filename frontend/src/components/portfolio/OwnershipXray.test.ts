import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import type { Holdings } from '../../api/client'
import { FEES_PENDING } from '../../lib/xrayCopy'
import { FUNDS_UNAVAILABLE, NO_XRAY_DATA, OwnershipXray, OwnershipXraySkeleton } from './OwnershipXray'
import { QQQ_FUND, renderSeeded, sampleHoldings, seedError, seedFunds, text } from './xray.fixtures'

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

  it('renders partial data with dots and "N of M" while a fund loads, and holds the fee sentences until it settles', () => {
    const html = render(sampleHoldings(), (c) => seedFunds(c, ['VOO', 'QQQ']))
    const t = text(html)
    expect(html).toContain('aria-label="Checking more of your funds"')
    expect(t).toContain('(2 of 3 funds checked)')
    expect(t).toContain(FEES_PENDING)
    expect(html).toContain('data-xray-fees="pending"')
    expect(t).not.toContain('Fee not available')
    expect(t).not.toMatch(/cost about \$/)
  })

  it('shows a skeleton until the first fund arrives', () => {
    expect(render(sampleHoldings(), () => {})).toContain('aria-label="Looking inside your funds"')
  })

  it('a failed fund is "Fee not available" and the cost sentence says whose cost it is', () => {
    const html = render(sampleHoldings(), (c) => { seedFunds(c, ['VOO', 'QQQ']); seedError(c, ['fund', 'VGT']) })
    const t = text(html)
    expect(html).not.toContain('Checking more of your funds')
    expect(t).toContain('(2 of 3 funds checked)')
    expect(t).toContain('Fee not available: VGT')
    expect(t).toMatch(/The funds we could check cost about \$\d+ a year/)
  })

  it('a fund that is never requested reads "Not checked", not "Fee not available"', () => {
    const data = sampleHoldings()
    data.holdings.push({ symbol: 'BAD FUND', name: 'Odd Fund', type: 'etf', quantity: 1, price: 50, value: 50, weight: 0.002 })
    const t = text(render(data, (c) => seedFunds(c)))
    expect(t).toContain('(3 of 4 funds checked)')
    expect(t).toContain('Not checked: BAD FUND')
    expect(t).not.toContain('Fee not available')
  })

  it('when every fund lookup fails, says so with a Retry instead of guessing who the money is in', () => {
    const html = render(sampleHoldings(), (c) => { for (const s of ['VOO', 'QQQ', 'VGT']) seedError(c, ['fund', s]) })
    const t = text(html)
    expect(t).toContain(FUNDS_UNAVAILABLE)
    expect(t).toContain('Retry')
    expect(t).not.toMatch(/held directly|of your money|Link an account/)
    expect(html).not.toContain('<li')
  })

  it('a funds-only account whose lookups fail never tells a linked user to link an account', () => {
    const data = sampleHoldings()
    data.holdings = data.holdings.filter((x) => x.type === 'etf')
    const t = text(render(data, (c) => { for (const s of ['VOO', 'QQQ', 'VGT']) seedError(c, ['fund', s]) }))
    expect(t).toContain(FUNDS_UNAVAILABLE)
    expect(t).not.toContain('Link an account')
  })

  it('qualifies "held directly" when some funds could not be opened', () => {
    const data = sampleHoldings()
    data.holdings = data.holdings.filter((x) => x.symbol === 'AAPL' || x.symbol === 'VGT' || x.symbol === 'QQQ')
    const bondish = { ...QQQ_FUND, topHoldings: [{ symbol: null, name: 'United States Treasury Notes', weight: 0.05 }] }
    const t = text(render(data, (c) => { c.setQueryData(['fund', 'QQQ'], bondish); seedError(c, ['fund', 'VGT']) }))
    expect(t).toMatch(/^ ?What you really own Apple is about \d+% of your money, held directly \(we couldn't look inside 1 of your funds\)\./)
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
