import { describe, expect, it } from 'vitest'
import { EMPTY_SEARCH_ERROR, moveHighlight, resolveSubmit, searchTerm, type Suggestion } from './searchBox'

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
