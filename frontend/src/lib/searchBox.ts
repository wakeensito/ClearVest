import type { Schemas } from '../api/client'

/** One `/market/search` hit: `{symbol, name, exchange}`, exact ticker match sorted first by the API. */
export type Suggestion = Schemas['CompanySearch']['results'][number]

export const TICKER = /^[A-Z0-9.^-]{1,12}$/
export const EMPTY_SEARCH_ERROR = 'Enter one ticker symbol, such as VOO or BRK-B.'
export const MIN_SEARCH_LENGTH = 2
export const MAX_SUGGESTIONS = 8

/** What to look up for a draft: the trimmed text, or '' (no request) below two characters. */
export const searchTerm = (input: string) => {
  const term = input.trim()
  return term.length >= MIN_SEARCH_LENGTH ? term : ''
}

/**
 * Enter on the search box. A highlighted suggestion wins. A ticker-shaped draft goes straight to the
 * chart (no round trip) unless suggestions are showing and none of them is that ticker: "apple" is
 * ticker-shaped too, and the user meant Apple Inc. Otherwise the first suggestion; with none yet,
 * the existing alert copy.
 */
export function resolveSubmit(input: string, suggestions: readonly Suggestion[], highlighted: number): { symbol: string } | { error: string } {
  const draft = input.trim().toUpperCase()
  if (!draft) return { error: EMPTY_SEARCH_ERROR }
  const picked = suggestions[highlighted]
  if (highlighted >= 0 && picked) return { symbol: picked.symbol }
  const ticker = TICKER.test(draft)
  if (ticker && (suggestions.length === 0 || suggestions.some((item) => item.symbol.toUpperCase() === draft))) return { symbol: draft }
  if (suggestions[0]) return { symbol: suggestions[0].symbol }
  return ticker ? { symbol: draft } : { error: EMPTY_SEARCH_ERROR }
}

/** ArrowDown/ArrowUp: step through the options; past either end returns to the input (-1). */
export function moveHighlight(current: number, step: 1 | -1, count: number) {
  if (count === 0) return -1
  if (current === -1) return step === 1 ? 0 : count - 1
  const next = current + step
  return next < 0 || next >= count ? -1 : next
}
