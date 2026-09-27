import { describe, expect, it } from 'vitest'
import type { Fund, Holding } from '../api/client'
import { actualMix, classify, drift, MIX_LABEL, MIX_ORDER, suggestTemplate, templateMix, type Mix, type Profile, type Template } from './targetMix'

// Inline copy of src/market/market/data/templates.json (all 5 entries) — see the brief for why:
// keeping the test self-contained rather than importing across the frontend/backend boundary.
const TEMPLATES: Template[] = [
  {
    id: 'sixty-forty',
    name: 'Classic 60/40',
    description: 'A traditional balanced portfolio: 60% total US stock market, 40% total US bond market.',
    allocations: [
      { asset: 'VTI', weight: 0.6 },
      { asset: 'BND', weight: 0.4 },
    ],
    source: 'https://www.bogleheads.org/wiki/Asset_allocation',
  },
  {
    id: 'three-fund',
    name: 'Bogleheads three-fund',
    description:
      'US stocks, international stocks and US bonds in one example weighting; the Bogleheads wiki treats the exact split as a matter of personal risk tolerance.',
    allocations: [
      { asset: 'VTI', weight: 0.5 },
      { asset: 'VXUS', weight: 0.3 },
      { asset: 'BND', weight: 0.2 },
    ],
    source: 'https://www.bogleheads.org/wiki/Three-fund_portfolio',
  },
  {
    id: 'all-weather',
    name: 'All Weather (Ray Dalio, popularized)',
    description:
      'A risk-balanced mix of stocks, long-term bonds, intermediate bonds, gold and commodities meant to hold up across growth and inflation regimes.',
    allocations: [
      { asset: 'VTI', weight: 0.3 },
      { asset: 'TLT', weight: 0.4 },
      { asset: 'IEI', weight: 0.15 },
      { asset: 'GLD', weight: 0.075 },
      { asset: 'DBC', weight: 0.075 },
    ],
    source: 'https://www.bridgewater.com/research-and-insights/the-all-weather-story',
  },
  {
    id: 'buffett-90-10',
    name: 'Buffett 90/10',
    description: "Warren Buffett's suggestion for his estate: 90% in a low-cost S&P 500 fund, 10% in short-term government bonds.",
    allocations: [
      { asset: 'VOO', weight: 0.9 },
      { asset: 'SHV', weight: 0.1 },
    ],
    source: 'https://www.berkshirehathaway.com/letters/2013ltr.pdf',
  },
  {
    id: 'target-date-2065',
    name: 'Target-date style (young investor)',
    description:
      'An approximate glide-path starting point for a decades-long horizon, weighted toward US and international stocks with a small bond allocation.',
    allocations: [
      { asset: 'VTI', weight: 0.54 },
      { asset: 'VXUS', weight: 0.36 },
      { asset: 'BND', weight: 0.07 },
      { asset: 'BNDX', weight: 0.03 },
    ],
    source: 'https://investor.vanguard.com/investment-products/mutual-funds/target-retirement-funds',
  },
]

const holding = (overrides: Partial<Holding>): Holding => ({
  symbol: 'TEST',
  name: 'Test holding',
  type: 'equity',
  quantity: 1,
  price: 1,
  value: 1,
  weight: 1,
  ...overrides,
})

const fund = (overrides: Partial<Fund>): Fund => ({
  symbol: 'TEST',
  name: 'Test fund',
  kind: 'etf',
  isIndexFund: false,
  leveraged: false,
  tracks: null,
  expenseRatio: null,
  topHoldings: [],
  fundFamily: null,
  category: null,
  sector: null,
  summary: '',
  summarySource: 'template',
  asOf: '2026-01-01',
  stale: false,
  ...overrides,
})

describe('MIX_ORDER / MIX_LABEL', () => {
  it('is stocks, bonds, cash, other with matching labels', () => {
    expect(MIX_ORDER).toEqual(['stocks', 'bonds', 'cash', 'other'])
    expect(MIX_LABEL).toEqual({ stocks: 'Stocks', bonds: 'Bonds', cash: 'Cash', other: 'Other' })
  })
})

describe('classify', () => {
  it('maps cash to cash', () => {
    expect(classify(holding({ type: 'cash' }))).toBe('cash')
  })

  it('maps fixed income to bonds', () => {
    expect(classify(holding({ type: 'fixed income' }))).toBe('bonds')
  })

  it('maps equity, cryptocurrency and derivative to stocks (risk assets, kept simple)', () => {
    expect(classify(holding({ type: 'equity' }))).toBe('stocks')
    expect(classify(holding({ type: 'cryptocurrency' }))).toBe('stocks')
    expect(classify(holding({ type: 'derivative' }))).toBe('stocks')
  })

  it('maps other to other', () => {
    expect(classify(holding({ type: 'other' }))).toBe('other')
  })

  it('an etf with no fund loaded is assumed to be a stock fund', () => {
    expect(classify(holding({ type: 'etf' }))).toBe('stocks')
    expect(classify(holding({ type: 'etf' }), null)).toBe('stocks')
    expect(classify(holding({ type: 'etf' }), undefined)).toBe('stocks')
  })

  it('an etf whose fund category looks like bonds classifies as bonds', () => {
    expect(classify(holding({ type: 'etf' }), fund({ category: 'Intermediate-Term Bond' }))).toBe('bonds')
    expect(classify(holding({ type: 'etf' }), fund({ category: 'Long Government Treasury' }))).toBe('bonds')
    expect(classify(holding({ type: 'etf' }), fund({ category: 'Fixed Income' }))).toBe('bonds')
    expect(classify(holding({ type: 'etf' }), fund({ category: 'High Income' }))).toBe('bonds')
  })

  it('an etf whose fund category looks like a money market fund classifies as cash', () => {
    expect(classify(holding({ type: 'etf' }), fund({ category: 'Money Market' }))).toBe('cash')
    expect(classify(holding({ type: 'etf' }), fund({ category: 'Prime Cash' }))).toBe('cash')
  })

  it('an etf whose fund category looks like gold, real estate or commodities classifies as other', () => {
    expect(classify(holding({ type: 'etf' }), fund({ category: 'Gold' }))).toBe('other')
    expect(classify(holding({ type: 'etf' }), fund({ category: 'Commodities Broad Basket' }))).toBe('other')
    expect(classify(holding({ type: 'etf' }), fund({ category: 'Real Estate' }))).toBe('other')
    expect(classify(holding({ type: 'etf' }), fund({ category: 'Equity Real Estate (REIT)' }))).toBe('other')
  })

  it('an etf with an equity fund category classifies as stocks', () => {
    expect(classify(holding({ type: 'etf' }), fund({ category: 'Large Blend' }))).toBe('stocks')
  })

  it('a mutual fund follows the same category rules as an etf', () => {
    expect(classify(holding({ type: 'mutual fund' }), fund({ category: 'Short-Term Bond' }))).toBe('bonds')
    expect(classify(holding({ type: 'mutual fund' }))).toBe('stocks')
  })

  it('a null fund category with a fund present falls through to stocks', () => {
    expect(classify(holding({ type: 'etf' }), fund({ category: null }))).toBe('stocks')
  })
})

describe('actualMix', () => {
  it('is long-only, by value, on the sample account', () => {
    // VOO/QQQ/VGT stock ETFs, AAPL/NVDA equity, $1,500 cash.
    const holdings: Holding[] = [
      holding({ symbol: 'VOO', type: 'etf', value: 10661.85 }),
      holding({ symbol: 'QQQ', type: 'etf', value: 4467 }),
      holding({ symbol: 'VGT', type: 'etf', value: 1009.36 }),
      holding({ symbol: 'AAPL', type: 'equity', value: 3410.7 }),
      holding({ symbol: 'NVDA', type: 'equity', value: 2700.84 }),
      holding({ symbol: 'CASH', type: 'cash', value: 1500 }),
    ]
    const funds: Record<string, Fund | undefined> = {
      VOO: fund({ symbol: 'VOO', category: 'Large Blend' }),
      QQQ: fund({ symbol: 'QQQ', category: 'Large Growth' }),
      VGT: fund({ symbol: 'VGT', category: 'Technology' }),
    }
    const mix = actualMix(holdings, funds)
    expect(mix.stocks).toBeCloseTo(0.9368, 3)
    expect(mix.cash).toBeCloseTo(0.0632, 3)
    expect(mix.bonds).toBe(0)
    expect(mix.other).toBe(0)
    expect(mix.stocks + mix.bonds + mix.cash + mix.other).toBeCloseTo(1, 10)
  })

  it('drops non-positive-value holdings (long-only)', () => {
    const holdings: Holding[] = [
      holding({ symbol: 'CASH', type: 'cash', value: 100 }),
      holding({ symbol: 'SHORT', type: 'equity', value: -50 }),
      holding({ symbol: 'ZERO', type: 'equity', value: 0 }),
    ]
    expect(actualMix(holdings, {})).toEqual({ stocks: 0, bonds: 0, cash: 1, other: 0 })
  })

  it('an empty account is all zeros', () => {
    expect(actualMix([], {})).toEqual({ stocks: 0, bonds: 0, cash: 0, other: 0 })
  })
})

describe('templateMix', () => {
  const cases: Array<[string, Mix]> = [
    ['sixty-forty', { stocks: 0.6, bonds: 0.4, cash: 0, other: 0 }],
    ['three-fund', { stocks: 0.8, bonds: 0.2, cash: 0, other: 0 }],
    ['all-weather', { stocks: 0.3, bonds: 0.55, cash: 0, other: 0.15 }],
    ['buffett-90-10', { stocks: 0.9, bonds: 0, cash: 0.1, other: 0 }],
    ['target-date-2065', { stocks: 0.9, bonds: 0.1, cash: 0, other: 0 }],
  ]

  it.each(cases)('%s classifies every ticker and normalizes to sum 1', (id, expected) => {
    const template = TEMPLATES.find((t) => t.id === id)
    if (!template) throw new Error(`missing fixture template ${id}`)
    const mix = templateMix(template)
    expect(mix.stocks).toBeCloseTo(expected.stocks, 6)
    expect(mix.bonds).toBeCloseTo(expected.bonds, 6)
    expect(mix.cash).toBeCloseTo(expected.cash, 6)
    expect(mix.other).toBeCloseTo(expected.other, 6)
    expect(mix.stocks + mix.bonds + mix.cash + mix.other).toBeCloseTo(1, 10)
  })

  it('an unknown ticker classifies as other', () => {
    const template: Template = {
      id: 'unknown-ticker',
      name: 'Unknown',
      description: '',
      allocations: [
        { asset: 'VTI', weight: 0.5 },
        { asset: 'ZZZZ', weight: 0.5 },
      ],
    }
    expect(templateMix(template)).toEqual({ stocks: 0.5, bonds: 0, cash: 0, other: 0.5 })
  })
})

const profile = (overrides: Partial<Profile>): Profile => ({
  age: 40,
  horizon: 'medium',
  goals: [],
  riskTolerance: 'medium',
  ...overrides,
})

describe('suggestTemplate', () => {
  it('no profile suggests three-fund', () => {
    expect(suggestTemplate(null)).toBe('three-fund')
    expect(suggestTemplate(undefined)).toBe('three-fund')
  })

  it('low risk tolerance suggests sixty-forty', () => {
    expect(suggestTemplate(profile({ riskTolerance: 'low', horizon: 'long' }))).toBe('sixty-forty')
  })

  it('short horizon suggests sixty-forty', () => {
    expect(suggestTemplate(profile({ riskTolerance: 'high', horizon: 'short' }))).toBe('sixty-forty')
  })

  it('high risk tolerance and long horizon suggests buffett-90-10', () => {
    expect(suggestTemplate(profile({ riskTolerance: 'high', horizon: 'long', age: 50 }))).toBe('buffett-90-10')
  })

  it('long horizon and age under 30 suggests target-date-2065', () => {
    expect(suggestTemplate(profile({ riskTolerance: 'medium', horizon: 'long', age: 25 }))).toBe('target-date-2065')
  })

  it('medium risk tolerance suggests three-fund', () => {
    expect(suggestTemplate(profile({ riskTolerance: 'medium', horizon: 'long', age: 45 }))).toBe('three-fund')
  })

  it('medium horizon suggests three-fund', () => {
    expect(suggestTemplate(profile({ riskTolerance: 'high', horizon: 'medium', age: 45 }))).toBe('three-fund')
  })

  it('anything else falls back to three-fund', () => {
    expect(suggestTemplate(profile({ riskTolerance: 'medium', horizon: 'medium', age: 45 }))).toBe('three-fund')
  })

  it('evaluates in order — low risk tolerance beats high-risk-and-long (precedence)', () => {
    expect(suggestTemplate(profile({ riskTolerance: 'low', horizon: 'long', age: 20 }))).toBe('sixty-forty')
  })
})

describe('drift', () => {
  it('sample account vs sixty-forty: the biggest gap is the missing 40 points of bonds', () => {
    // Same sample account as the actualMix test: stocks ≈ 0.9368, cash ≈ 0.0632, bonds/other 0.
    const actual: Mix = { stocks: 0.9368421052631579, bonds: 0, cash: 0.06315789473684211, other: 0 }
    const target: Mix = { stocks: 0.6, bonds: 0.4, cash: 0, other: 0 }
    const result = drift(actual, target, 'Classic 60/40')
    // gaps: stocks +34, bonds -40, cash +6, other 0 — bonds has the largest |gap|, not stocks.
    expect(result.gaps).toEqual({ stocks: 34, bonds: -40, cash: 6, other: 0 })
    expect(result.largest).toBe('bonds')
    expect(result.sentence).toBe('40 points less in bonds than the Classic 60/40 plan; nothing in bonds.')
  })

  it('a close mix (all gaps under 3 points) reads as close, with no largest', () => {
    const actual: Mix = { stocks: 0.61, bonds: 0.39, cash: 0, other: 0 }
    const target: Mix = { stocks: 0.6, bonds: 0.4, cash: 0, other: 0 }
    const result = drift(actual, target, 'Classic 60/40')
    expect(result.gaps).toEqual({ stocks: 1, bonds: -1, cash: 0, other: 0 })
    expect(result.largest).toBeNull()
    expect(result.sentence).toBe('Your mix is close to the Classic 60/40 plan.')
  })

  it('an overweight case leads with "more", no nothing-in clause when other classes are non-zero', () => {
    const actual: Mix = { stocks: 0.8, bonds: 0.1, cash: 0.1, other: 0 }
    const target: Mix = { stocks: 0.5, bonds: 0.3, cash: 0.2, other: 0 }
    const result = drift(actual, target, 'Bogleheads three-fund')
    expect(result.gaps).toEqual({ stocks: 30, bonds: -20, cash: -10, other: 0 })
    expect(result.largest).toBe('stocks')
    expect(result.sentence).toBe('30 points more in stocks than the Bogleheads three-fund plan.')
  })

  it('an underweight case leads with "less"', () => {
    const actual: Mix = { stocks: 0.5, bonds: 0.3, cash: 0.2, other: 0 }
    const target: Mix = { stocks: 0.7, bonds: 0.2, cash: 0.1, other: 0 }
    const result = drift(actual, target, 'Bogleheads three-fund')
    expect(result.gaps).toEqual({ stocks: -20, bonds: 10, cash: 10, other: 0 })
    expect(result.largest).toBe('stocks')
    expect(result.sentence).toBe('20 points less in stocks than the Bogleheads three-fund plan.')
  })

  it('appends nothing-in-cash when cash is zero and the target wants at least 10%', () => {
    const actual: Mix = { stocks: 0.85, bonds: 0.15, cash: 0, other: 0 }
    const target: Mix = { stocks: 0.7, bonds: 0.15, cash: 0.15, other: 0 }
    const result = drift(actual, target, 'Model X')
    expect(result.largest).toBe('stocks')
    expect(result.sentence).toBe('15 points more in stocks than the Model X plan; nothing in cash.')
  })

  it('does not append nothing-in-bonds/cash when the target itself wants under 10% there', () => {
    const actual: Mix = { stocks: 0.95, bonds: 0, cash: 0, other: 0.05 }
    const target: Mix = { stocks: 0.9, bonds: 0.05, cash: 0.05, other: 0 }
    const result = drift(actual, target, 'Model X')
    expect(result.sentence).not.toContain('nothing in')
  })
})
