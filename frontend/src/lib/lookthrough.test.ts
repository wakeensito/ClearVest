import { describe, expect, it } from 'vitest'
import type { Fund } from '../api/client'
import { floorShare, fromLiveFund, FUND_SNAPSHOTS, heldFunds, lookthrough, spotlight } from './lookthrough'

/** "Use a sample account": VOO 15, QQQ 6, VGT 8, NVDA 12, AAPL 10 at the sandbox prices. */
const SAMPLE = [
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'etf', value: 10661.85 },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf', value: 4467 },
  { symbol: 'VGT', name: 'Vanguard Information Technology ETF', type: 'etf', value: 1009.36 },
  { symbol: 'NVDA', name: 'NVIDIA Corp', type: 'equity', value: 2700.84 },
  { symbol: 'AAPL', name: 'Apple Inc', type: 'equity', value: 3410.7 },
]

describe('look-through', () => {
  it('bundles the three sample funds with sorted top tens', () => {
    for (const symbol of ['VOO', 'QQQ', 'VGT']) {
      const fund = FUND_SNAPSHOTS[symbol]
      expect(fund?.holdings).toHaveLength(10)
      const weights = fund!.holdings.map((h) => h.weight)
      expect(weights).toEqual([...weights].sort((a, b) => b - a))
    }
  })

  it('sums the sample account to the numbers in the kickoff note', () => {
    const result = lookthrough(SAMPLE, FUND_SNAPSHOTS)
    expect(result.total).toBeCloseTo(22249.75, 2)
    expect(result.funds).toEqual(['VOO', 'QQQ', 'VGT'])
    expect(result.asOf).toBe('2026-09-26')
    const [apple, nvidia] = result.companies
    expect(apple.symbol).toBe('AAPL')
    expect(apple.name).toBe('Apple')
    expect(apple.direct).toBeCloseTo(3410.7, 2)
    expect(apple.viaFunds).toEqual([
      { fund: 'VOO', dollars: expect.closeTo(746.33, 1) },
      { fund: 'QQQ', dollars: expect.closeTo(330.56, 1) },
      { fund: 'VGT', dollars: expect.closeTo(159.48, 1) },
    ])
    expect(apple.total).toBeCloseTo(4647, 0)
    expect(apple.share).toBeCloseTo(0.209, 3)
    expect(nvidia.symbol).toBe('NVDA')
    expect(nvidia.name).toBe('NVIDIA')
    expect(nvidia.total).toBeCloseTo(4123, 0)
    expect(nvidia.share).toBeCloseTo(0.185, 3)
    const top = spotlight(result)
    expect(top.map((c) => c.symbol)).toEqual(['AAPL', 'NVDA'])
    expect(floorShare(top)).toBe(0.39)
  })

  it('with no fund data counts only direct shares, and the whole portfolio in the denominator', () => {
    const result = lookthrough(SAMPLE, {})
    expect(result.funds).toEqual([])
    expect(result.asOf).toBeNull()
    expect(result.total).toBeCloseTo(22249.75, 2)
    expect(result.companies.map((c) => [c.symbol, c.viaFunds.length])).toEqual([['AAPL', 0], ['NVDA', 0]])
    expect(result.companies[0].share).toBeCloseTo(3410.7 / 22249.75, 4)
  })

  it('skips funds it cannot open, bonds and cash without dropping them from the total', () => {
    const holdings = [
      { symbol: 'SPY', name: 'SPDR S&P 500', type: 'etf', value: 5000 },
      { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', type: 'fixed income', value: 3000 },
      { symbol: 'CUR:USD', name: 'US Dollar', type: 'cash', value: 1000 },
      { symbol: 'AAPL', name: 'Apple Inc.', type: 'equity', value: 1000 },
    ]
    const result = lookthrough(holdings, FUND_SNAPSHOTS)
    expect(result.total).toBe(10000)
    expect(result.funds).toEqual([])
    expect(result.companies).toEqual([{ symbol: 'AAPL', name: 'Apple', direct: 1000, viaFunds: [], total: 1000, share: 0.1 }])
    // Exactly 10% is not above the floor, so no headline.
    expect(spotlight(result)).toEqual([])
  })

  it('shows nothing when the biggest company is under the floor, and merges stacked rows', () => {
    const spread = lookthrough([
      { symbol: 'VOO', name: 'VOO', type: 'etf', value: 500 },
      { symbol: 'VOO', name: 'VOO', type: 'etf', value: 500 },
      { symbol: 'BND', name: 'BND', type: 'fixed income', value: 9000 },
    ], FUND_SNAPSHOTS)
    expect(spread.companies[0]).toMatchObject({ symbol: 'NVDA', total: 81, share: 0.0081 })
    expect(spread.companies[0].viaFunds).toEqual([{ fund: 'VOO', dollars: 81 }])
    expect(spotlight(spread)).toEqual([])
    expect(lookthrough([], FUND_SNAPSHOTS)).toEqual({ total: 0, companies: [], funds: [], asOf: null })
  })

  it('picks the funds to fetch by Plaid type or snapshot, biggest first, capped', () => {
    expect(heldFunds(undefined)).toEqual([])
    expect(heldFunds(SAMPLE)).toEqual(['VOO', 'QQQ', 'VGT'])
    const many = ['A', 'B', 'C', 'D', 'E', 'F'].map((symbol, i) => ({ symbol, name: symbol, type: 'mutual fund', value: 100 - i }))
    expect(heldFunds(many)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(heldFunds([{ symbol: 'VOO', name: 'VOO', type: 'other', value: 1 }, { symbol: 'AAPL', name: 'Apple', type: 'equity', value: 1 }, { symbol: 'X', name: 'X', type: 'etf', value: 0 }])).toEqual(['VOO'])
  })

  it('takes the live route only when it describes a fund with weights', () => {
    const live: Fund = {
      symbol: 'VOO', name: 'Vanguard S&P 500 ETF', kind: 'etf', isIndexFund: true, leveraged: false, tracks: null, expenseRatio: 0.0003,
      topHoldings: [{ symbol: 'NVDA', name: 'NVIDIA Corp', weight: 0.0808 }, { symbol: null, name: 'Cash', weight: 0.01 }, { symbol: 'AAPL', name: 'Apple Inc', weight: 0.0703 }],
      fundFamily: 'Vanguard', category: 'Large Blend', sector: null, summary: '', summarySource: 'template', asOf: '2026-09-27', stale: false,
    }
    expect(fromLiveFund(live)).toEqual({ symbol: 'VOO', name: 'Vanguard S&P 500 ETF', asOf: '2026-09-27', holdings: [{ symbol: 'NVDA', name: 'NVIDIA Corp', weight: 0.0808 }, { symbol: 'AAPL', name: 'Apple Inc', weight: 0.0703 }] })
    expect(fromLiveFund({ ...live, kind: 'stock', topHoldings: [] })).toBeNull()
    expect(fromLiveFund({ ...live, topHoldings: [] })).toBeNull()
    expect(fromLiveFund(undefined)).toBeNull()
    // Live weights win over the snapshot for the same fund; the newer date is then the oldest counted.
    const result = lookthrough([{ symbol: 'VOO', name: 'VOO', type: 'etf', value: 10000 }], { VOO: fromLiveFund(live)! })
    expect(result.companies.find((c) => c.symbol === 'AAPL')).toMatchObject({ name: 'Apple', total: 703, share: 0.0703 })
    expect(result.asOf).toBe('2026-09-27')
  })
})
