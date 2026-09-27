import { describe, expect, it } from 'vitest'
import { CURATED_FUNDS, curatedFund, curatedMatches, examplesFor, FAMILIES, parseQuery, recipeOf, RECIPES, SYNONYMS, TAGS, tagsOf, type Recipe } from './curatedFunds'
import { plainCategory } from './fundExplainer'

const symbols = (text: string) => curatedMatches(text).map(match => match.fund.symbol)
const LEVERAGED = /\b(leveraged|inverse|ultra(pro)?|daily (target|investment results)|[23]x|bear|short\s+s&p|-?[23]x)\b/i
const ADVICE = /\b(guarantee\w*|best|should|safe\w*|recommend\w*|must|risk-free|can't lose|sure)\b/i

describe('curated list content (build fails on bad data)', () => {
  it('C1: symbols are unique and uppercase; every fund has tags', () => {
    const all = CURATED_FUNDS.map(fund => fund.symbol)
    expect(new Set(all).size).toBe(all.length)
    for (const fund of CURATED_FUNDS) {
      expect(fund.symbol).toMatch(/^\^?[A-Z]{1,6}$/)
      expect(fund.tags.length).toBeGreaterThan(0)
    }
    expect(CURATED_FUNDS.length).toBeGreaterThanOrEqual(36)
  })

  it('C2: never a leveraged or inverse fund', () => {
    for (const fund of CURATED_FUNDS) expect(fund.name, fund.symbol).not.toMatch(LEVERAGED)
    for (const symbol of ['TQQQ', 'SQQQ', 'UPRO', 'SPXL', 'SH', 'SOXL']) expect(curatedFund(symbol)).toBeUndefined()
  })

  it('C3: tags are canonical and synonyms point at real tags', () => {
    const canonical = new Set<string>(TAGS)
    for (const fund of CURATED_FUNDS) for (const tag of fund.tags) expect(canonical.has(tag), `${fund.symbol}: ${tag}`).toBe(true)
    const queryable = new Set<string>([...TAGS, 'etf', 'mutual fund', 'index fund', 'index', ...FAMILIES.map(f => f.toLowerCase())])
    for (const [word, tag] of Object.entries(SYNONYMS)) expect(queryable.has(tag), `${word} → ${tag}`).toBe(true)
    for (const fund of CURATED_FUNDS) if (fund.family) expect(FAMILIES).toContain(fund.family)
  })

  it('C4: the S&P 500 index itself ranks last in its recipe', () => {
    const sp = CURATED_FUNDS.filter(fund => fund.tracks === 's&p-500')
    const index = sp.find(fund => fund.kind === 'index')!
    expect(index.symbol).toBe('^GSPC')
    expect(Math.max(...sp.map(fund => fund.rank))).toBe(index.rank)
  })

  it('C5: one-liners are short and plain: no digits, no %, no advice words', () => {
    for (const fund of CURATED_FUNDS) {
      expect(fund.oneLiner.length, fund.symbol).toBeLessThanOrEqual(110)
      expect(fund.oneLiner, fund.symbol).not.toMatch(/[0-9%]/)
      expect(fund.oneLiner, fund.symbol).not.toMatch(ADVICE)
    }
  })

  it('C6: every recipe offers at least three fund families (the variety guarantee)', () => {
    for (const recipe of Object.keys(RECIPES) as Recipe[]) {
      const families = new Set(CURATED_FUNDS.filter(fund => fund.tracks === recipe && fund.family).map(fund => fund.family))
      expect(families.size, recipe).toBeGreaterThanOrEqual(3)
    }
  })

  it('C7: every category has a plain-word translation', () => {
    for (const fund of CURATED_FUNDS) expect(plainCategory(fund.category), `${fund.symbol}: ${fund.category}`).not.toBeNull()
  })

  it('covers all six fund families the owner named', () => {
    const families = new Set(CURATED_FUNDS.map(fund => fund.family))
    for (const family of FAMILIES) expect(families.has(family), family).toBe(true)
  })
})

describe('parseQuery', () => {
  it('maps beginner wording to canonical tags', () => {
    expect(parseQuery('sp500').tags).toEqual(['s&p 500'])
    expect(parseQuery('S and P').tags).toEqual(['s&p 500'])
    expect(parseQuery('SPX').tags).toEqual(['s&p 500'])
    expect(parseQuery('S&P 500').tags).toEqual(['s&p 500'])
    expect(parseQuery('ETFs').tags).toEqual(['etf'])
    expect(parseQuery('BlackRock').tags).toEqual(['ishares'])
    expect(parseQuery('whole market').tags).toEqual(['total market'])
    expect(parseQuery('Index funds').tags).toEqual(['index fund'])
  })

  it('keeps fund-name words and drops filler', () => {
    expect(parseQuery('vanguard total').words).toEqual(['total'])
    expect(parseQuery('the vanguard index fund').tags.sort()).toEqual(['index fund', 'vanguard'])
    expect(parseQuery('the vanguard index fund').words).toEqual([])
  })
})

describe('curatedMatches', () => {
  it('works on the RAW text: "index fund" and "ETF" are answers, not words to strip', () => {
    expect(symbols('index fund').length).toBe(8)
    expect(symbols('ETF').length).toBe(8)
    expect(symbols(' Index Fund ')).toEqual(symbols('index fund'))
  })

  it('"index fund" deals recipes round-robin: 3 recipes, several families, VOO first', () => {
    const rows = curatedMatches('index fund')
    expect(rows[0]!.fund.symbol).toBe('VOO')
    expect(new Set(rows.map(r => r.fund.tracks)).size).toBeGreaterThanOrEqual(2)
    expect(new Set(rows.map(r => r.fund.family)).size).toBeGreaterThanOrEqual(3)
    // 3/3/2 quotas.
    const counts = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.fund.tracks]: (acc[r.fund.tracks] ?? 0) + 1 }), {})
    expect(Object.values(counts).sort()).toEqual([2, 3, 3])
  })

  it('an exact curated symbol leads', () => {
    expect(symbols('voo')[0]).toBe('VOO')
    expect(symbols('VT')[0]).toBe('VT')
    expect(symbols('fxaix')).toEqual(['FXAIX'])
  })

  it('a two-letter prefix finds curated symbols; one letter never floods the list', () => {
    expect(symbols('vt')).toContain('VTI')
    expect(symbols('v')).toEqual([])
  })

  it('unknown words return nothing (the provider and the advisor take over)', () => {
    expect(symbols('gold')).toEqual([])
    expect(symbols('real estate')).toEqual([])
    expect(symbols('apple')).toEqual([])
  })

  it('never exceeds the limit', () => {
    for (const q of ['index fund', 'etf', 'low fee', 'vanguard']) expect(curatedMatches(q).length).toBeLessThanOrEqual(8)
  })
})

describe('recipeOf', () => {
  it('uses the curated entry, else the provider index name', () => {
    expect(recipeOf('VOO')).toBe('s&p-500')
    expect(recipeOf('brk.b')).toBeNull()
    expect(recipeOf('XYZ', "Standard & Poor's 500 Index")).toBe('s&p-500')
    expect(recipeOf('XYZ', 'The S&P 500 Index')).toBe('s&p-500')
    expect(recipeOf('XYZ', 'Something Else Index')).toBeNull()
    expect(recipeOf('XYZ', null)).toBeNull()
  })
})

describe('examplesFor (Learn glossary)', () => {
  it('gives up to three funds from different families', () => {
    const etf = examplesFor('ETF')
    expect(etf.length).toBe(3)
    expect(new Set(etf.map(fund => fund.family)).size).toBe(3)
    expect(etf.every(fund => tagsOf(fund).includes('etf'))).toBe(true)
    expect(examplesFor('Mutual fund').every(fund => fund.kind === 'mutual_fund')).toBe(true)
    expect(examplesFor('Bond').every(fund => fund.tags.includes('bonds'))).toBe(true)
  })

  it('returns nothing for terms that are not about funds', () => {
    expect(examplesFor('Roth IRA')).toEqual([])
    expect(examplesFor('Volatility')).toEqual([])
  })
})
