import { describe, expect, it } from 'vitest'
import { EMPTY_SEARCH_ERROR, moveHighlight, normalizeQuery, resolveSubmit, searchTerm, shouldAwaitSearch, type Suggestion } from './searchBox'

const apple: Suggestion = { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' }
const voo: Suggestion = { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', exchange: 'NYSE Arca' }
const voog: Suggestion = { symbol: 'VOOG', name: 'Vanguard S&P 500 Growth ETF', exchange: 'NYSE Arca' }

describe('resolveSubmit', () => {
  it('selects a ticker-shaped input directly when there are no suggestions (no round trip)', () => {
    expect(resolveSubmit('voo', [], -1)).toEqual({ symbol: 'VOO' })
    expect(resolveSubmit('  brk-b ', [], -1)).toEqual({ symbol: 'BRK-B' })
  })

  it('a name picks the first suggestion', () => {
    expect(resolveSubmit('apple', [apple], -1)).toEqual({ symbol: 'AAPL' })
    expect(resolveSubmit('Apple Inc', [apple], -1)).toEqual({ symbol: 'AAPL' })
  })

  it('the highlighted suggestion wins over everything', () => {
    expect(resolveSubmit('voo', [voo, voog], 1)).toEqual({ symbol: 'VOOG' })
    expect(resolveSubmit('apple', [voo, apple], 1)).toEqual({ symbol: 'AAPL' })
  })

  it('a ticker that exactly matches a suggestion keeps the typed ticker', () => {
    expect(resolveSubmit('voo', [voog, voo], -1)).toEqual({ symbol: 'VOO' })
  })

  it('with no suggestions a ticker-shaped name still goes direct: callers must not call this while a search is pending', () => {
    // "apple" is ticker-shaped. SymbolSearch only reaches this with [] once shouldAwaitSearch is false.
    expect(resolveSubmit('apple', [], -1)).toEqual({ symbol: 'APPLE' })
  })

  it('ignores an out-of-range highlight', () => {
    expect(resolveSubmit('apple', [apple], 3)).toEqual({ symbol: 'AAPL' })
  })

  it('empty input, or a name with no suggestions yet, shows the existing alert copy', () => {
    expect(resolveSubmit('', [], -1)).toEqual({ error: EMPTY_SEARCH_ERROR })
    expect(resolveSubmit('   ', [apple], -1)).toEqual({ error: EMPTY_SEARCH_ERROR })
    expect(resolveSubmit('apple inc', [], -1)).toEqual({ error: EMPTY_SEARCH_ERROR })
    expect(EMPTY_SEARCH_ERROR).toBe('Enter one ticker symbol, such as VOO or BRK-B.')
  })
})

describe('searchTerm', () => {
  it('searches only from two trimmed characters', () => {
    expect(searchTerm('a')).toBe('')
    expect(searchTerm(' a ')).toBe('')
    expect(searchTerm(' ap ')).toBe('ap')
  })
})

describe('moveHighlight', () => {
  it('wraps through the list and back to the input', () => {
    expect(moveHighlight(-1, 1, 3)).toBe(0)
    expect(moveHighlight(2, 1, 3)).toBe(-1)
    expect(moveHighlight(-1, -1, 3)).toBe(2)
    expect(moveHighlight(0, -1, 3)).toBe(-1)
    expect(moveHighlight(-1, 1, 0)).toBe(-1)
  })
})

describe('shouldAwaitSearch', () => {
  it('waits while the pause has not settled on this draft', () => {
    expect(shouldAwaitSearch('apple', false, false, [])).toBe(true)
    expect(shouldAwaitSearch('voo', false, false, [])).toBe(true)
  })

  it('waits while the search for this draft is still loading', () => {
    expect(shouldAwaitSearch('apple', true, true, [])).toBe(true)
  })

  it('waits for names too, so Enter never shows the alert for a name mid-search', () => {
    expect(shouldAwaitSearch('apple inc', false, false, [])).toBe(true)
  })

  it('does not wait once the search has settled and loaded', () => {
    expect(shouldAwaitSearch('apple', true, false, [])).toBe(false)
    expect(shouldAwaitSearch('apple', true, false, [apple])).toBe(false)
  })

  it('does not wait when a listed suggestion is exactly the typed ticker', () => {
    expect(shouldAwaitSearch('voo', false, true, [voog, voo])).toBe(false)
  })

  it('never waits on something that is never searched (empty or one character)', () => {
    expect(shouldAwaitSearch('', false, true, [])).toBe(false)
    expect(shouldAwaitSearch(' v ', false, true, [])).toBe(false)
  })
})

describe('normalizeQuery', () => {
  it('trims, drops one leading $, and drops a trailing "stock"/"shares"/"etf"-style word', () => {
    expect(normalizeQuery('  $AAPL ')).toBe('AAPL')
    expect(normalizeQuery('$$AAPL')).toBe('$AAPL')
    expect(normalizeQuery('apple stock')).toBe('apple')
    expect(normalizeQuery('nvidia shares')).toBe('nvidia')
    expect(normalizeQuery('Vanguard ETF')).toBe('Vanguard')
    expect(normalizeQuery('fidelity Fund ')).toBe('fidelity')
    expect(normalizeQuery('msft Ticker')).toBe('msft')
    expect(normalizeQuery('voo')).toBe('voo')
  })

  it('keeps a lone keyword and words that only contain one', () => {
    expect(normalizeQuery('stock')).toBe('stock')
    expect(normalizeQuery('stockx')).toBe('stockx')
    expect(normalizeQuery('bitcoin fundamentals')).toBe('bitcoin fundamentals')
  })

  it('feeds both the ticker test and the search term', () => {
    expect(resolveSubmit('$AAPL', [], -1)).toEqual({ symbol: 'AAPL' })
    expect(resolveSubmit('apple stock', [apple], -1)).toEqual({ symbol: 'AAPL' })
    expect(searchTerm('apple stock')).toBe('apple')
    expect(searchTerm('nvidia shares')).toBe('nvidia')
    expect(searchTerm('$AAPL')).toBe('AAPL')
    expect(searchTerm('voo')).toBe('voo')
    expect(shouldAwaitSearch('$voo', false, true, [voo])).toBe(false)
  })
})
