import { describe, expect, it } from 'vitest'
import type { Exposure, FundFees } from './lookThrough'
import {
  advisorMixHref,
  coverageCaption,
  feeCopy,
  fundsCheckedCaption,
  joinList,
  mixLead,
  ownershipHeadline,
  topCompaniesLine,
  viaLine,
  wholePercent,
} from './xrayCopy'

const apple: Exposure = {
  symbol: 'AAPL',
  name: 'Apple',
  share: 0.1932,
  direct: 0.1436,
  via: [
    { fund: 'VOO', share: 0.0316 },
    { fund: 'QQQ', share: 0.0151 },
    { fund: 'VGT', share: 0.0029 },
  ],
}

describe('wholePercent', () => {
  it('rounds a fraction to a whole percent', () => {
    expect(wholePercent(0.1932)).toBe('19%')
    expect(wholePercent(0.005)).toBe('1%')
  })
  it('reads "under 1%" for a positive sliver, never "0%"', () => {
    expect(wholePercent(0.004)).toBe('under 1%')
    expect(wholePercent(0)).toBe('0%')
  })
})

describe('joinList', () => {
  it('joins with commas and a final "and", no serial comma', () => {
    expect(joinList([])).toBe('')
    expect(joinList(['VOO'])).toBe('VOO')
    expect(joinList(['VOO', 'QQQ'])).toBe('VOO and QQQ')
    expect(joinList(['VOO', 'QQQ', 'VGT'])).toBe('VOO, QQQ and VGT')
  })
})

describe('ownershipHeadline', () => {
  it('splits direct from inside funds, with parts that add up to the total', () => {
    expect(ownershipHeadline(apple)).toBe('Apple is about 19% of your money: 14% directly, 5% inside VOO, QQQ and VGT.')
  })

  it('keeps the parts summing to the rounded total when each part would round up', () => {
    const c = { ...apple, share: 0.198, direct: 0.146, via: [{ fund: 'VOO', share: 0.052 }] }
    // 14.6 → 15 and 5.2 → 5 sum to 20, the rounded total.
    expect(ownershipHeadline(c)).toBe('Apple is about 20% of your money: 15% directly, 5% inside VOO.')
  })

  it('says "all of it inside" when nothing is held directly', () => {
    const c: Exposure = { symbol: 'MSFT', name: 'Microsoft', share: 0.041, direct: 0, via: [{ fund: 'VOO', share: 0.03 }, { fund: 'QQQ', share: 0.011 }] }
    expect(ownershipHeadline(c)).toBe('Microsoft is about 4% of your money, all of it inside VOO and QQQ.')
  })

  it('says "all of it held directly" when no fund holds it', () => {
    const c: Exposure = { symbol: 'NVDA', name: 'NVIDIA', share: 0.114, direct: 0.114, via: [] }
    expect(ownershipHeadline(c)).toBe('NVIDIA is about 11% of your money, all of it held directly.')
  })

  it('reads "under 1%" for tiny shares and parts', () => {
    const tiny: Exposure = { symbol: 'X', name: 'Tiny', share: 0.003, direct: 0, via: [{ fund: 'VOO', share: 0.003 }] }
    expect(ownershipHeadline(tiny)).toBe('Tiny is under 1% of your money, all of it inside VOO.')
    const sliver = { ...apple, share: 0.142, direct: 0.14, via: [{ fund: 'VOO', share: 0.002 }] }
    expect(ownershipHeadline(sliver)).toBe('Apple is about 14% of your money: 14% directly, under 1% inside VOO.')
  })

  it('never says "all of it held directly" while funds are unopened', () => {
    const c: Exposure = { symbol: 'AAPL', name: 'Apple', share: 0.144, direct: 0.144, via: [] }
    expect(ownershipHeadline(c, { unopened: 3 })).toBe("Apple is about 14% of your money, held directly (we couldn't look inside 3 of your funds).")
    expect(ownershipHeadline(c, { unopened: 1, checking: true })).toBe('Apple is about 14% of your money, held directly (still looking inside 1 of your funds).')
    expect(ownershipHeadline(c, { unopened: 0 })).toBe('Apple is about 14% of your money, all of it held directly.')
  })

  it('falls back to the symbol when the name is empty', () => {
    expect(ownershipHeadline({ ...apple, name: '' })).toMatch(/^AAPL is about 19%/)
  })
})

describe('viaLine', () => {
  it('lists direct first, then each fund, and drops parts under half a percent', () => {
    expect(viaLine(apple)).toBe('14% direct · VOO 3% · QQQ 2%')
  })
  it('omits the direct part when nothing is held directly', () => {
    expect(viaLine({ ...apple, direct: 0 })).toBe('VOO 3% · QQQ 2%')
  })
  it('is empty when every part is a sliver', () => {
    expect(viaLine({ ...apple, direct: 0.001, via: [{ fund: 'VOO', share: 0.004 }] })).toBe('')
  })
})

describe('topCompaniesLine', () => {
  const lt = (shares: number[]) => ({
    companies: shares.map((share, i) => ({ symbol: `S${i}`, name: `S${i}`, share, direct: share, via: [] })),
    topShare: (n: number) => shares.slice(0, n).reduce((a, b) => a + b, 0),
  })
  it('counts the top seven', () => {
    expect(topCompaniesLine(lt([0.2, 0.1, 0.05, 0.05, 0.04, 0.03, 0.03, 0.01]))).toBe('Your top 7 companies are 50% of everything.')
  })
  it('uses fewer when fewer exist, and nothing for a single company', () => {
    expect(topCompaniesLine(lt([0.3, 0.2, 0.1]))).toBe('Your top 3 companies are 60% of everything.')
    expect(topCompaniesLine(lt([0.3]))).toBeNull()
  })
})

describe('coverageCaption', () => {
  it('says how many funds were looked inside and when', () => {
    expect(coverageCaption({ checked: 3, total: 3, coverage: 0.6, asOf: 'Sep 26, 2026' }))
      .toBe("Counting each fund's top 10 holdings (3 of 3 funds checked) · as of Sep 26, 2026")
  })
  it('warns when most of the fund money is outside the top 10', () => {
    expect(coverageCaption({ checked: 2, total: 3, coverage: 0.42, asOf: 'Sep 26, 2026' }))
      .toBe("Counting each fund's top 10 holdings (2 of 3 funds checked) · as of Sep 26, 2026 · funds' smaller holdings aren't counted")
  })
  it('drops the fund clause when there are no funds', () => {
    expect(coverageCaption({ checked: 0, total: 0, coverage: 0, asOf: 'Sep 26, 2026' })).toBe('Based on your holdings as of Sep 26, 2026')
  })
})

const fees = (over: Partial<FundFees> = {}): FundFees => ({
  rows: [
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', ratio: 0.002, dollars: 8.93 },
    { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', ratio: 0.0003, dollars: 3.2 },
    { symbol: 'VGT', name: 'Vanguard Information Technology ETF', ratio: 0.0009, dollars: 0.91 },
  ],
  unknown: [],
  fundValue: 16138.21,
  perYear: 13.04,
  blendedRatio: 13.04 / 16138.21,
  cheapestRatio: 0.0003,
  ifAllCheapest: 4.84,
  tenYear: 130.4,
  ...over,
})

describe('feeCopy', () => {
  it('says the yearly cost, ten years, and the cheapest-fund what-if', () => {
    expect(feeCopy(fees(), false)).toEqual({
      cost: 'Your funds cost about $13 a year (0.08% of the money in them).',
      tenYear: "At the same balance that's about $130 over 10 years.",
      cheapest: 'If every fund cost what your cheapest one does (0.03%), it would be about $5 a year.',
      unknown: null,
      notChecked: null,
    })
  })

  it('skips the what-if when it saves under $1', () => {
    expect(feeCopy(fees({ perYear: 5.5, ifAllCheapest: 4.84 }), false)!.cheapest).toBeNull()
  })

  it('hides every dollar figure but keeps the percents', () => {
    const copy = feeCopy(fees(), true)!
    expect(copy.cost).toBe('Your funds cost about 0.08% of the money in them each year.')
    expect(copy.tenYear).toBeNull()
    expect(copy.cheapest).toBe('If every fund cost what your cheapest one does (0.03%), you would pay less each year.')
    expect(Object.values(copy).join(' ')).not.toContain('$')
  })

  it('names funds with no fee data, and says whose cost the sentence covers', () => {
    const copy = feeCopy(fees({ unknown: ['ABCX', 'DEFX'] }), false)!
    expect(copy.unknown).toBe('Fee not available: ABCX, DEFX')
    expect(copy.notChecked).toBeNull()
    expect(copy.cost).toMatch(/^The funds we could check cost about \$13 a year/)
  })

  it('separates never-requested funds ("Not checked") from ones that loaded without a fee or failed', () => {
    const copy = feeCopy(fees({ unknown: ['ABCX', 'NINTH'] }), false, { notChecked: ['ninth'] })!
    expect(copy.unknown).toBe('Fee not available: ABCX')
    expect(copy.notChecked).toBe('Not checked: NINTH')
    const onlySkipped = feeCopy(fees({ unknown: ['NINTH'] }), true, { notChecked: ['NINTH'] })!
    expect(onlySkipped.unknown).toBeNull()
    expect(onlySkipped.notChecked).toBe('Not checked: NINTH')
    expect(onlySkipped.cost).toMatch(/^The funds we could check cost about 0\.08%/)
  })

  it('reads "under $1" for a tiny cost and "no yearly fee" at zero', () => {
    expect(feeCopy(fees({ perYear: 0.3, tenYear: 3, ifAllCheapest: 0.3 }), false)!.cost).toMatch(/^Your funds cost under \$1 a year/)
    expect(feeCopy(fees({ perYear: 0, tenYear: 0, blendedRatio: 0, cheapestRatio: 0, ifAllCheapest: 0 }), false))
      .toMatchObject({ cost: 'Your funds charge no yearly fee.', tenYear: null, cheapest: null })
  })

  it('says fees are unavailable when no fund has a ratio, and nothing when there are no funds', () => {
    const none = fees({ rows: [], unknown: ['ABCX'], fundValue: 0, perYear: 0, blendedRatio: null, cheapestRatio: null, ifAllCheapest: null, tenYear: 0 })
    expect(feeCopy(none, false)).toEqual({ cost: "Fee information isn't available for your funds.", tenYear: null, cheapest: null, unknown: 'Fee not available: ABCX', notChecked: null })
    expect(feeCopy({ ...none, unknown: [] }, false)).toBeNull()
  })
})

describe('mixLead and advisorMixHref', () => {
  it('gives the drift sentence a subject', () => {
    expect(mixLead('34 points more in stocks than the Classic 60/40 plan; nothing in bonds.'))
      .toBe('Your mix is 34 points more in stocks than the Classic 60/40 plan; nothing in bonds.')
    expect(mixLead('Your mix is close to the Classic 60/40 plan.')).toBe('Your mix is close to the Classic 60/40 plan.')
    expect(mixLead('Nothing in bonds, where the Classic 60/40 plan keeps 40%; 34 points more in stocks.'))
      .toBe('Nothing in bonds, where the Classic 60/40 plan keeps 40%; 34 points more in stocks.')
  })

  it('prefills the advisor question in the first person', () => {
    const href = advisorMixHref('34 points more in stocks than the Classic 60/40 plan; nothing in bonds.')
    expect(href.startsWith('/advisor?q=')).toBe(true)
    expect(decodeURIComponent(href.slice('/advisor?q='.length)))
      .toBe('My mix is 34 points more in stocks than the Classic 60/40 plan; nothing in bonds. What should a beginner understand about that?')
    expect(decodeURIComponent(advisorMixHref('Your mix is close to the Classic 60/40 plan.').slice(11)))
      .toBe('My mix is close to the Classic 60/40 plan. What should a beginner understand about that?')
    expect(decodeURIComponent(advisorMixHref('Nothing in bonds, where the Classic 60/40 plan keeps 40%; 34 points more in stocks.').slice(11)))
      .toBe('My mix has nothing in bonds, where the Classic 60/40 plan keeps 40%; 34 points more in stocks. What should a beginner understand about that?')
  })
})

describe('fundsCheckedCaption', () => {
  it('is silent when every fund is checked, or there are none', () => {
    expect(fundsCheckedCaption({ loaded: 3, total: 3, pending: false })).toBeNull()
    expect(fundsCheckedCaption({ loaded: 0, total: 0, pending: false })).toBeNull()
  })
  it('counts and says the assumption while funds are missing', () => {
    expect(fundsCheckedCaption({ loaded: 1, total: 3, pending: true })).toBe('1 of 3 funds checked · assumes unchecked funds hold stocks')
    expect(fundsCheckedCaption({ loaded: 2, total: 3, pending: false })).toBe('2 of 3 funds checked · assumes unchecked funds hold stocks')
  })
})
