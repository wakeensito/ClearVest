// Ticker-page "what would adding $X of this do to my portfolio?" card, math only (DESIGN.md — the
// card itself is a separate task). Builds directly on lookThrough() and riskScore(); this file
// never re-implements their math, only exercises whatIf()/whatIfSentence() against the same sample
// account as lookThrough.test.ts and risk.test.ts (VOO/QQQ/AAPL/NVDA/cash/VGT, profile age 25 long).
import { describe, expect, it } from 'vitest'
import type { Fund, Holding } from '../api/client'
import { VOO } from './fundExplainer.fixtures'
import type { FundMap } from './lookThrough'
import type { RiskProfile } from './risk'
import { whatIf, whatIfSentence } from './whatIf'

// Same sample sandbox account as lookThrough.test.ts (src/layer/clearvest/providers/plaid.py:49-84).
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
const profile: RiskProfile = { age: 25, horizon: 'long' }

// Minimal QQQ / VGT fund fixtures (VOO comes from the shared fundExplainer fixture) — identical to
// lookThrough.test.ts so the two suites agree on the sample account's look-through math.
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

// NVDA the security itself, as /market/fund would return it (kind: stock -> equity).
const NVDA_FUND: Fund = {
  symbol: 'NVDA',
  name: 'NVIDIA Corp',
  kind: 'stock',
  isIndexFund: false,
  leveraged: false,
  tracks: null,
  expenseRatio: null,
  topHoldings: [],
  summary: 'NVIDIA designs chips used for gaming and AI.',
  summarySource: 'model',
  asOf: '2026-09-26',
  stale: false,
  fundFamily: null,
  category: null,
  sector: 'Technology',
}

// A stock that appears in none of the sample account's fund fixtures above, so its look-through
// exposure before adding is exactly 0 ("you'd go from no ORCL we can see...", since the account holds funds).
const ORCL_FUND: Fund = {
  ...NVDA_FUND,
  symbol: 'ORCL',
  name: 'Oracle Corp',
  summary: 'Oracle sells database software and cloud services.',
}

// An index: not a real position anyone can buy, so it's never addable.
const SPX_FUND: Fund = {
  ...NVDA_FUND,
  symbol: '^GSPC',
  name: 'S&P 500',
  kind: 'index',
  summarySource: 'template',
  summary: 'The S&P 500 is a list of about 500 of the biggest U.S. companies.',
}

const sumWeights = (rows: readonly Holding[]) => rows.reduce((s, h) => s + h.weight, 0)
const totalValue = holdings.reduce((s, h) => s + h.value, 0)

describe('whatIf', () => {
  it('adding $1,000 of NVDA (already held): weights renormalize to 1, the NVDA row grows, exposure and risk move up', () => {
    const result = whatIf({ holdings, funds, symbol: 'NVDA', fund: NVDA_FUND, dollars: 1000, profile })

    expect(result.addable).toBe(true)
    expect(sumWeights(result.holdingsAfter)).toBeCloseTo(1, 12)

    const nvdaBefore = holdings.find(h => h.symbol === 'NVDA')!
    const nvdaAfter = result.holdingsAfter.find(h => h.symbol === 'NVDA')!
    const newTotal = totalValue + 1000
    expect(nvdaAfter.value).toBeCloseTo(nvdaBefore.value + 1000, 6)
    expect(nvdaAfter.weight).toBeCloseTo((nvdaBefore.value + 1000) / newTotal, 12)
    expect(result.holdingsAfter.length).toBe(holdings.length) // grown, not appended
    // price/quantity come from the existing row, unchanged by a hypothetical dollar top-up
    expect(nvdaAfter.price).toBe(nvdaBefore.price)
    expect(nvdaAfter.quantity).toBe(nvdaBefore.quantity)

    // Exposure counts what the funds hold too (NVDA sits in VOO/QQQ/VGT's top holdings).
    expect(result.exposureBefore).toBeGreaterThan(nvdaBefore.weight)
    expect(result.exposureAfter).toBeGreaterThan(result.exposureBefore)
    expect(result.exposureBefore).toBeCloseTo(0.1711806110380109, 9)
    expect(result.exposureAfter).toBeCloseTo(0.2046686013798119, 9)

    expect(result.riskBefore.score).toBe(34) // matches risk.test.ts's sample-account case
    expect(result.riskBefore.label).toBe('Moderate')
    expect(result.riskAfter.score).toBe(35)
    expect(result.riskAfter.label).toBe('Moderate')
    expect(result.riskAfter.score).toBeGreaterThan(result.riskBefore.score)

    expect(result.addedShare).toBeCloseTo(1000 / newTotal, 12)

    // AAPL edges out NVDA before the top-up; NVDA overtakes it after.
    expect(result.largestBefore).toEqual({ symbol: 'AAPL', name: 'Apple', share: expect.any(Number) })
    expect(result.largestAfter).toEqual({ symbol: 'NVDA', name: 'NVIDIA', share: expect.any(Number) })

    expect(whatIfSentence(result, 'NVDA', 1000)).toBe(
      "Adding $1,000 of NVDA: NVDA would be about 20% of your money instead of 17% (counting your funds' top 10 holdings), and your risk score would go from 34 to 35 out of 100 (Moderate)."
    )
    // The band label is repeated on both sides only when it changes.
    const crossing = { ...result, riskAfter: { ...result.riskAfter, score: 68, label: 'Aggressive' as typeof result.riskAfter.label } }
    expect(whatIfSentence(crossing, 'NVDA', 1000)).toBe(
      "Adding $1,000 of NVDA: NVDA would be about 20% of your money instead of 17% (counting your funds' top 10 holdings), and your risk score would go from 34 (Moderate) to 68 (Aggressive) out of 100."
    )
  })

  it('adding $5,000 of a new symbol (ORCL, held nowhere) appends a row and starts exposure from 0', () => {
    const result = whatIf({ holdings, funds, symbol: 'ORCL', fund: ORCL_FUND, dollars: 5000, profile })

    expect(result.addable).toBe(true)
    expect(result.holdingsAfter.length).toBe(holdings.length + 1)
    expect(sumWeights(result.holdingsAfter)).toBeCloseTo(1, 12)

    const orcl = result.holdingsAfter.find(h => h.symbol === 'ORCL')
    expect(orcl).toBeDefined()
    expect(orcl!.name).toBe('Oracle Corp')
    expect(orcl!.type).toBe('equity')
    expect(orcl!.price).toBe(0)
    expect(orcl!.quantity).toBe(0)
    expect(orcl!.value).toBe(5000)
    const newTotal = totalValue + 5000
    expect(orcl!.weight).toBeCloseTo(5000 / newTotal, 12)

    expect(result.exposureBefore).toBe(0)
    expect(result.exposureAfter).toBeCloseTo(5000 / newTotal, 12)

    expect(whatIfSentence(result, 'ORCL', 5000)).toMatch(/^Adding \$5,000 of ORCL: ORCL would be about \d+% of your money instead of none we can see today \(counting your funds' top 10 holdings\), and your risk score would go from \d+ to \d+ out of 100 \(\w+\)\.$/)
  })

  it('a tiny first purchase reads "under 1%", never "0%"', () => {
    const result = whatIf({ holdings, funds, symbol: 'ORCL', fund: ORCL_FUND, dollars: 10, profile })
    expect(whatIfSentence(result, 'ORCL', 10)).toContain('ORCL would be under 1% of your money instead of none we can see today')
  })

  it('a stock-only account has nothing unseen, so a 0% start reads "owning no"', () => {
    const stocksOnly = holdings.filter(h => h.type !== 'etf')
    const result = whatIf({ holdings: stocksOnly, funds: {}, symbol: 'ORCL', fund: ORCL_FUND, dollars: 1000, profile })
    expect(result.holdsFunds).toBe(false)
    expect(whatIfSentence(result, 'ORCL', 1000)).toMatch(/ORCL would be about \d+% of your money instead of none today \(/)
    expect(whatIfSentence(result, 'ORCL', 1000)).not.toContain('we can see')
  })

  it('adding an ETF (more VOO) uses direct portfolio share, not a look-through company share', () => {
    const result = whatIf({ holdings, funds, symbol: 'VOO', fund: VOO, dollars: 2000, profile })

    expect(result.addable).toBe(true)
    const vooBefore = holdings.find(h => h.symbol === 'VOO')!
    const newTotal = totalValue + 2000
    // Direct share: VOO's own portfolio weight, not its (nonexistent) look-through company share.
    expect(result.exposureBefore).toBeCloseTo(vooBefore.weight, 12)
    expect(result.exposureAfter).toBeCloseTo((vooBefore.value + 2000) / newTotal, 12)

    // Growing the diversified ETF dilutes the single-name (AAPL/NVDA) concentration, since their
    // dollar values are unchanged but the portfolio total grew.
    expect(result.riskAfter.concentration).toBeLessThan(result.riskBefore.concentration)
  })

  it('an index (S&P 500 itself) is never addable, regardless of dollars', () => {
    const result = whatIf({ holdings, funds, symbol: '^GSPC', fund: SPX_FUND, dollars: 1000, profile })
    expect(result.addable).toBe(false)
    expect(result.holdingsAfter).toHaveLength(holdings.length)
    expect(result.riskAfter).toEqual(result.riskBefore)
    expect(result.exposureAfter).toBe(result.exposureBefore)
    expect(result.addedShare).toBe(0)
  })

  it('dollars <= 0 is never addable, even for an addable kind', () => {
    const zero = whatIf({ holdings, funds, symbol: 'NVDA', fund: NVDA_FUND, dollars: 0, profile })
    expect(zero.addable).toBe(false)
    expect(zero.addedShare).toBe(0)

    const negative = whatIf({ holdings, funds, symbol: 'NVDA', fund: NVDA_FUND, dollars: -500, profile })
    expect(negative.addable).toBe(false)
  })
})
