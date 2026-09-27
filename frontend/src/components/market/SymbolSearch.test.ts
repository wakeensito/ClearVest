import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement as h, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { Fund } from '../../api/client'
import { VOO } from '../../lib/fundExplainer.fixtures'
import type { FundState } from '../../lib/fundExplainer'
import { answeredLocally, chipsFor, compareTarget, DEFAULT_CHIPS, escapeAction, providerState, resolveRowSubmit, type Suggestion } from '../../lib/searchBox'
import { buildRows, type ProviderResult, type Row } from '../../lib/searchIntent'
import { CompanyComparison } from './CompanyComparison'
import { ResearchWorkspace } from './ResearchWorkspace'
import { SecurityResearch } from './SecurityResearch'
import { SuggestionList, SymbolSearch } from './SymbolSearch'

const noop = () => {}
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
const wrapped = (node: ReactNode, url = '/markets?symbol=VOO') => renderToStaticMarkup(
  h(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, h(MemoryRouter, { initialEntries: [url] }, node)),
)
const ok = (fund: Fund): FundState => ({ status: 'success', fund })
const hit = (symbol: string, name: string, kind: ProviderResult['kind'], extra: Partial<ProviderResult> = {}): ProviderResult =>
  ({ symbol, name, exchange: 'NASDAQ', kind, leveraged: false, source: 'both', ...extra })
const done = (query: string, results: ProviderResult[]) => ({ query, status: 'success' as const, results })
const apple = hit('AAPL', 'Apple Inc.', 'stock')
const hospitality = hit('APLE', 'Apple Hospitality REIT, Inc. with a very long legal name', 'stock', { exchange: null })
const list = (rows: Row[], extra: Partial<Parameters<typeof SuggestionList>[0]> = {}) =>
  renderToStaticMarkup(h(SuggestionList, { id: 'list', rows, highlighted: -1, onPick: noop, ...extra }))
const rowsFor = (raw: string, results: ProviderResult[] = [], extra: Parameters<typeof buildRows>[1] = {}) =>
  buildRows(raw, { provider: done(raw.trim(), results), ...extra }).rows
const onVoo = { current: 'VOO', currentFund: ok(VOO), canCompare: true }

describe('SymbolSearch box', () => {
  it('S1: a visibly labelled combobox, collapsed until the user types, phone-friendly input', () => {
    const html = wrapped(h(SymbolSearch, { value: 'VOO', onSelect: noop }))
    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-autocomplete="list"')
    expect(html).toMatch(/<label for="[^"]+" class="[^"]*label[^"]*">Find a stock or fund<\/label>/)
    expect(html).not.toMatch(/<label[^>]*sr-only/)
    expect(html).toContain('value="VOO"')
    expect(html).toContain('autoCapitalize="none"')
    expect(html).toContain('enterKeyHint="search"')
    expect(html).toContain('spellCheck="false"')
    expect(html).toContain('maxLength="80"')
    expect(html).not.toContain('role="listbox"')
    expect(html).not.toContain('aria-activedescendant')
  })

  it('S1: chips only while the box is empty, each a real button', () => {
    const empty = wrapped(h(SymbolSearch, { onSelect: noop }))
    for (const chip of DEFAULT_CHIPS) expect(empty).toContain(`>${chip.replace('&', '&amp;')}</button>`)
    expect(empty.match(/type="button"/g)).toHaveLength(DEFAULT_CHIPS.length)
    expect(wrapped(h(SymbolSearch, { value: 'VOO', onSelect: noop }))).not.toContain('>index fund</button>')
    expect(text(wrapped(h(SymbolSearch, { onSelect: noop, chips: ['Apple', 'Nike'] })))).toContain('AppleNike')
  })

  it('S6: one polite role=status live region and no alert until an error', () => {
    const html = wrapped(h(SymbolSearch, { onSelect: noop }))
    expect(html.match(/role="status"/g)).toHaveLength(1)
    expect(html).not.toContain('role="alert"')
    expect(html).not.toContain('aria-live="assertive"')
  })

  it('S3: the keyboard hint names Shift+Enter only when Compare is on', () => {
    expect(text(wrapped(h(SymbolSearch, { onSelect: noop, current: 'VOO', onCompare: noop })))).toContain('Shift+Enter compares with VOO.')
    expect(text(wrapped(h(SymbolSearch, { onSelect: noop })))).not.toContain('Shift+Enter')
  })
})

describe('SuggestionList', () => {
  it('lists symbol (mono), name, kind label and exchange as listbox options', () => {
    const html = list(rowsFor('apple', [apple, hospitality]))
    expect(html).toContain('role="listbox"')
    expect(html.match(/role="option"/g)).toHaveLength(2)
    expect(html).toContain('id="list-0"')
    expect(html).toMatch(/class="t-mono[^"]*"[^>]*>AAPL</)
    expect(text(html)).toContain('Apple Inc.')
    expect(text(html)).toContain('Company stock')
    expect(text(html)).toContain('NASDAQ')
    expect(html).not.toContain('null')
  })

  it('S3: marks the highlighted option selected', () => {
    const html = list(rowsFor('apple', [apple, hospitality]), { highlighted: 1 })
    expect(html).toMatch(/id="list-1"[^>]*aria-selected="true"/)
    expect(html).toMatch(/id="list-0"[^>]*aria-selected="false"/)
  })

  it('shows a quiet note, not a list, while nothing is listed yet', () => {
    expect(text(list([], { note: 'Searching…' }))).toBe('Searching…')
    expect(list([], { note: 'Searching…' })).toContain('id="list"')
    expect(list([])).toBe('')
  })

  it('S7: curated rows carry the kind label and one-liner; a leveraged row says "high risk" in the loss colour', () => {
    const html = list(rowsFor('voo'))
    expect(text(html)).toContain('Index fund (ETF)')
    expect(text(html)).toContain('The biggest U.S. companies')
    const risky = list(rowsFor('tqqq', [hit('TQQQ', 'ProShares UltraPro QQQ', 'etf', { leveraged: true })]))
    expect(risky).toContain('<span class="c-loss">high risk</span>')
    expect(text(risky)).toContain('Leveraged ETF · high risk')
  })

  it('S7: provider text is rendered as text, never as markup', () => {
    const html = list(rowsFor('evil', [hit('EVIL', '<img src=x onerror=alert(1)>', 'stock')]))
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('S8: one group has no headers; several groups get them; the advisor row is its own group', () => {
    expect(list(rowsFor('apple', [apple, hospitality]))).not.toContain('role="presentation"')
    const mixed = list(rowsFor('fidelity', [hit('FIS', 'Fidelity National Information Services', 'stock')]))
    expect(text(mixed)).toMatch(/^Funds.*Companies.*FIS/)
    expect(mixed.match(/role="presentation"/g)).toHaveLength(2)
    const question = list(rowsFor('what is an index fund?'))
    expect(text(question)).toBe('Ask the advisor: “what is an index fund?” →')
  })

  it('S3: fund rows get "Compare with VOO" as a tabIndex=-1 button with the same-index label', () => {
    const html = list(rowsFor('index fund', [], onVoo), { onCompare: noop, compareWith: 'VOO' })
    expect(html.match(/<button[^>]*>.*?<\/button>/)?.[0]).toMatch(/^<button type="button" tabindex="-1"[^>]*aria-label="Compare with VOO"/i)
    expect(text(html)).toContain('Compare with VOO')
    expect(text(html)).toContain('Same index as VOO')
    expect(list(rowsFor('apple', [apple], onVoo), { onCompare: noop, compareWith: 'VOO' })).not.toContain('Compare with')
  })

  it('"Look up V as a ticker" for one character', () => {
    expect(text(list(rowsFor('v')))).toBe('Look up V as a ticker')
  })
})

describe('Enter, Shift+Enter and Escape', () => {
  it('S3/S9: Enter with no active row takes the first row; a highlighted row wins', () => {
    const rows = rowsFor('index fund')
    expect(resolveRowSubmit('index fund', rows, -1)).toEqual({ symbol: 'VOO' })
    const second = rows[1]
    expect(second?.type).toBe('security')
    expect(resolveRowSubmit('index fund', rows, 1)).toEqual({ symbol: second?.type === 'security' ? second.symbol : '' })
  })

  it('a raw category word never becomes an "invalid ticker" alert or a fake ticker', () => {
    for (const word of ['ETF', 'bonds', 'mutual fund', 'index funds', 'S&P 500', 'cheap']) {
      const result = resolveRowSubmit(word, rowsFor(word), -1)
      expect(result, word).not.toHaveProperty('error')
      expect(['ETF', 'BONDS', 'INDEX', 'CHEAP', 'MUTUAL']).not.toContain((result as { symbol?: string }).symbol)
    }
  })

  it('C1: with live search down, Enter on a category word researches its first curated fund', () => {
    for (const word of ['bonds', 'ETF', 'cheap', 'tech']) {
      const rows = buildRows(word, { provider: { query: word, status: 'error', results: [] } }).rows
      const first = rows[0]
      expect(first?.type === 'security' && first.from, word).toBe('curated')
      expect(resolveRowSubmit(word, rows, -1), word).toEqual({ symbol: first?.type === 'security' ? first.symbol : '' })
    }
    const aapl = buildRows('AAPL', { provider: { query: 'AAPL', status: 'error', results: [] } }).rows
    expect(resolveRowSubmit('AAPL', aapl, -1)).toEqual({ symbol: 'AAPL' })
    expect(resolveRowSubmit('V', buildRows('V').rows, -1)).toEqual({ symbol: 'V' })
  })

  it('M3: Enter on "ETF", "bonds" or "cheap" is answered by the curated rows on screen, without awaiting the search', () => {
    for (const word of ['ETF', 'bonds', 'cheap', 'index fund']) {
      const rows = buildRows(word, { provider: { query: word, status: 'loading', results: [] } }).rows
      expect(answeredLocally(rows), word).toBe(true)
    }
    // An exact curated ticker, a provider row, a lookup row or nothing yet still waits (or needs no wait).
    expect(answeredLocally(buildRows('VOO', { provider: { query: 'VOO', status: 'loading', results: [] } }).rows)).toBe(false)
    expect(answeredLocally(rowsFor('apple', [apple]))).toBe(false)
    expect(answeredLocally(buildRows('V').rows)).toBe(false)
    expect(answeredLocally([])).toBe(false)
  })

  it('M3: a ticker-shaped prefix ("vo") is not a category word: a fast Enter waits, and when down researches VO', () => {
    const pending = buildRows('vo', { provider: { query: 'vo', status: 'loading', results: [] } }).rows
    expect(answeredLocally(pending)).toBe(false)
    const down = buildRows('vo', { provider: { query: 'vo', status: 'error', results: [] } }).rows
    expect(resolveRowSubmit('vo', down, -1)).toEqual({ symbol: 'VO' })
    for (const word of ['bonds', 'ETF', 'cheap', 'tech']) {
      const rows = buildRows(word, { provider: { query: word, status: 'loading', results: [] } }).rows
      expect(answeredLocally(rows), word).toBe(true)
      expect(resolveRowSubmit(word, rows, -1), word).toEqual({ symbol: rows[0]?.type === 'security' ? rows[0].symbol : '' })
    }
    const voo = buildRows('voo', { provider: { query: 'voo', status: 'loading', results: [] } }).rows
    expect(voo[0]?.type === 'security' && voo[0].exact).toBe(true)
    expect(resolveRowSubmit('voo', voo, -1)).toEqual({ symbol: 'VOO' })
  })

  it('S4: the advisor row (and a question) hands off, URL-encoded and capped at 80 characters', () => {
    const rows = rowsFor('what is an index fund?')
    expect(resolveRowSubmit('what is an index fund?', rows, 0)).toEqual({ advisor: '/advisor?q=what%20is%20an%20index%20fund%3F' })
    expect(resolveRowSubmit('what is an index fund?', rows, -1)).toEqual({ advisor: '/advisor?q=what%20is%20an%20index%20fund%3F' })
    const long = `how ${'a'.repeat(120)}?`
    const result = resolveRowSubmit(long, rowsFor(long), -1) as { advisor: string }
    expect(decodeURIComponent(result.advisor.split('q=')[1] ?? '')).toHaveLength(80)
  })

  it('a name with nothing listed asks the advisor; an unknown ticker still researches as typed', () => {
    expect(resolveRowSubmit('zzqx holdings', rowsFor('zzqx holdings'), -1)).toEqual({ advisor: '/advisor?q=zzqx%20holdings' })
    expect(resolveRowSubmit('FAIL', rowsFor('FAIL'), -1)).toEqual({ symbol: 'FAIL' })
    expect(resolveRowSubmit('v', rowsFor('v'), -1)).toEqual({ symbol: 'V' })
    expect(resolveRowSubmit('https://x.com', rowsFor('https://x.com'), -1)).toHaveProperty('error')
  })

  it('S3: Shift+Enter compares the highlighted (else first) row, and is a no-op without Compare', () => {
    const rows = rowsFor('fxaix', [], onVoo)
    expect(compareTarget(rows, -1)).toBe('FXAIX')
    expect(compareTarget(rows, 0)).toBe('FXAIX')
    expect(compareTarget(rowsFor('apple', [apple], onVoo), 0)).toBeNull()
    expect(compareTarget(rowsFor('fxaix'), 0)).toBeNull()
    expect(compareTarget([], -1)).toBeNull()
  })

  it('S5: Escape closes the list, then clears, then lets the key through', () => {
    expect(escapeAction(true, 'index fund')).toBe('close')
    expect(escapeAction(false, 'index fund')).toBe('clear')
    expect(escapeAction(false, '')).toBeNull()
  })
})

describe('S2: provider answers only count for the text in the box now', () => {
  const data = { results: [apple] as Suggestion[], unavailable: [], stale: false }
  it('a late answer for an older draft is ignored (loading, no rows)', () => {
    expect(providerState('apple', { typed: true, term: 'apple', settled: 'app', data, isError: false })).toMatchObject({ status: 'loading', results: [] })
  })
  it('the settled answer is used; an error is "down"; no call when the term is empty or not typed', () => {
    expect(providerState(' apple ', { typed: true, term: 'apple', settled: 'apple', data, isError: false })).toMatchObject({ query: 'apple', status: 'success', results: [apple] })
    expect(providerState('apple', { typed: true, term: 'apple', settled: 'apple', isError: true }).status).toBe('error')
    expect(providerState('v', { typed: true, term: '', settled: '', isError: false })).toEqual({ query: 'v', status: 'success', results: [] })
    expect(providerState('VOO', { typed: false, term: 'VOO', settled: 'VOO', data, isError: false }).results).toEqual([])
  })
  it('cleared input: nothing listed', () => {
    expect(buildRows('', { provider: providerState('', { typed: true, term: '', settled: 'apple', data, isError: false }) }).rows).toEqual([])
  })
})

describe('S10: stock-only boxes (Compare companies)', () => {
  it('fund words drop out of the default chips; an explicit list wins', () => {
    expect(chipsFor(undefined, ['stock'])).toEqual(['Apple'])
    expect(chipsFor(['Apple', 'Microsoft', 'Nike'], ['stock'])).toEqual(['Apple', 'Microsoft', 'Nike'])
    expect(chipsFor(undefined, undefined)).toEqual(DEFAULT_CHIPS)
  })

  it('no fund rows and no Compare', () => {
    const rows = rowsFor('vanguard', [hit('VOO', 'Vanguard S&P 500 ETF', 'etf'), hit('VG', 'Vanguard Corp', 'stock')], { ...onVoo, kinds: ['stock'] })
    expect(rows.map(row => (row.type === 'security' ? row.symbol : row.type))).toEqual(['VG'])
  })

  it('the Compare companies box shows company chips only', () => {
    const html = text(wrapped(h(CompanyComparison, { selected: ['AAPL'], onSelectedChange: noop }), '/markets?view=companies'))
    expect(html).toContain('Find a company by name or ticker')
    expect(html).toContain('Microsoft')
    expect(html).not.toContain('index fund')
  })
})

describe('one search box on the ticker page', () => {
  it('SecurityResearch has a single search input and no "Find a company by name"', () => {
    const html = wrapped(h(SecurityResearch, { initialSymbol: 'VOO' }))
    expect(html.match(/<input/g)).toHaveLength(1)
    expect(html).toContain('role="combobox"')
    expect(text(html)).not.toContain('Find a company by name')
    expect(text(html)).not.toContain('Shift+Enter')
  })

  it('SecurityResearch with onCompare offers Compare with its own symbol', () => {
    expect(text(wrapped(h(SecurityResearch, { initialSymbol: 'VOO', onCompare: noop })))).toContain('Shift+Enter compares with VOO.')
  })

  it('guided mode renders the same box, wired for Compare, and keeps the chart collapsed', () => {
    const html = wrapped(h(ResearchWorkspace, { symbol: 'AAPL', onSymbolChange: noop, guided: true }), '/markets?symbol=AAPL&guided=1')
    expect(html).toContain('placeholder="Apple, index fund, VOO…"')
    expect(text(html)).toContain('Shift+Enter compares with AAPL.')
    expect(text(html)).not.toContain('Find a company by name')
    expect(text(html)).toContain('Explore the share price chart')
    expect(html).not.toContain('interactive price chart')
  })
})

describe('ResearchWorkspace compare dialog', () => {
  it('W6: "Compare securities" is unchanged and the dialog starts closed, even with ?compare= (opened by an effect)', () => {
    const html = wrapped(h(ResearchWorkspace, { symbol: 'VOO', onSymbolChange: noop }), '/markets?symbol=VOO&compare=FXAIX')
    expect(text(html)).toContain('Compare securities')
    expect(html).toMatch(/<dialog[^>]*aria-labelledby="research-comparison-title"/)
    expect(html).not.toMatch(/<dialog[^>]* open/)
  })
})
