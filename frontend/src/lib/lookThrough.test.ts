import { describe, expect, it } from 'vitest'
import type { Fund, Holding } from '../api/client'
import { VOO } from './fundExplainer.fixtures'
import { companyKey, fundFees, lookThrough, type FundMap } from './lookThrough'

// Sample sandbox account (src/layer/clearvest/providers/plaid.py:49-84), prices as of 2026-09-26.
const QTY = {
  VOO: { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'etf', quantity: 15, price: 710.79 },
  QQQ: { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf', quantity: 6, price: 744.5 },
  VGT: { symbol: 'VGT', name: 'Vanguard Information Technology ETF', type: 'etf', quantity: 8, price: 126.17 },
  NVDA: { symbol: 'NVDA', name: 'NVIDIA Corp', type: 'equity', quantity: 12, price: 225.07 },
  AAPL: { symbol: 'AAPL', name: 'Apple Inc', type: 'equity', quantity: 10, price: 341.07 },
} as const
const CASH_VALUE = 1500

function makeHoldings(): Holding[] {
  const rows = Object.values(QTY).map(r => ({ ...r, value: r.quantity * r.price }))
  const total = rows.reduce((s, r) => s + r.value, 0) + CASH_VALUE
  const holdings: Holding[] = rows.map(r => ({
    symbol: r.symbol, name: r.name, type: r.type, quantity: r.quantity, price: r.price, value: r.value,
    weight: r.value / total,
  }))
  holdings.push({ symbol: 'CUR:USD', name: 'Cash', type: 'cash', quantity: CASH_VALUE, price: 1, value: CASH_VALUE, weight: CASH_VALUE / total })
  return holdings
}

const holdings = makeHoldings()
const total = holdings.reduce((s, h) => s + h.value, 0)
const weightOf = (symbol: string) => holdings.find(h => h.symbol === symbol)!.weight

// Minimal QQQ / VGT fund fixtures (VOO comes from the shared fundExplainer fixture).
const QQQ_FUND: Fund = {
  symbol: 'QQQ',
  name: 'Invesco QQQ Trust',
  kind: 'etf',
  isIndexFund: true,
  leveraged: false,
  tracks: 'NASDAQ-100 Index',
  expenseRatio: 0.002,
  topHoldings: [
    { symbol: 'NVDA', name: 'NVIDIA Corp', weight: 0.09 },
    { symbol: 'AAPL', name: 'Apple Inc', weight: 0.08 },
  ],
  summary: 'QQQ tracks the Nasdaq-100.',
  summarySource: 'template',
  asOf: '2026-09-26',
  stale: false,
  fundFamily: 'Invesco',
  category: 'Large Growth',
  sector: null,
}

const VGT_FUND: Fund = {
  symbol: 'VGT',
  name: 'Vanguard Information Technology ETF',
  kind: 'etf',
  isIndexFund: true,
  leveraged: false,
  tracks: 'MSCI US IMI Information Technology 25/50',
  expenseRatio: 0.0009,
  topHoldings: [
    { symbol: 'NVDA', name: 'NVIDIA Corp', weight: 0.1 },
    { symbol: 'AAPL', name: 'Apple Inc', weight: 0.07 },
  ],
  summary: 'VGT holds U.S. technology companies.',
  summarySource: 'template',
  asOf: '2026-09-26',
  stale: false,
  fundFamily: 'Vanguard',
  category: 'Technology',
  sector: null,
}

const funds: FundMap = { VOO, QQQ: QQQ_FUND, VGT: VGT_FUND }

describe('lookThrough', () => {
  it('adds AAPL direct exposure to its share of every fund that holds it, via rows ordered by share desc', () => {
    const result = lookThrough(holdings, funds)
    const aapl = result.companies.find(c => c.symbol === 'AAPL')
    expect(aapl).toBeDefined()

    const direct = weightOf('AAPL')
    const viaVOO = weightOf('VOO') * 0.070339 // AAPL row in the shared VOO fixture
    const viaQQQ = weightOf('QQQ') * 0.08
    const viaVGT = weightOf('VGT') * 0.07
    const expectedTotal = direct + viaVOO + viaQQQ + viaVGT

    expect(aapl!.direct).toBeCloseTo(direct, 12)
    expect(aapl!.share).toBeCloseTo(expectedTotal, 12)
    expect(aapl!.name).toBe('Apple')

    const expectedViaSorted = [
      { fund: 'VOO', share: viaVOO },
      { fund: 'QQQ', share: viaQQQ },
      { fund: 'VGT', share: viaVGT },
    ].sort((a, b) => b.share - a.share)
    expect(aapl!.via.map(v => v.fund)).toEqual(expectedViaSorted.map(v => v.fund))
    aapl!.via.forEach((v, i) => expect(v.share).toBeCloseTo(expectedViaSorted[i]!.share, 12))
  })

  it('topShare(2) sums the two largest companies (AAPL and NVDA here), and companies sort desc', () => {
    const result = lookThrough(holdings, funds)
    const [first, second] = result.companies
    expect(new Set([first!.symbol, second!.symbol])).toEqual(new Set(['AAPL', 'NVDA']))
    for (let i = 1; i < result.companies.length; i++) {
      expect(result.companies[i - 1]!.share).toBeGreaterThanOrEqual(result.companies[i]!.share)
    }
    expect(result.topShare(2)).toBeCloseTo(first!.share + second!.share, 12)
  })

  it('a fund missing from the map drops fundsLookedThrough and coverage, without throwing', () => {
    const fullResult = lookThrough(holdings, funds)
    const withoutQQQ: FundMap = { VOO, VGT: VGT_FUND }
    expect(() => lookThrough(holdings, withoutQQQ)).not.toThrow()
    const result = lookThrough(holdings, withoutQQQ)
    expect(result.fundsLookedThrough).toBe(fullResult.fundsLookedThrough - 1)
    expect(result.coverage).toBeLessThan(fullResult.coverage)
    expect(result.fundsTotal).toBe(fullResult.fundsTotal)
  })

  it('a fund with empty topHoldings counts as not looked through', () => {
    const emptyQQQ: Fund = { ...QQQ_FUND, topHoldings: [] }
    const result = lookThrough(holdings, { VOO, QQQ: emptyQQQ, VGT: VGT_FUND })
    expect(result.fundsLookedThrough).toBe(2) // VOO + VGT only
    expect(result.fundsTotal).toBe(3)
  })

  it('a symbol-less fund row merges into the direct holding via the name key', () => {
    const nvidiaNoSymbol: Fund = {
      ...VGT_FUND,
      topHoldings: [{ symbol: null, name: 'NVIDIA Corp', weight: 0.1 }, { symbol: 'AAPL', name: 'Apple Inc', weight: 0.07 }],
    }
    const result = lookThrough(holdings, { VOO, QQQ: QQQ_FUND, VGT: nvidiaNoSymbol })
    const nvda = result.companies.find(c => c.symbol === 'NVDA')
    expect(nvda).toBeDefined()
    // exactly one NVDA row, not a separate "name:nvidia corp" entry
    expect(result.companies.filter(c => c.name === 'NVIDIA').length).toBe(1)
    const expectedVia = weightOf('VGT') * 0.1
    expect(nvda!.via.find(v => v.fund === 'VGT')?.share).toBeCloseTo(expectedVia, 12)
  })

  it('companyKey uses uppercase symbol when present, else a normalized name key', () => {
    expect(companyKey('aapl', 'Apple Inc')).toBe('AAPL')
    expect(companyKey(null, 'Apple Inc')).toBe(companyKey(null, 'Apple Inc.'))
    expect(companyKey(undefined, 'Apple Inc')).not.toBe('AAPL')
  })

  it('ignores shorts, and an all-cash account has no data', () => {
    // XOM appears in none of VOO/QQQ/VGT's top holdings, so a short here can only surface as a
    // direct row — the assertion below would also pass (correctly) for a symbol shorts share
    // with a fund, since look-through exposure via a *different*, long fund holding is real.
    const shorted: Holding = { symbol: 'XOM', name: 'Exxon Mobil Corp', type: 'equity', quantity: -5, price: 100, value: -500, weight: -0.02 }
    const result = lookThrough([...holdings, shorted], funds)
    expect(result.companies.find(c => c.symbol === 'XOM')).toBeUndefined()

    const cashOnly: Holding = { symbol: 'CUR:USD', name: 'Cash', type: 'cash', quantity: 1000, price: 1, value: 1000, weight: 1 }
    const cashResult = lookThrough([cashOnly], {})
    expect(cashResult.hasData).toBe(false)
    expect(cashResult.companies).toEqual([])
    expect(cashResult.coverage).toBe(0)
  })
})

describe('fundFees', () => {
  it('rows sorted by dollars desc, unknown funds listed, blended/cheapest/ifAllCheapest/tenYear derived', () => {
    const vooValue = weightOf('VOO') * total
    const qqqValue = weightOf('QQQ') * total
    const vgtValue = weightOf('VGT') * total

    const result = fundFees(holdings, funds)

    const vooRow = result.rows.find(r => r.symbol === 'VOO')!
    const qqqRow = result.rows.find(r => r.symbol === 'QQQ')!
    const vgtRow = result.rows.find(r => r.symbol === 'VGT')!
    expect(vooRow.dollars).toBeCloseTo(vooValue * 0.0003, 6)
    expect(qqqRow.dollars).toBeCloseTo(qqqValue * 0.002, 6)
    expect(vgtRow.dollars).toBeCloseTo(vgtValue * 0.0009, 6)

    for (let i = 1; i < result.rows.length; i++) {
      expect(result.rows[i - 1]!.dollars).toBeGreaterThanOrEqual(result.rows[i]!.dollars)
    }
    expect(result.unknown).toEqual([])

    const expectedFundValue = vooValue + qqqValue + vgtValue
    const expectedPerYear = vooValue * 0.0003 + qqqValue * 0.002 + vgtValue * 0.0009
    expect(result.fundValue).toBeCloseTo(expectedFundValue, 6)
    expect(result.perYear).toBeCloseTo(expectedPerYear, 6)
    expect(result.blendedRatio).toBeCloseTo(expectedPerYear / expectedFundValue, 12)
    expect(result.cheapestRatio).toBeCloseTo(0.0003, 12) // VOO is cheapest
    expect(result.ifAllCheapest).toBeCloseTo(expectedFundValue * 0.0003, 6)
    expect(result.tenYear).toBeCloseTo(expectedPerYear * 10, 6)
  })

  it('lists a fund with a null expenseRatio under unknown, and excludes it from the numbers', () => {
    const unknownVoo: Fund = { ...VOO, expenseRatio: null }
    const result = fundFees(holdings, { ...funds, VOO: unknownVoo })
    expect(result.unknown).toContain('VOO')
    expect(result.rows.find(r => r.symbol === 'VOO')).toBeUndefined()
  })

  it('a fund missing from the map is also unknown', () => {
    const result = fundFees(holdings, { QQQ: QQQ_FUND, VGT: VGT_FUND })
    expect(result.unknown).toContain('VOO')
  })

  it('no funds at all: nulls and zeros, nothing throws', () => {
    const noFunds = holdings.filter(h => h.type !== 'etf')
    expect(() => fundFees(noFunds, {})).not.toThrow()
    const result = fundFees(noFunds, {})
    expect(result.rows).toEqual([])
    expect(result.unknown).toEqual([])
    expect(result.fundValue).toBe(0)
    expect(result.perYear).toBe(0)
    expect(result.blendedRatio).toBeNull()
    expect(result.cheapestRatio).toBeNull()
    expect(result.ifAllCheapest).toBeNull()
    expect(result.tenYear).toBe(0)
  })
})
