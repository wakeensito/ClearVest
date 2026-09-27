import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VOO } from '../../lib/fundExplainer.fixtures'
import { chunk } from '../../lib/watchlist'
import { WatchButton, Watchlist } from './Watchlist'

const USER = 'watch-user'
const KEY = `cv-watchlist:${USER}`
let store: Map<string, string>

beforeEach(() => {
  store = new Map([['cv-user-id', USER]])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
  })
})
afterEach(() => { vi.unstubAllGlobals() })

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')
const series = (symbol: string, returnPct: number) => ({ symbol, returnPct, volatility: 0.1, points: [{ date: '2025-09-25', close: 100 }, { date: '2026-09-25', close: 100 * (1 + returnPct) }] })

function render(seed: (client: QueryClient) => void = () => {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } })
  seed(client)
  return renderToStaticMarkup(h(QueryClientProvider, { client }, h(MemoryRouter, { initialEntries: ['/markets'] }, h(Watchlist))))
}

describe('chunk', () => {
  it('splits symbols into groups of five for /market/history', () => {
    const symbols = Array.from({ length: 12 }, (_, i) => `S${i}`)
    expect(chunk(symbols).map(group => group.length)).toEqual([5, 5, 2])
    expect(chunk([])).toEqual([])
  })
})

describe('Watchlist', () => {
  it('shows one sentence and a VOO link when nothing is watched', () => {
    const html = render()
    expect(text(html)).toContain('Star a security on its page to keep an eye on it here.')
    expect(html).toContain('href="/markets?symbol=VOO"')
    expect(html).not.toContain('<ul')
  })

  it('renders signed 1-year returns from the shared history cache, newest first', () => {
    store.set(KEY, JSON.stringify(['QQQ', 'VOO']))
    const html = render(client => {
      client.setQueryData(['history', 'QQQ,VOO', '1y'], { series: [series('VOO', 0.1234), series('QQQ', -0.05)] })
      client.setQueryData(['fund', 'VOO'], VOO)
    })
    const words = text(html)
    expect(words).toContain('+12.34%')
    expect(words).toContain('−5.00%')
    expect(words.indexOf('QQQ')).toBeLessThan(words.indexOf('VOO'))
    expect(html).toContain('href="/markets?symbol=QQQ"')
    expect(words).toContain(VOO.name)
    // No cached name for QQQ: a dash, never a fetched or invented name.
    expect(html).toMatch(/QQQ<\/a><span[^>]*>—<\/span>/)
    expect(html).toContain('aria-label="Remove VOO from watchlist"')
    expect(html).toContain('aria-label="Remove QQQ from watchlist"')
  })

  it('shows loading dots for a symbol whose history is still being prepared', () => {
    store.set(KEY, JSON.stringify(['NEW', 'VOO']))
    const html = render(client => {
      client.setQueryData(['history', 'NEW,VOO', '1y'], {
        series: [series('VOO', 0.02)], refreshing: true,
        refresh: [{ symbol: 'NEW', status: 'pending', fetchedAt: null, requestedAt: null }, { symbol: 'VOO', status: 'ready', fetchedAt: null, requestedAt: null }],
      })
    })
    expect(html).toContain('aria-label="Loading NEW 1-year return"')
    expect(text(html)).toContain('+2.00%')
  })
})

describe('WatchButton', () => {
  const button = (symbol: string) => renderToStaticMarkup(h(WatchButton, { symbol }))
  it('reads Watch, not pressed, with an outlined star when the symbol is not watched', () => {
    const html = button('VOO')
    expect(html).toContain('aria-pressed="false"')
    expect(text(html)).toContain('Watch')
    expect(text(html)).not.toContain('Watching')
    expect(html).toContain('fill="none"')
  })

  it('reads Watching, pressed, with a filled star once watched', () => {
    store.set(KEY, JSON.stringify(['VOO']))
    const html = button('voo')
    expect(html).toContain('aria-pressed="true"')
    expect(text(html)).toContain('Watching')
    expect(html).toContain('fill="currentColor"')
  })
})
