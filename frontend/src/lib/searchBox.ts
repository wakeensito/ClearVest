import type { FundKind, Schemas } from '../api/client'
import { curatedMatches } from './curatedFunds'
import { isFund } from './fundExplainer'
import { advisorHref, classify, type ProviderState, type Row } from './searchIntent'

type SearchHit = Schemas['CompanySearch']['results'][number]
/**
 * One `/market/search` hit, exact ticker match sorted first by the API. The v2 fields (`kind`,
 * `leveraged`, `source`) are optional so a v1 row still served from cache never breaks the list.
 */
export type Suggestion = Omit<SearchHit, 'kind' | 'leveraged' | 'source'> & Partial<Pick<SearchHit, 'kind' | 'leveraged' | 'source'>>

export const TICKER = /^[A-Z0-9.^-]{1,12}$/
export const EMPTY_SEARCH_ERROR = 'Enter one ticker symbol, such as VOO or BRK-B.'
export const INVALID_SEARCH_ERROR = 'Type a company, fund or ticker, such as Apple, index fund or VOO.'
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

export type SubmitResult = { symbol: string } | { advisor: string } | { error: string }

/** The researchable rows of a `buildRows` list, as suggestions (the advisor row is not a symbol). */
export const rowSuggestions = (rows: readonly Row[]): Suggestion[] =>
  rows.flatMap(row => (row.type === 'advisor' ? [] : [{ symbol: row.symbol, name: row.type === 'security' ? row.name : row.symbol, exchange: null }]))

/**
 * Enter on the unified list (`buildRows` over the RAW input). A highlighted row wins: a fund, a
 * company or "Look up X as a ticker" researches its symbol, "Ask the advisor" hands off. Otherwise a
 * question goes to the advisor and text with no letters gets a hint. Everything else follows
 * `resolveSubmit` over the listed symbols, so a category word ("index fund", "ETF", "bonds")
 * researches its first curated fund and never turns into the ticker INDEX, ETF or BONDS. A name
 * with nothing listed hands off to the advisor instead of an "invalid ticker" alert.
 *
 * As with `resolveSubmit`, callers wait for a pending search first (`shouldAwaitSearch`).
 */
export function resolveRowSubmit(raw: string, rows: readonly Row[], highlighted: number): SubmitResult {
  const row = rows[highlighted]
  if (highlighted >= 0 && row) return row.type === 'advisor' ? { advisor: row.href } : { symbol: row.symbol }
  const intent = classify(raw)
  if (intent === 'empty') return { error: EMPTY_SEARCH_ERROR }
  if (intent === 'invalid') return { error: INVALID_SEARCH_ERROR }
  if (intent === 'open') return { advisor: advisorHref(raw) }
  const listed = rowSuggestions(rows)
  if (!listed.length && intent === 'name') return { advisor: advisorHref(raw) }
  return resolveSubmit(raw, listed, -1)
}

/** What a beginner can tap before typing anything (plan: unified search). */
export const DEFAULT_CHIPS = ['index fund', 'ETF', 'Apple', 'S&P 500', 'bonds'] as const

/**
 * The chips a box offers: its own list, or the default one without fund words when the box only
 * lists stocks (a "bonds" chip that can only answer "No matches" would be a broken promise).
 */
export function chipsFor(chips: readonly string[] | undefined, kinds: readonly FundKind[] | undefined): readonly string[] {
  if (chips) return chips
  if (!kinds || kinds.some(kind => isFund(kind) || kind === 'index')) return DEFAULT_CHIPS
  return DEFAULT_CHIPS.filter(chip => curatedMatches(chip).length === 0)
}


/** What the box knows about its `/market/search` call, for `buildRows`. */
export interface SearchSnapshot {
  /** The user typed (a prefilled symbol never searches). */
  typed: boolean
  /** The normalized term this draft searches, or '' for no call. */
  term: string
  /** The term after the 300 ms pause. */
  settled: string
  data?: { results: readonly Suggestion[]; unavailable?: readonly ('fmp' | 'yahoo')[]; stale?: boolean }
  isError: boolean
}

/**
 * The provider state for the raw draft. Data counts only when it answers the draft in the box now,
 * never a draft from 300 ms ago: a late answer for "app" shows nothing under "apple".
 */
export function providerState(raw: string, { typed, term, settled, data, isError }: SearchSnapshot): ProviderState {
  const text = raw.trim()
  if (!typed || term === '') return { query: text, status: 'success', results: [] }
  if (settled !== term || (!data && !isError)) return { query: '', status: 'loading', results: [] }
  if (isError || !data) return { query: text, status: 'error', results: [] }
  return { query: text, status: 'success', results: data.results, unavailable: data.unavailable, stale: data.stale }
}

/** Shift+Enter: the highlighted row (else the first) when it offers Compare; otherwise nothing. */
export function compareTarget(rows: readonly Row[], highlighted: number): string | null {
  const row = rows[highlighted] ?? (highlighted < 0 ? rows[0] : undefined)
  return row?.type === 'security' && row.compare ? row.symbol : null
}

/** Escape: close an open list first, then clear the draft; `null` lets the key through. */
export const escapeAction = (listOpen: boolean, draft: string): 'close' | 'clear' | null =>
  listOpen ? 'close' : draft ? 'clear' : null
