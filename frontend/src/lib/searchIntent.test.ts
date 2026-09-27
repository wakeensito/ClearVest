import { describe, expect, it } from 'vitest'
import type { Fund } from '../api/client'
import { AAPL, TQQQ, VOO } from './fundExplainer.fixtures'
import type { FundState } from './fundExplainer'
import { advisorHref, buildRows, classify, guessKind, providerTerm, showGroupHeaders, tickerOf, type ProviderResult, type ProviderState, type Row, type SecurityRow } from './searchIntent'

const ok = (fund: Fund): FundState => ({ status: 'success', fund })
const done = (query: string, results: ProviderResult[], extra: Partial<ProviderState> = {}): ProviderState => ({ query, status: 'success', results, ...extra })
const r = (symbol: string, name: string, kind?: ProviderResult['kind'], extra: Partial<ProviderResult> = {}): ProviderResult =>
  ({ symbol, name, exchange: 'NASDAQ', ...(kind ? { kind, leveraged: false, source: 'both' as const } : {}), ...extra })
const securities = (rows: Row[]) => rows.filter((row): row is SecurityRow => row.type === 'security')
const syms = (rows: Row[]) => rows.map(row => (row.type === 'advisor' ? 'ADVISOR' : row.type === 'lookup' ? `LOOKUP:${row.symbol}` : row.symbol))
const find = (rows: Row[], symbol: string) => securities(rows).find(row => row.symbol === symbol)
const onVoo = { current: 'VOO', currentFund: ok(VOO), canCompare: true }

describe('classify', () => {
  it('I1: empty and whitespace-only are empty', () => {
    expect(classify('')).toBe('empty')
    expect(classify('   ')).toBe('empty')
    expect(buildRows('  ').rows).toEqual([])
  })

  it('I3: anything with a space is never a ticker', () => {
    expect(classify('index fund')).toBe('name')
    expect(classify('apple inc')).toBe('name')
    expect(classify('BRK B')).toBe('name')
  })

  it('I4: case and padding do not change the answer', () => {
    expect(classify(' Index Fund ')).toBe('name')
    expect(classify('aapl')).toBe('ticker')
    expect(syms(buildRows(' Index Fund ').rows)).toEqual(syms(buildRows('index fund').rows))
  })

  it('I5: a pasted paragraph (>6 words) or a question is open-ended: the advisor only', () => {
    const long = 'I want to put some money into something for my kids college in ten years'
    expect(classify(long)).toBe('open')
    expect(classify('what is an index fund?')).toBe('open')
    expect(classify('how do ETFs work')).toBe('open')
    expect(classify('Is VOO good?')).toBe('open')
    const built = buildRows('what is an index fund?')
    expect(syms(built.rows)).toEqual(['ADVISOR'])
    expect(providerTerm(long)).toBe('')
  })

  it('a lone word that could be a ticker is not treated as a question', () => {
    expect(classify('IT')).toBe('ticker')
    expect(classify('DO')).toBe('ticker')
    expect(classify('what')).toBe('ticker')
  })

  it('I6: URLs, punctuation and emoji are invalid, with a hint and no call', () => {
    for (const text of ['https://example.com/voo', 'www.vanguard.com', '!!!', '😀😀', '\u0007']) {
      expect(classify(text), text).toBe('invalid')
      expect(providerTerm(text), text).toBe('')
      const built = buildRows(text)
      expect(built.rows).toEqual([])
      expect(built.notice).toBe('Type a company, fund or ticker')
    }
  })

  it('I7: ^ . - and a leading $ are ticker characters; "." reads as "-"', () => {
    expect(classify('^GSPC')).toBe('ticker')
    expect(classify('BRK-B')).toBe('ticker')
    expect(classify('BRK.B')).toBe('ticker')
    expect(classify('$voo')).toBe('ticker')
    expect(tickerOf('brk.b')).toBe('BRK-B')
    expect(tickerOf('$voo')).toBe('VOO')
    expect(classify('BTC-USD')).toBe('name') // 7 characters: a name search, which finds it
  })

  it('non-ASCII names are names', () => {
    expect(classify('Nestlé')).toBe('name')
    expect(classify('Møller')).toBe('name')
  })
})

describe('provider gating', () => {
  it('I2: one character never calls the provider; two or more do', () => {
    expect(providerTerm('V')).toBe('')
    expect(providerTerm('a')).toBe('')
    expect(providerTerm('ap')).toBe('ap')
    expect(providerTerm(' apple ')).toBe('apple')
    expect(providerTerm('index fund')).toBe('index fund')
  })

  it('I2: one letter shows a "Look up V as a ticker" row and asks for more', () => {
    const built = buildRows('V')
    expect(syms(built.rows)).toEqual(['LOOKUP:V'])
    expect(built.status).toBe('Type more to see names')
  })

  it('guessKind mirrors the backend heuristic for rows without a kind', () => {
    expect(guessKind({ symbol: 'GLD', name: 'SPDR Gold Trust' })).toBe('etf')
    expect(guessKind({ symbol: 'FXAIX', name: 'Fidelity 500 Index' })).toBe('mutual_fund')
    expect(guessKind({ symbol: 'AAPL', name: 'Apple Inc.' })).toBe('stock')
    expect(guessKind({ symbol: '^IXIC', name: 'NASDAQ Composite' })).toBe('index')
    expect(guessKind({ symbol: 'X', name: 'x', kind: 'crypto' })).toBe('crypto')
  })
})

describe('buildRows: tiers and merging', () => {
  it('I8: a curated symbol leads with its one-liner; provider duplicates are dropped', () => {
    const built = buildRows('voo', { provider: done('voo', [r('VOO', 'Vanguard S&P 500 ETF', 'etf'), r('VOOG', 'Vanguard S&P 500 Growth ETF', 'etf')]) })
    const first = built.rows[0] as SecurityRow
    expect(first.symbol).toBe('VOO')
    expect(first.exact).toBe(true)
    expect(first.oneLiner).toBeTruthy()
    expect(syms(built.rows).filter(s => s === 'VOO')).toHaveLength(1)
    expect(syms(built.rows)).toContain('VOOG')
  })

  it('exact provider ticker leads (V, F): never hidden by name matches', () => {
    const built = buildRows('F', { provider: done('F', [r('FORD', 'Forward Industries', 'stock'), r('F', 'Ford Motor Company', 'stock')]) })
    expect(syms(built.rows)[0]).toBe('F')
    expect(built.rows.some(row => row.type === 'lookup')).toBe(false)
  })

  it('I9: "Fidelity" lists Fidelity funds first, companies second', () => {
    const built = buildRows('Fidelity', { provider: done('Fidelity', [r('FIS', 'Fidelity National Information Services', 'stock'), r('FNF', 'Fidelity National Financial', 'stock')]) })
    const groups = built.rows.map(row => row.group)
    expect(groups.indexOf('companies')).toBeGreaterThan(groups.lastIndexOf('funds'))
    const funds = securities(built.rows).filter(row => row.group === 'funds')
    expect(funds.length).toBeGreaterThan(0)
    expect(funds.every(row => row.name.startsWith('Fidelity'))).toBe(true)
  })

  it('I10: "sp500", "s and p" and "SPX" reach the S&P 500 recipe with ^GSPC last', () => {
    for (const q of ['sp500', 's and p', 'S&P 500']) {
      const list = syms(buildRows(q).rows)
      expect(list[0], q).toBe('VOO')
      expect(list).toContain('FXAIX')
      expect(list[list.length - 1], q).toBe('^GSPC')
    }
    expect(syms(buildRows('SPX').rows)).toContain('VOO')
    expect(syms(buildRows('nasdaq').rows)[0]).toBe('QQQ')
  })

  it('I11: category words filter exactly', () => {
    const idx = securities(buildRows('index fund').rows)
    expect(new Set(idx.map(row => row.symbol)).size).toBe(8)
    expect(idx.every(row => row.label.startsWith('Index fund'))).toBe(true)
    expect(securities(buildRows('ETF').rows).every(row => row.kind === 'etf')).toBe(true)
    expect(securities(buildRows('mutual fund').rows).every(row => row.kind === 'mutual_fund')).toBe(true)
    for (const q of ['bonds', 'bond']) expect(syms(buildRows(q).rows).slice(0, 3)).toEqual(expect.arrayContaining(['BND']))
    expect(syms(buildRows('international').rows)).toEqual(syms(buildRows('foreign').rows))
    expect(syms(buildRows('international').rows)[0]).toBe('VXUS')
    expect(syms(buildRows('tech').rows)).toEqual(expect.arrayContaining(['VGT', 'FTEC', 'XLK', 'QQQ']))
    expect(syms(buildRows('dividend').rows)).toEqual(expect.arrayContaining(['SCHD', 'VYM', 'VIG']))
    expect(syms(buildRows('small companies').rows)).toEqual(expect.arrayContaining(['VB', 'IJR', 'SCHA']))
  })

  it('I11: "cheap", "low fee", "zero fee" and "no fee" put the no-fee funds first', () => {
    for (const q of ['cheap', 'low fee']) expect(syms(buildRows(q).rows).slice(0, 2), q).toEqual(['FZROX', 'FZILX'])
    for (const q of ['zero fee', 'no fee']) expect(syms(buildRows(q).rows), q).toEqual(['FZROX', 'FZILX'])
  })

  it('I11: two tags intersect: "vanguard s&p" is VOO and VFIAX only', () => {
    expect(syms(buildRows('vanguard s&p').rows)).toEqual(['VOO', 'VFIAX'])
  })

  it('I11: "index fund" spans at least two recipes and three families', () => {
    const rows = securities(buildRows('index fund').rows)
    const names = rows.map(row => row.name.split(' ')[0])
    expect(new Set(names).size).toBeGreaterThanOrEqual(3)
  })

  it('RAW text: "index fund" and "ETF" are curated answers even though a box may strip "fund"/"etf"', () => {
    // SymbolSearch's normalizeQuery turns "index fund" into "index" for the provider; the curated
    // tier must see the raw text. Both answer, but "index fund" is the richer, grouped list.
    expect(securities(buildRows('index fund').rows).length).toBe(8)
    expect(securities(buildRows('ETF').rows).length).toBe(8)
    expect(classify('index fund')).toBe('name')
    expect(classify('apple stock')).toBe('name')
  })

  it('I12: providers down → curated + a ticker row + "Live search is unavailable", never blank', () => {
    const down = buildRows('vo', { provider: { query: 'vo', status: 'error', results: [] } })
    expect(down.notice).toBe('Live search is unavailable')
    expect(syms(down.rows)).toEqual(['LOOKUP:VO', 'VOO'])
    const both = buildRows('apple', { provider: done('apple', [], { unavailable: ['fmp', 'yahoo'] }) })
    expect(both.notice).toBe('Live search is unavailable')
    expect(syms(both.rows)).toEqual(['LOOKUP:APPLE'])
  })

  it('I12: stale provider data is captioned', () => {
    const built = buildRows('apple', { provider: done('apple', [r('AAPL', 'Apple Inc.', 'stock')], { stale: true }) })
    expect(built.notice).toBe('Previously saved results')
    expect(syms(built.rows)).toEqual(['AAPL'])
  })

  it('I13: a leveraged provider fund is labelled high risk', () => {
    const built = buildRows('tqqq', { provider: done('tqqq', [r('TQQQ', 'ProShares UltraPro QQQ', 'etf', { leveraged: true })]) })
    expect(find(built.rows, 'TQQQ')!.label).toBe('Leveraged ETF · high risk')
  })

  it('a stock whose name sounds leveraged is not: leveraged applies to funds only', () => {
    const built = buildRows('3x', { provider: done('3x', [r('TRX', '3x Corp', 'stock', { leveraged: true })]) })
    expect(find(built.rows, 'TRX')!.leveraged).toBe(false)
  })

  it('I14: an uncurated word falls to the provider, then to the advisor', () => {
    const gold = buildRows('gold', { provider: done('gold', [r('GLD', 'SPDR Gold Trust', 'etf')]) })
    expect(syms(gold.rows)).toEqual(['GLD'])
    const none = buildRows('real estate', { provider: done('real estate', []) })
    expect(syms(none.rows)).toEqual(['ADVISOR'])
    expect(none.status).toBe('No matches')
    expect((none.rows[0] as { href: string }).href).toBe('/advisor?q=real%20estate')
  })

  it('I15: stale provider data (typed on) never produces an exact row, and says Searching', () => {
    const provider = done('ap', [r('AP', 'Ampco-Pittsburgh', 'stock'), r('AAPL', 'Apple Inc.', 'stock')])
    const built = buildRows('app', { provider })
    expect(securities(built.rows).some(row => row.exact)).toBe(false)
    expect(syms(built.rows)).toEqual(['AP', 'AAPL']) // kept (keepPreviousData), not promoted
    expect(buildRows('zzzq', { provider: { query: 'zzzq', status: 'loading', results: [] } }).status).toBe('Searching…')
    // No advisor row while still loading.
    expect(syms(buildRows('zzzq', { provider: { query: 'zzzq', status: 'loading', results: [] } }).rows)).toEqual([])
  })

  it('caps at 8 and announces the count', () => {
    const many = Array.from({ length: 12 }, (_, i) => r(`AB${String.fromCharCode(65 + i)}`, `Company ${i}`, 'stock'))
    const built = buildRows('ab', { provider: done('ab', many) })
    expect(built.rows).toHaveLength(8)
    expect(built.status).toBe('8 results for “ab”')
  })

  it('crypto and indexes group under "Indexes & crypto"; headers only with more than one group', () => {
    const built = buildRows('bitcoin', { provider: done('bitcoin', [r('BTC-USD', 'Bitcoin USD', 'crypto'), r('IBIT', 'iShares Bitcoin Trust ETF', 'etf')]) })
    expect(find(built.rows, 'BTC-USD')!.label).toBe('Cryptocurrency')
    expect(find(built.rows, 'BTC-USD')!.group).toBe('other')
    expect(showGroupHeaders(built.rows)).toBe(true)
    expect(showGroupHeaders(buildRows('bonds').rows)).toBe(false)
    expect(showGroupHeaders(buildRows('s&p 500').rows)).toBe(true) // funds, then the index itself
  })

  it('kinds filter: Compare companies sees stocks only', () => {
    const built = buildRows('vanguard', { kinds: ['stock'], provider: done('vanguard', [r('VOO', 'Vanguard S&P 500 ETF', 'etf'), r('VG', 'Venture Global', 'stock')]) })
    expect(syms(built.rows)).toEqual(['VG'])
  })

  it('the advisor link is encoded and at most 80 characters of text', () => {
    expect(advisorHref('what is a “fund” & why?')).toBe(`/advisor?q=${encodeURIComponent('what is a “fund” & why?')}`)
    const long = 'a'.repeat(200)
    expect(decodeURIComponent(advisorHref(long).split('q=')[1]!).length).toBe(80)
  })
})

describe('buildRows: compare hook', () => {
  it('I16: current VOO → FXAIX gets Compare and "Same index as VOO", sorted first', () => {
    const built = buildRows('index fund', onVoo)
    const fxaix = find(built.rows, 'FXAIX')!
    expect(fxaix.compare).toBe(true)
    expect(fxaix.sameLabel).toBe('Same index as VOO')
    const labelled = securities(built.rows).findIndex(row => !row.sameLabel)
    expect(securities(built.rows).slice(0, labelled).every(row => row.sameLabel)).toBe(true)
    expect(find(built.rows, 'VOO')!.compare).toBe(false) // I17: the current symbol itself
  })

  it('I16: VOO → VXUS gets Compare but no same-index label; a non-identical recipe says "Similar mix"', () => {
    expect(find(buildRows('international', onVoo).rows, 'VXUS')).toMatchObject({ compare: true, sameLabel: null })
    const vti = { current: 'VTI', currentFund: ok({ ...VOO, symbol: 'VTI', tracks: 'CRSP US Total Market Index' }), canCompare: true }
    expect(find(buildRows('total market', vti).rows, 'FSKAX')!.sameLabel).toBe('Similar mix to VTI')
  })

  it('I16: a provider-only fund gets Compare; "same index" only via its provider tracks', () => {
    const built = buildRows('schwab 500', { ...onVoo, provider: done('schwab 500', [r('SWPPX', 'Schwab S&P 500 Index', 'mutual_fund'), r('SWXYZ', 'Schwab Some Fund', 'mutual_fund')]) })
    expect(find(built.rows, 'SWXYZ')).toMatchObject({ compare: true, sameLabel: null })
    // An uncurated current fund finds its recipe through Fund.tracks aliases.
    const other = { current: 'XYZ', currentFund: ok({ ...VOO, symbol: 'XYZ' }), canCompare: true }
    expect(find(buildRows('fxaix', other).rows, 'FXAIX')!.sameLabel).toBe('Same index as XYZ')
  })

  it('I16: never Compare to a leveraged fund, while the current fund loads, or from a leveraged current', () => {
    const lev = buildRows('tqqq', { ...onVoo, provider: done('tqqq', [r('TQQQ', 'ProShares UltraPro QQQ', 'etf', { leveraged: true })]) })
    expect(find(lev.rows, 'TQQQ')!.compare).toBe(false)
    const pending = buildRows('index fund', { current: 'VOO', currentFund: { status: 'pending' }, canCompare: true })
    expect(securities(pending.rows).some(row => row.compare)).toBe(false)
    const fromLev = buildRows('index fund', { current: 'TQQQ', currentFund: ok(TQQQ), canCompare: true })
    expect(securities(fromLev.rows).some(row => row.compare)).toBe(false)
  })

  it('I17: a stock current, or no onCompare, means no Compare anywhere', () => {
    const stock = buildRows('index fund', { current: 'AAPL', currentFund: ok(AAPL), canCompare: true })
    expect(securities(stock.rows).some(row => row.compare)).toBe(false)
    const apple = buildRows('apple', { current: 'AAPL', currentFund: ok(AAPL), canCompare: true, provider: done('apple', [r('AAPL', 'Apple Inc.', 'stock')]) })
    expect(find(apple.rows, 'AAPL')!.compare).toBe(false)
    const none = buildRows('index fund', { current: 'VOO', currentFund: ok(VOO) })
    expect(securities(none.rows).some(row => row.compare)).toBe(false)
  })

  it('I18: crypto and index rows never get Compare', () => {
    const built = buildRows('bitcoin', { ...onVoo, provider: done('bitcoin', [r('BTC-USD', 'Bitcoin USD', 'crypto'), r('^GSPC', 'S&P 500', 'index')]) })
    expect(securities(built.rows).some(row => row.compare)).toBe(false)
    expect(find(buildRows('s&p 500', onVoo).rows, '^GSPC')!.compare).toBe(false)
  })
})
