import { describe, expect, it } from 'vitest'
import type { Fund } from '../api/client'
import { AAPL, BND, BTC, SPX, TOP_TEN, TQQQ, VFIAX, VOO } from './fundExplainer.fixtures'
import {
  CRYPTO_WHY, FEE_UNAVAILABLE, LEVERAGED_WHY, NO_FEE, advisorHref, centsLabel, companyPair, dollarStrip, everyDollar, expenseRatioLabel, feePerTenThousand,
  feeSentence, firstSentence, holdingsOverlap, isExplainOpen, isFund, kindLabel, learnTopics, plainCategory, plainSector,
  realDifference, shortName, withExplain,
} from './fundExplainer'

describe('kindLabel', () => {
  it.each([
    ['etf', true, 'Index fund (ETF)'],
    ['etf', false, 'ETF'],
    ['mutual_fund', true, 'Index fund (mutual fund)'],
    ['mutual_fund', false, 'Mutual fund'],
    ['stock', false, 'Company stock'],
    ['other', false, 'Investment'],
    ['index', false, 'Stock market index'],
    ['crypto', false, 'Cryptocurrency'],
  ] as const)('%s with isIndexFund=%s reads "%s"', (kind, isIndexFund, label) => {
    expect(kindLabel({ kind, isIndexFund, leveraged: false })).toBe(label)
  })

  it('ignores isIndexFund for a stock and reads an unknown kind as an investment', () => {
    expect(kindLabel({ kind: 'stock', isIndexFund: true, leveraged: false })).toBe('Company stock')
    expect(kindLabel({ kind: 'warrant' as Fund['kind'], isIndexFund: true, leveraged: false })).toBe('Investment')
  })

  it('a leveraged ETF is never an index fund, even when it tracks one', () => {
    expect(kindLabel(TQQQ)).toBe('Leveraged ETF · high risk')
    expect(kindLabel({ ...TQQQ, kind: 'mutual_fund' })).toBe('Leveraged fund · high risk')
  })

  it('treats only ETFs and mutual funds as funds', () => {
    expect(['etf', 'mutual_fund', 'stock', 'index', 'crypto', 'other'].map(isFund)).toEqual([true, true, false, false, false, false])
  })
})

describe('cents of every $1', () => {
  it('rounds to whole cents and shows <1¢ for small weights', () => {
    expect(centsLabel(0.071)).toBe('7¢')
    expect(centsLabel(0.004)).toBe('<1¢')
    expect(centsLabel(0.005)).toBe('1¢')
    expect(centsLabel(0.08082)).toBe('8¢')
  })

  it('never shows a negative or NaN cent', () => {
    expect(centsLabel(-0.2)).toBe('<1¢')
    expect(centsLabel(Number.NaN)).toBe('<1¢')
  })

  it('names the top three, shortened, then "+ hundreds more" for an index fund', () => {
    expect(everyDollar(TOP_TEN, true)).toEqual({
      top: [{ name: 'NVIDIA', cents: '8¢' }, { name: 'Apple', cents: '7¢' }, { name: 'Microsoft', cents: '6¢' }],
      more: '+ hundreds more',
    })
  })

  it('says "+ more" for other funds, and nothing when the named holdings are the whole $1', () => {
    expect(everyDollar(TOP_TEN, false).more).toBe('+ more')
    expect(everyDollar([{ symbol: 'A', name: 'A', weight: 0.6 }, { symbol: 'B', name: 'B', weight: 0.4 }], true).more).toBeNull()
    expect(everyDollar([], true).more).toBeNull()
  })

  it('sorts by weight even if the provider does not', () => {
    expect(everyDollar([...TOP_TEN].reverse(), true).top[0]).toEqual({ name: 'NVIDIA', cents: '8¢' })
  })
})

describe('dollarStrip', () => {
  it('leaves the unnamed remainder as "everything else" when weights sum below 1', () => {
    const { slices, remainder } = dollarStrip(TOP_TEN)
    expect(slices).toHaveLength(10)
    const named = TOP_TEN.reduce((sum, h) => sum + h.weight, 0)
    expect(remainder).toBeCloseTo(1 - named, 6)
    expect(remainder).toBeGreaterThan(0.6)
  })

  it('scales weights that sum past 1 so the strip is exactly $1 with no remainder', () => {
    const { slices, remainder } = dollarStrip([{ symbol: 'A', name: 'A', weight: 0.9 }, { symbol: 'B', name: 'B', weight: 0.6 }])
    expect(remainder).toBe(0)
    expect(slices.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 9)
    expect(slices[0]?.share).toBeCloseTo(0.6, 9)
  })

  it('drops zero, negative and non-finite weights and keeps at most 10', () => {
    const noisy = [...TOP_TEN, { symbol: 'X', name: 'X', weight: 0.001 }, { symbol: 'Z', name: 'Zero', weight: 0 }, { symbol: 'N', name: 'NaN', weight: Number.NaN }, { symbol: 'M', name: 'Minus', weight: -0.1 }]
    const { slices } = dollarStrip(noisy)
    expect(slices).toHaveLength(10)
    expect(slices.map(s => s.symbol)).not.toContain('X')
  })

  it('is empty for a stock', () => {
    expect(dollarStrip(AAPL.topHoldings)).toEqual({ slices: [], remainder: 1 })
  })
})

describe('shortName', () => {
  it('drops corporate suffixes but keeps share classes', () => {
    expect(shortName('Apple Inc')).toBe('Apple')
    expect(shortName('NVIDIA Corp')).toBe('NVIDIA')
    expect(shortName('Taiwan Semiconductor Manufacturing Co Ltd')).toBe('Taiwan Semiconductor Manufacturing Co')
    expect(shortName('Alphabet Inc Class A')).toBe('Alphabet Inc Class A')
    expect(shortName('Inc')).toBe('Inc')
  })
})

describe('fee translation', () => {
  it('turns the expense ratio into dollars a year on $10,000', () => {
    expect(feePerTenThousand(0.0003)).toBe('$3')
    expect(feePerTenThousand(0.0004)).toBe('$4')
    expect(feePerTenThousand(0.00003)).toBe('under $1')
    expect(feePerTenThousand(0.0125)).toBe('$125')
    expect(feePerTenThousand(0)).toBe(NO_FEE)
    expect(NO_FEE).toBe('No yearly fee')
    expect(feePerTenThousand(null)).toBeNull()
    expect(feePerTenThousand(-0.001)).toBeNull()
  })

  it('writes the sentence and the unavailable copy', () => {
    expect(feeSentence(0.0003)).toBe('About $3 a year on every $10,000 invested')
    expect(feeSentence(0.00003)).toBe('Under $1 a year on every $10,000 invested')
    expect(feeSentence(null)).toBe(FEE_UNAVAILABLE)
    expect(feeSentence(0)).toBe('No yearly fee')
    expect(FEE_UNAVAILABLE).toBe("Fee information isn't available.")
  })

  it('labels the expense ratio as a percent without trailing zeros', () => {
    expect(expenseRatioLabel(0.0003)).toBe('0.03%')
    expect(expenseRatioLabel(0.00003)).toBe('0.003%')
    expect(expenseRatioLabel(0.005)).toBe('0.5%')
    expect(expenseRatioLabel(null)).toBeNull()
  })
})

describe('firstSentence', () => {
  it('keeps the first sentence and does not split on U.S. or Inc.', () => {
    expect(firstSentence(VOO.summary)).toBe('VOO is a fund that owns shares of about 500 of the biggest U.S. companies.')
    expect(firstSentence('It holds U.S. Treasury bonds. They pay interest.')).toBe('It holds U.S. Treasury bonds.')
    expect(firstSentence('One sentence only')).toBe('One sentence only')
  })
})

describe('plain-word maps', () => {
  it('translates known categories and skips unknown ones', () => {
    expect(plainCategory('Large Blend')).toBe('big U.S. companies, a mix of fast-growing and steady ones')
    expect(plainCategory('Large Growth')).toBe('big U.S. companies expected to grow fast')
    expect(plainCategory('Large Value')).toBe('big, established U.S. companies that look inexpensive')
    expect(plainCategory('Mid-Cap Blend')).toBe(plainCategory('Mid Blend'))
    expect(plainCategory('Small Value')).toBe('small, established U.S. companies that look inexpensive')
    expect(plainCategory('Foreign Large Blend')).toBe('big companies outside the U.S.')
    expect(plainCategory('Intermediate Core Bond')).toBe('loans to governments and companies (bonds)')
    expect(plainCategory('technology')).toBe('technology companies only')
    expect(plainCategory('Nontraditional Bond')).toBeNull()
    expect(plainCategory(null)).toBeNull()
  })

  it('covers every Mid and Small style', () => {
    for (const size of ['Mid-Cap', 'Small']) for (const style of ['Blend', 'Growth', 'Value']) expect(plainCategory(`${size} ${style}`)).not.toBeNull()
  })

  it('translates stock sectors', () => {
    expect(plainSector('Technology')).toBe('technology')
    expect(plainSector('Financial Services')).toBe('banking and finance')
    expect(plainSector('Space Mining')).toBeNull()
  })
})

describe('learnTopics', () => {
  it('gives an index ETF every chip, in order, ending with the fund-type comparison', () => {
    const topics = learnTopics(VOO)
    expect(topics.map(t => t.label)).toEqual(['Who runs it?', 'Where is the money?', 'Why own it?', 'How do I buy it?', 'ETF or mutual fund?'])
    expect(topics[0]?.answer).toBe('Vanguard runs it. For an index fund, they don’t pick stocks; they copy a list (the index).')
    expect(topics[1]?.answer).toBe('Your money goes into big U.S. companies, a mix of fast-growing and steady ones.')
    expect(topics[3]?.answer).toBe('Through any brokerage app, like a stock, any time the market is open.')
  })

  it('keeps every answer to two sentences at most', () => {
    for (const fund of [VOO, VFIAX, AAPL, { ...VOO, isIndexFund: false }]) {
      for (const topic of learnTopics(fund)) expect(topic.answer.split(/(?<=[.!?])\s+(?=[A-Z])/).length).toBeLessThanOrEqual(2)
    }
  })

  it('explains buying a mutual fund differently', () => {
    expect(learnTopics(VFIAX).find(t => t.id === 'how')?.answer).toBe('Usually through the fund company; your order fills once a day after the market closes.')
  })

  it('skips "Who runs it?" without a fund family and "Where is the money?" for an unknown category', () => {
    const ids = learnTopics({ ...VOO, fundFamily: null, category: 'Nontraditional Bond' }).map(t => t.id)
    expect(ids).toEqual(['why', 'how', 'compare'])
  })

  it('gives a stock its sector, the single-business why and how to buy, but no fund comparison', () => {
    const topics = learnTopics(AAPL)
    expect(topics.map(t => t.id)).toEqual(['where', 'why', 'how'])
    expect(topics[0]?.answer).toBe('All of it is in one company that works in technology.')
    expect(topics[1]?.answer).toBe('You’re betting on one business; it can grow a lot or fall a lot.')
  })

  it('gives "other" and an index nothing to guess about', () => {
    expect(learnTopics({ ...AAPL, kind: 'other', sector: 'Technology' })).toEqual([])
    expect(learnTopics(SPX)).toEqual([])
  })

  it('crypto gets only the why', () => {
    expect(learnTopics(BTC)).toEqual([{ id: 'why', label: 'Why own it?', answer: CRYPTO_WHY }])
    expect(CRYPTO_WHY).toBe('No company or earnings are behind it, so prices can swing a lot.')
  })

  it('a leveraged ETF never gets the index-fund story', () => {
    const topics = learnTopics(TQQQ)
    expect(topics.find(t => t.id === 'why')?.answer).toBe(LEVERAGED_WHY)
    expect(LEVERAGED_WHY).toBe('It borrows to multiply daily moves, so losses can grow fast; it’s built for short-term traders, not long-term saving.')
    const text = topics.map(t => t.answer).join(' ')
    expect(text).not.toMatch(/can’t sink you|fees stay low|copy a list/)
    expect(topics.find(t => t.id === 'compare')?.answer).toBe('TQQQ is a leveraged ETF: it trades like an ETF, but it is not a plain index fund.')
  })

  it('a bond index fund talks about investments, not companies', () => {
    expect(learnTopics(BND).find(t => t.id === 'why')?.answer).toBe('You own a small slice of hundreds of investments at once, so one bad investment can’t sink you, and fees stay low.')
  })
})

describe('URL sync', () => {
  it('opens on explain=1 only', () => {
    expect(isExplainOpen(new URLSearchParams('symbol=VOO&explain=1'))).toBe(true)
    expect(isExplainOpen(new URLSearchParams('symbol=VOO&explain=true'))).toBe(false)
    expect(isExplainOpen(new URLSearchParams('symbol=VOO'))).toBe(false)
  })

  it('Done clears explain and keeps symbol and the other params', () => {
    const closed = withExplain(new URLSearchParams('symbol=VOO&guided=1&explain=1'), false)
    expect(closed.toString()).toBe('symbol=VOO&guided=1')
  })

  it('changing the symbol keeps the explainer open for the new ticker', () => {
    const open = withExplain(new URLSearchParams('symbol=VOO'), true)
    open.set('symbol', 'VFIAX') // what MarketsPage.selectSymbol does
    expect(open.toString()).toBe('symbol=VFIAX&explain=1')
    expect(isExplainOpen(open)).toBe(true)
  })

  it('does not mutate the params it is given', () => {
    const params = new URLSearchParams('symbol=VOO')
    withExplain(params, true)
    expect(params.toString()).toBe('symbol=VOO')
  })

  it('prefills, but never submits, an advisor question', () => {
    expect(decodeURIComponent(advisorHref('VOO'))).toBe('/advisor?q=What is VOO, and what should a beginner know about owning it?')
  })
})

describe('realDifference', () => {
  it('two funds on the same index: same companies, then how you buy and the fee in dollars', () => {
    expect(realDifference(VOO, VFIAX)?.sentences).toEqual([
      'VOO and VFIAX hold the same top companies: they follow the same index.',
      'The differences are how you buy them (ETF vs mutual fund) and the fee: about $3 vs about $4 a year on $10,000.',
    ])
  })

  it('"almost the same" when most, but not all, top holdings match', () => {
    const almost: Fund = { ...VFIAX, topHoldings: [...TOP_TEN.slice(0, 9), { symbol: 'KO', name: 'Coca-Cola Co', weight: 0.01 }] }
    expect(realDifference(VOO, almost)?.sentences[0]).toBe('VOO and VFIAX hold almost the same top companies: they follow the same index.')
  })

  it('two funds with partial or no overlap say so', () => {
    const partial: Fund = { ...VOO, symbol: 'QQQ', tracks: 'NASDAQ-100 Index', topHoldings: [...TOP_TEN.slice(0, 5), ...TOP_TEN.slice(0, 5).map((_, i) => ({ symbol: `X${i}`, name: `Other ${i}`, weight: 0.01 }))] }
    expect(realDifference(VOO, partial)?.sentences[0]).toBe('VOO and QQQ share 5 of their top 10 companies.')
  })

  it('a bond fund compares investments, and a missing fee is named', () => {
    // BND itself has no holdings data (topHoldings: []); use a bond fund that has some to exercise the comparison sentence.
    const bondWithHoldings: Fund = { ...BND, expenseRatio: null, topHoldings: [{ symbol: null, name: 'United States Treasury Notes', weight: 0.004 }] }
    expect(realDifference(VOO, bondWithHoldings)?.sentences).toEqual([
      'VOO and BND own different top investments.',
      'Fee information isn’t available for BND.',
    ])
  })

  it('BND has no holdings data: no investment-comparison sentence is invented', () => {
    expect(realDifference(VOO, BND)?.sentences).toEqual([
      'They cost the same: about $3 a year on $10,000.',
    ])
  })

  it('a free fund reads $0', () => {
    expect(realDifference(VOO, { ...VFIAX, kind: 'etf', expenseRatio: 0 })?.sentences[1]).toBe('The main difference is the fee: about $3 vs $0 a year on $10,000.')
  })

  it('matches holdings by symbol OR name, with BRK.B equal to BRK-B', () => {
    const noSymbols = TOP_TEN.map(h => ({ ...h, symbol: null }))
    expect(holdingsOverlap(TOP_TEN, noSymbols)).toEqual({ shared: 10, of: 10 })
    const dotted = TOP_TEN.map(h => ({ ...h, name: `Renamed ${h.name}`, symbol: h.symbol?.replace('-', '.') ?? null }))
    expect(holdingsOverlap(TOP_TEN, dotted)).toEqual({ shared: 10, of: 10 })
    const unrelated = TOP_TEN.map((h, i) => ({ ...h, symbol: `Z${i}`, name: `Unrelated ${i}` }))
    expect(holdingsOverlap(TOP_TEN, unrelated).shared).toBe(0)
  })

  it('fund vs a stock it holds: a basket, and how much of $1 the stock is', () => {
    expect(realDifference(VOO, AAPL)?.sentences).toEqual(['VOO is a basket of hundreds of companies; AAPL is one of them (about 7¢ of every $1 in VOO).'])
    expect(realDifference(AAPL, VOO)?.sentences).toEqual(realDifference(VOO, AAPL)?.sentences)
  })

  it('fund vs a stock outside its top holdings: a single company', () => {
    const ko: Fund = { ...AAPL, symbol: 'KO', name: 'Coca-Cola Co' }
    expect(realDifference(VOO, ko)?.sentences).toEqual(['VOO is a basket of hundreds of companies; KO is a single company.'])
    expect(realDifference({ ...VOO, isIndexFund: false }, ko)?.sentences[0]).toMatch(/^VOO is a basket of many companies/)
  })

  it('a leveraged ETF is never called a basket of companies', () => {
    expect(realDifference(TQQQ, VOO)?.sentences[0]).toBe('TQQQ is a leveraged ETF, a very different kind of product than VOO.')
    expect(realDifference(AAPL, TQQQ)?.sentences[0]).toBe('TQQQ is a leveraged ETF, a very different kind of product than AAPL.')
    for (const other of [VOO, AAPL, VFIAX]) expect(realDifference(TQQQ, other)!.sentences.join(' ')).not.toMatch(/basket/)
  })

  it('two stocks: one sentence and the Compare companies action with both tickers', () => {
    const msft: Fund = { ...AAPL, symbol: 'MSFT', name: 'Microsoft Corp' }
    expect(realDifference(AAPL, msft)).toEqual({ compareCompanies: true, sentences: ['AAPL and MSFT are both single companies; compare their sales, profit and prices side by side.'] })
    expect(companyPair('aapl', 'MSFT')).toEqual(['AAPL', 'MSFT'])
    expect(companyPair('AAPL', 'aapl')).toEqual(['AAPL'])
  })

  it('stays at three sentences or fewer and is silent for the same symbol, an index, crypto or "other"', () => {
    for (const [a, b] of [[VOO, VFIAX], [VOO, AAPL], [VFIAX, AAPL], [TQQQ, VOO], [VOO, { ...BND, expenseRatio: null }], [{ ...VOO, expenseRatio: null }, { ...VFIAX, expenseRatio: null }]] as const) {
      expect(realDifference(a, b)!.sentences.length).toBeLessThanOrEqual(3)
    }
    expect(realDifference(VOO, VOO)).toBeNull()
    expect(realDifference(VOO, { ...AAPL, kind: 'other' })).toBeNull()
    expect(realDifference(VOO, SPX)).toBeNull()
    expect(realDifference(BTC, AAPL)).toBeNull()
  })
})
