import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement as h, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { Suggestion } from '../../lib/searchBox'
import { ResearchWorkspace } from './ResearchWorkspace'
import { SecurityResearch } from './SecurityResearch'
import { SuggestionList, SymbolSearch } from './SymbolSearch'

const noop = () => {}
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')
const wrapped = (node: ReactNode, url = '/markets?symbol=VOO') => renderToStaticMarkup(
  h(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, h(MemoryRouter, { initialEntries: [url] }, node)),
)
const apple: Suggestion = { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' }
const hospitality: Suggestion = { symbol: 'APLE', name: 'Apple Hospitality REIT, Inc. with a very long legal name', exchange: null }
const list = (props: Partial<Parameters<typeof SuggestionList>[0]>) =>
  renderToStaticMarkup(h(SuggestionList, { id: 'list', status: 'ready', suggestions: [apple, hospitality], highlighted: -1, onPick: noop, ...props }))

describe('SymbolSearch box', () => {
  it('is one labelled combobox with the new placeholder, collapsed until the user types', () => {
    const html = wrapped(h(SymbolSearch, { value: 'VOO', onSelect: noop }))
    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-autocomplete="list"')
    expect(html).toContain('placeholder="Search a ticker or company (VOO, Apple, …)"')
    expect(html).toContain('value="VOO"')
    expect(text(html)).toContain('Search a ticker or company')
    expect(html).not.toContain('role="listbox"')
    expect(html).not.toContain('aria-activedescendant')
  })

  it('accepts company names, not just 12 ticker characters', () => {
    const html = wrapped(h(SymbolSearch, { onSelect: noop }))
    expect(html).toContain('maxLength="80"')
    expect(html).not.toContain('autoCapitalize="characters"')
  })
})

describe('SuggestionList', () => {
  it('lists symbol (mono), name and exchange as listbox options', () => {
    const html = list({})
    expect(html).toContain('role="listbox"')
    expect(html.match(/role="option"/g)).toHaveLength(2)
    expect(html).toContain('id="list-0"')
    expect(html).toMatch(/class="t-mono[^"]*"[^>]*>AAPL</)
    expect(text(html)).toContain('Apple Inc.')
    expect(text(html)).toContain('NASDAQ')
    expect(html).not.toContain('null')
  })

  it('marks the highlighted option selected', () => {
    const html = list({ highlighted: 1 })
    expect(html).toMatch(/id="list-1"[^>]*aria-selected="true"/)
    expect(html).toMatch(/id="list-0"[^>]*aria-selected="false"/)
  })

  it('shows a quiet "Searching…" line while loading and nothing on error', () => {
    expect(text(list({ status: 'loading' }))).toBe('Searching…')
    expect(list({ status: 'loading' })).toContain('role="status"')
    expect(list({ status: 'hidden' })).toBe('')
  })

  it('says so when nothing matches', () => {
    expect(text(list({ status: 'empty', suggestions: [] }))).toContain('No matches')
  })
})

describe('one search box on the ticker page', () => {
  it('SecurityResearch has a single search input and no "Find a company by name"', () => {
    const html = wrapped(h(SecurityResearch, { initialSymbol: 'VOO' }))
    expect(html.match(/<input/g)).toHaveLength(1)
    expect(html).toContain('role="combobox"')
    expect(text(html)).not.toContain('Find a company by name')
  })

  it('guided mode renders the same box and keeps the chart collapsed', () => {
    const html = wrapped(h(ResearchWorkspace, { symbol: 'AAPL', onSymbolChange: noop, guided: true }), '/markets?symbol=AAPL&guided=1')
    expect(html).toContain('placeholder="Search a ticker or company (VOO, Apple, …)"')
    expect(text(html)).not.toContain('Find a company by name')
    expect(text(html)).toContain('Explore the share price chart')
    expect(html).not.toContain('interactive price chart')
  })
})
