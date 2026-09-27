// What a beginner typed, and the short, honest list it turns into (plan: unified search). Pure, so
// the combobox stays a thin view. Tiers, in order: an exact ticker, the curated funds
// (lib/curatedFunds.ts, no network), provider hits from GET /market/search, and a hand-off to the
// advisor when nothing fits or the text is a question.
//
// Run everything here on the RAW input. A search box may trim a trailing "fund"/"etf" before calling
// the provider, but "index fund" and "ETF" are exactly what the curated tier answers.

import type { FundKind, Schemas } from '../api/client'
import { curatedFund, curatedMatches, recipeOf, RECIPES, type CuratedFund } from './curatedFunds'
import { isFund, kindLabel, normalizeKind, type FundState } from './fundExplainer'

// TODO(contract): drop the intersection once docs/api/openapi.yaml ships the v2 search schema and
// `npm run gen:api` regenerates `CompanySearch` with these fields.
type SearchV2 = {
  kind?: 'etf' | 'mutual_fund' | 'stock' | 'index' | 'crypto' | 'other'
  leveraged?: boolean
  source?: 'fmp' | 'yahoo' | 'both'
}
/** One provider hit. `kind`/`leveraged`/`source` are optional until the v2 contract lands. */
export type ProviderResult = Schemas['CompanySearch']['results'][number] & SearchV2

export type Intent = 'empty' | 'invalid' | 'open' | 'ticker' | 'name'

export const MAX_ROWS = 8
export const MAX_QUERY = 80
/** Ticker-shaped: 1–6 of letters, digits, `.`, `^`, `-`, with an optional leading `$`. */
export const TICKER_LIKE = /^\$?[A-Za-z0-9.^-]{1,6}$/
const QUESTION = /^(what|whats|what's|how|why|should|which|is|are|can|could|do|does|when|who|where|will|would|explain|tell|help|i|im|i'm|my)\b/i
const words = (text: string) => text.split(/\s+/).length

/** empty | invalid (a URL, or no letters or digits) | open (a question) | ticker | name. */
export function classify(raw: string): Intent {
  const text = raw.trim()
  if (!text) return 'empty'
  if (/:\/\/|^www\./i.test(text) || !/[\p{L}\p{N}]/u.test(text)) return 'invalid'
  // A lone "is" or "do" may be a ticker; a question word only counts when more words follow.
  if (text.includes('?') || (words(text) >= 2 && QUESTION.test(text)) || words(text) > 6) return 'open'
  if (TICKER_LIKE.test(text)) return 'ticker'
  return 'name'
}

/** "brk.b", "$voo" → "BRK-B", "VOO": the symbol a ticker-shaped query researches. */
export const tickerOf = (raw: string) => raw.trim().replace(/^\$/, '').toUpperCase().replace(/\./g, '-')

/**
 * What to send to `/market/search`, or '' for no call: questions, invalid text and single
 * characters never reach the provider (the backend gates FMP name search on length again).
 */
export function providerTerm(raw: string): string {
  const intent = classify(raw)
  if (intent !== 'ticker' && intent !== 'name') return ''
  const text = raw.trim().slice(0, MAX_QUERY)
  return text.length >= 2 ? text : ''
}

/** A provider result without `kind` (v1 contract, FMP-only rows): the backend's heuristic. */
export function guessKind(result: Pick<ProviderResult, 'symbol' | 'name' | 'kind'>): FundKind {
  if (result.kind) return normalizeKind(result.kind)
  if (result.symbol.startsWith('^')) return 'index'
  if (/-USD$/.test(result.symbol)) return 'crypto'
  if (/\b(ETF|Trust)\b/i.test(result.name)) return 'etf'
  if (/^[A-Z]{4}X$/.test(result.symbol)) return 'mutual_fund'
  return 'stock'
}

export type RowGroup = 'funds' | 'companies' | 'other' | 'advisor'
export const GROUP_LABELS: Record<RowGroup, string> = {
  funds: 'Funds', companies: 'Companies', other: 'Indexes & crypto', advisor: 'Ask the advisor',
}

export interface SecurityRow {
  type: 'security'
  /** Stable, DOM-safe key; the view prefixes it with its own id. */
  id: string
  symbol: string
  name: string
  kind: FundKind
  leveraged: boolean
  /** `kindLabel()`: "Index fund (ETF)", "Company stock", "Leveraged ETF · high risk". */
  label: string
  group: Exclude<RowGroup, 'advisor'>
  from: 'curated' | 'provider'
  /** The curated plain sentence; provider rows have none. */
  oneLiner: string | null
  exchange: string | null
  /** The exact ticker the user typed. */
  exact: boolean
  /** Show "Compare with <current>". */
  compare: boolean
  /** "Same index as VOO" / "Similar mix to VTI", or null. */
  sameLabel: string | null
}

/** "Look up V as a ticker": research the typed ticker when nothing better is known. */
export interface LookupRow { type: 'lookup'; id: string; symbol: string; group: 'other' }
/** "Ask the advisor: “…” →" (`/advisor?q=`, prefilled, never submitted). */
export interface AdvisorRow { type: 'advisor'; id: string; query: string; href: string; group: 'advisor' }

export type Row = SecurityRow | LookupRow | AdvisorRow

/** What the view knows about the provider call for this box. */
export interface ProviderState {
  /** The text the data answers (the provider term it was fetched for). */
  query: string
  status: 'idle' | 'loading' | 'success' | 'error'
  results: readonly ProviderResult[]
  unavailable?: readonly ('fmp' | 'yahoo')[]
  stale?: boolean
}

export const NO_PROVIDER: ProviderState = { query: '', status: 'idle', results: [] }

export interface BuildOptions {
  provider?: ProviderState
  /** The symbol being researched now. */
  current?: string
  currentFund?: FundState
  /** Offer "Compare with …" at all (the view has an `onCompare`). */
  canCompare?: boolean
  /** Only these kinds (Compare companies passes `['stock']`). */
  kinds?: readonly FundKind[]
}

export interface Built {
  intent: Intent
  rows: Row[]
  /** For the polite live region: "6 results for “index fund”", "Searching…", … */
  status: string
  /** A quiet caption: "Previously saved results", "Live search is unavailable", or a hint. */
  notice: string | null
}

const groupOf = (kind: FundKind): SecurityRow['group'] => (isFund(kind) ? 'funds' : kind === 'stock' ? 'companies' : 'other')
const safeId = (symbol: string) => symbol.replace(/[^A-Za-z0-9]/g, char => `_${char.charCodeAt(0)}`)
export const advisorHref = (text: string) => `/advisor?q=${encodeURIComponent(text.trim().slice(0, MAX_QUERY))}`

function fromCurated(fund: CuratedFund, exact: boolean): SecurityRow {
  const kind = fund.kind
  return {
    type: 'security', id: `c-${safeId(fund.symbol)}`, symbol: fund.symbol, name: fund.name, kind, leveraged: false,
    // Every curated fund is a plain index fund (curatedFunds.test.ts pins it).
    label: kindLabel({ kind, isIndexFund: kind !== 'index', leveraged: false }), group: groupOf(kind), from: 'curated',
    oneLiner: fund.oneLiner, exchange: null, exact, compare: false, sameLabel: null,
  }
}

function fromProvider(result: ProviderResult, exact: boolean): SecurityRow {
  const symbol = tickerOf(result.symbol)
  const curated = curatedFund(symbol)
  if (curated) return { ...fromCurated(curated, exact), exchange: result.exchange ?? null }
  const kind = guessKind(result)
  const leveraged = isFund(kind) && result.leveraged === true
  return {
    type: 'security', id: `p-${safeId(symbol)}`, symbol, name: result.name, kind, leveraged,
    label: kindLabel({ kind, isIndexFund: false, leveraged }), group: groupOf(kind), from: 'provider',
    oneLiner: null, exchange: result.exchange ?? null, exact, compare: false, sameLabel: null,
  }
}

/** Groups keep the order their first row appears in; rows keep their order within a group. */
function contiguous(rows: Row[]): Row[] {
  const order: RowGroup[] = []
  for (const row of rows) if (!order.includes(row.group)) order.push(row.group)
  return order.flatMap(group => rows.filter(row => row.group === group))
}

/** Header labels only when the list has more than one group. */
export const showGroupHeaders = (rows: readonly Row[]) => new Set(rows.map(row => row.group)).size > 1

/**
 * The list for a query. Exact ticker first (only from provider data for THIS text, so fast typing
 * never shows a stale exact row), then curated funds, then provider hits not already listed, then the
 * advisor when nothing else fits (first, for a question). Capped at 8 and grouped contiguously.
 */
export function buildRows(raw: string, options: BuildOptions = {}): Built {
  const { provider = NO_PROVIDER, current, currentFund, canCompare = false, kinds } = options
  const text = raw.trim().slice(0, MAX_QUERY)
  const intent = classify(text)
  if (intent === 'empty') return { intent, rows: [], status: '', notice: null }
  if (intent === 'invalid') return { intent, rows: [], status: 'Type a company, fund or ticker', notice: 'Type a company, fund or ticker' }
  const advisor: AdvisorRow = { type: 'advisor', id: 'advisor', query: text, href: advisorHref(text), group: 'advisor' }
  if (intent === 'open') return { intent, rows: [advisor], status: 'Ask the advisor', notice: null }

  const allowed = (kind: FundKind) => !kinds || kinds.includes(kind)
  const fresh = provider.query.trim().toLowerCase() === text.toLowerCase()
  const searched = providerTerm(text) !== ''
  const loading = searched && (provider.status === 'loading' || (provider.status !== 'error' && !fresh))
  const down = searched && fresh && (provider.status === 'error' || (provider.unavailable?.length ?? 0) >= 2)
  const rows: SecurityRow[] = []
  const has = (symbol: string) => rows.some(row => row.symbol === symbol)

  const ticker = intent === 'ticker' ? tickerOf(text) : null
  let exactFound = false
  if (ticker) {
    const curated = curatedFund(ticker)
    const hit = fresh ? provider.results.find(result => tickerOf(result.symbol) === ticker) : undefined
    const row = curated ? fromCurated(curated, true) : hit ? fromProvider(hit, true) : null
    if (row && allowed(row.kind)) { rows.push(row); exactFound = true }
  }
  for (const { fund } of curatedMatches(text)) {
    if (!has(fund.symbol) && allowed(fund.kind)) rows.push(fromCurated(fund, false))
  }
  for (const result of provider.results) {
    const row = fromProvider(result, false)
    if (!has(row.symbol) && allowed(row.kind)) rows.push(row)
  }

  // Compare: only from a known, plain fund to another plain fund.
  const base = currentFund?.status === 'success' ? currentFund.fund : null
  const compareFrom = canCompare && current && base && isFund(base.kind) && !base.leveraged ? current.toUpperCase() : null
  const baseRecipe = compareFrom ? recipeOf(compareFrom, base?.tracks) : null
  for (const row of rows) {
    row.compare = !!compareFrom && isFund(row.kind) && !row.leveraged && row.symbol !== compareFrom
    const recipe = row.compare ? recipeOf(row.symbol) : null
    row.sameLabel = recipe && recipe === baseRecipe ? `${RECIPES[recipe].sameIndex ? 'Same index as' : 'Similar mix to'} ${compareFrom}` : null
  }
  const exactRows = rows.filter(row => row.exact)
  const others = rows.filter(row => !row.exact)
  const ordered: Row[] = [...exactRows, ...others.filter(row => row.sameLabel), ...others.filter(row => !row.sameLabel)]

  if (ticker && !exactFound && allowed('stock') && (ticker.length === 1 || down)) {
    ordered.unshift({ type: 'lookup', id: `l-${safeId(ticker)}`, symbol: ticker, group: 'other' })
  }
  const settled = !loading
  if (settled && ordered.length === 0) ordered.push(advisor)

  const capped = contiguous(ordered).slice(0, MAX_ROWS)
  const results = capped.filter(row => row.type === 'security').length
  const status = !searched && text.length === 1 && results === 0 ? 'Type more to see names'
    : loading && results === 0 ? 'Searching…'
      : results ? `${results} ${results === 1 ? 'result' : 'results'} for “${text}”` : 'No matches'
  const notice = down ? 'Live search is unavailable' : fresh && provider.stale ? 'Previously saved results' : null
  return { intent, rows: capped, status, notice }
}
