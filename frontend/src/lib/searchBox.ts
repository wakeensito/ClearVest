import type { Schemas } from '../api/client'

/** One `/market/search` hit: `{symbol, name, exchange}`, exact ticker match sorted first by the API. */
export type Suggestion = Schemas['CompanySearch']['results'][number]

export const TICKER = /^[A-Z0-9.^-]{1,12}$/
export const EMPTY_SEARCH_ERROR = 'Enter one ticker symbol, such as VOO or BRK-B.'
export const MIN_SEARCH_LENGTH = 2
export const MAX_SUGGESTIONS = 8

const TRAILING_WORD = /\s+(?:stocks?|shares?|ticker|etf|fund)$/i

/**
 * What people type, reduced to what they mean: trimmed, one leading `$` dropped ("$AAPL"), and one
 * trailing "stock", "stocks", "share", "shares", "ticker", "etf" or "fund" dropped ("apple stock").
 * A lone keyword ("stock") is left alone.
 */
export function normalizeQuery(raw: string): string {
  const trimmed = raw.trim()
  const bare = (trimmed.startsWith('$') ? trimmed.slice(1) : trimmed).trim()
  return bare.replace(TRAILING_WORD, '').trim()
}

/** What to look up for a draft: the normalized text, or '' (no request) below two characters. */
export const searchTerm = (input: string) => {
  const term = normalizeQuery(input)
  return term.length >= MIN_SEARCH_LENGTH ? term : ''
}

/**
 * Enter on the search box. A highlighted suggestion wins. A ticker-shaped draft goes straight to the
 * chart (no round trip) unless suggestions are showing and none of them is that ticker: "apple" is
 * ticker-shaped too, and the user meant Apple Inc. Otherwise the first suggestion; with none yet,
 * the existing alert copy.
 *
 * Callers must not call this while a search for the draft is pending (see `shouldAwaitSearch`):
 * with `[]`, "apple" resolves to the ticker APPLE.
 */
export function resolveSubmit(input: string, suggestions: readonly Suggestion[], highlighted: number): { symbol: string } | { error: string } {
  const draft = normalizeQuery(input).toUpperCase()
  if (!draft) return { error: EMPTY_SEARCH_ERROR }
  const picked = suggestions[highlighted]
  if (highlighted >= 0 && picked) return { symbol: picked.symbol }
  const ticker = TICKER.test(draft)
  if (ticker && (suggestions.length === 0 || suggestions.some((item) => item.symbol.toUpperCase() === draft))) return { symbol: draft }
  if (suggestions[0]) return { symbol: suggestions[0].symbol }
  return ticker ? { symbol: draft } : { error: EMPTY_SEARCH_ERROR }
}

/**
 * Enter must never race the search. Wait for it when the draft is searched at all (two or more
 * characters) and its search has not settled or is still loading, unless a listed suggestion is
 * already exactly the typed ticker. Names wait too, so a quick Enter never shows the alert mid-search.
 */
export function shouldAwaitSearch(draft: string, settled: boolean, loading: boolean, suggestions: readonly Suggestion[]) {
  if (!searchTerm(draft)) return false
  const upper = normalizeQuery(draft).toUpperCase()
  if (suggestions.some((item) => item.symbol.toUpperCase() === upper)) return false
  return !settled || loading
}

/** ArrowDown/ArrowUp: step through the options; past either end returns to the input (-1). */
export function moveHighlight(current: number, step: 1 | -1, count: number) {
  if (count === 0) return -1
  if (current === -1) return step === 1 ? 0 : count - 1
  const next = current + step
  return next < 0 || next >= count ? -1 : next
}
