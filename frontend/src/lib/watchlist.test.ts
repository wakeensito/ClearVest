import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The store keeps module-level state (memory copy, listeners), so every test loads a fresh module.
async function load() {
  vi.resetModules()
  return import('./watchlist')
}

function fakeStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    removeItem: (key: string) => { data.delete(key) },
  }
}

const USER = 'user-1'
const KEY = `cv-watchlist:${USER}`

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage({ 'cv-user-id': USER }))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('parseWatchlist', () => {
  it('returns an empty list for missing or damaged data', async () => {
    const { parseWatchlist } = await load()
    expect(parseWatchlist(null)).toEqual([])
    expect(parseWatchlist('')).toEqual([])
    expect(parseWatchlist('{not json')).toEqual([])
    expect(parseWatchlist('{"symbols":["VOO"]}')).toEqual([])
    expect(parseWatchlist('"VOO"')).toEqual([])
  })

  it('uppercases symbols and drops invalid entries', async () => {
    const { parseWatchlist } = await load()
    expect(parseWatchlist(JSON.stringify(['voo', ' aapl ', 'BRK-B', '^GSPC', 'bad ticker', '', 42, null, 'WAYTOOLONGSYMBOL', 'A,B']))).toEqual(['VOO', 'AAPL', 'BRK-B', '^GSPC'])
  })

  it('drops duplicates, keeping the first (newest) position', async () => {
    const { parseWatchlist } = await load()
    expect(parseWatchlist(JSON.stringify(['VOO', 'AAPL', 'voo', 'AAPL']))).toEqual(['VOO', 'AAPL'])
  })

  it('caps the list at 20, keeping the newest', async () => {
    const { parseWatchlist, WATCHLIST_MAX } = await load()
    const symbols = Array.from({ length: 25 }, (_, i) => `S${i}`)
    const parsed = parseWatchlist(JSON.stringify(symbols))
    expect(WATCHLIST_MAX).toBe(20)
    expect(parsed).toHaveLength(20)
    expect(parsed[0]).toBe('S0')
    expect(parsed.at(-1)).toBe('S19')
  })
})

describe('toggleWatch', () => {
  it('adds and removes, returning the new watched state', async () => {
    const { toggleWatch, isWatched, getWatchlist } = await load()
    expect(isWatched('VOO')).toBe(false)
    expect(toggleWatch('voo')).toBe(true)
    expect(isWatched('VOO')).toBe(true)
    expect(isWatched('voo')).toBe(true)
    expect(getWatchlist()).toEqual(['VOO'])
    expect(toggleWatch('VOO')).toBe(false)
    expect(isWatched('VOO')).toBe(false)
    expect(getWatchlist()).toEqual([])
  })

  it('puts the newest symbol first and saves under the per-user key', async () => {
    const { toggleWatch, getWatchlist } = await load()
    toggleWatch('VOO'); toggleWatch('AAPL'); toggleWatch('QQQ')
    expect(getWatchlist()).toEqual(['QQQ', 'AAPL', 'VOO'])
    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toEqual(['QQQ', 'AAPL', 'VOO'])
  })

  it('drops the oldest symbol once the list is full', async () => {
    const { toggleWatch, getWatchlist, WATCHLIST_MAX } = await load()
    for (let i = 0; i < WATCHLIST_MAX; i++) toggleWatch(`S${i}`)
    expect(toggleWatch('NEW')).toBe(true)
    const list = getWatchlist()
    expect(list).toHaveLength(WATCHLIST_MAX)
    expect(list[0]).toBe('NEW')
    expect(list).not.toContain('S0')
  })

  it('ignores an invalid symbol', async () => {
    const { toggleWatch, getWatchlist } = await load()
    expect(toggleWatch('bad ticker')).toBe(false)
    expect(getWatchlist()).toEqual([])
  })

  it('reads an existing list from storage and hardens it', async () => {
    localStorage.setItem(KEY, JSON.stringify(['aapl', 'junk!', 'AAPL', 'VOO']))
    const { getWatchlist } = await load()
    expect(getWatchlist()).toEqual(['AAPL', 'VOO'])
  })

  it('keeps each user’s list separate', async () => {
    localStorage.setItem('cv-watchlist:someone-else', JSON.stringify(['TSLA']))
    const { getWatchlist } = await load()
    expect(getWatchlist()).toEqual([])
  })
})

describe('storage blocked', () => {
  it('falls back to memory for this page load when localStorage throws', async () => {
    const boom = () => { throw new Error('blocked') }
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom })
    const { toggleWatch, getWatchlist, isWatched } = await load()
    expect(getWatchlist()).toEqual([])
    expect(toggleWatch('VOO')).toBe(true)
    expect(toggleWatch('AAPL')).toBe(true)
    expect(getWatchlist()).toEqual(['AAPL', 'VOO'])
    expect(isWatched('VOO')).toBe(true)
  })
})
