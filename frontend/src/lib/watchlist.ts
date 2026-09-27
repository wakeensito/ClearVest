// Watched securities live on this device, per demo user (like researchProgress.ts). Newest first.
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { read, write } from './storage'
import { getUserId } from './userId'

export const WATCHLIST_MAX = 20
const SYMBOL = /^[A-Z0-9.^-]{1,12}$/

const listeners = new Set<() => void>()
// Keep a session copy when browser storage is blocked. Serialized snapshots stay stable for React.
const memory = new Map<string, string>()
const key = () => `cv-watchlist:${getUserId()}`
function snapshot(): string { const id = key(); return memory.get(id) ?? read(id) ?? '' }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }

const normalize = (symbol: unknown) => typeof symbol === 'string' ? symbol.trim().toUpperCase() : ''

/** Ignore damaged data, invalid symbols and duplicates; keep at most the newest WATCHLIST_MAX. */
export function parseWatchlist(raw: string | null): string[] {
  if (!raw) return []
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return [] }
  if (!Array.isArray(parsed)) return []
  const symbols: string[] = []
  for (const item of parsed) {
    const symbol = normalize(item)
    if (SYMBOL.test(symbol) && !symbols.includes(symbol)) symbols.push(symbol)
    if (symbols.length === WATCHLIST_MAX) break
  }
  return symbols
}

export function getWatchlist(): string[] { return parseWatchlist(snapshot()) }

export function isWatched(symbol: string): boolean { return getWatchlist().includes(normalize(symbol)) }

/** Star or unstar a symbol. Returns the new watched state; adding past the cap drops the oldest. */
export function toggleWatch(symbol: string): boolean {
  const target = normalize(symbol)
  if (!SYMBOL.test(target)) return false
  const current = getWatchlist()
  const watched = !current.includes(target)
  const next = watched ? [target, ...current].slice(0, WATCHLIST_MAX) : current.filter(item => item !== target)
  const value = JSON.stringify(next)
  memory.set(key(), value)
  write(key(), value)
  listeners.forEach(listener => listener())
  return watched
}

export function useWatchlist(): { symbols: string[]; watched(symbol: string): boolean; toggle(symbol: string): boolean } {
  // Client-only app: the server snapshot is the same read, so static-render tests see seeded storage.
  const raw = useSyncExternalStore(subscribe, snapshot, snapshot)
  const symbols = useMemo(() => parseWatchlist(raw), [raw])
  const watched = useCallback((symbol: string) => symbols.includes(normalize(symbol)), [symbols])
  return { symbols, watched, toggle: toggleWatch }
}
