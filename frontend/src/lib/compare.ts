import type { components } from '../api/schema'
import { currency, direction, multiple, percentFromFraction } from './format'

export type Company = components['schemas']['Company']

// The API takes 2 to 4 symbols; fewer or more is a 400 (docs/api/openapi.yaml).
export const MIN_SYMBOLS = 2
export const MAX_SYMBOLS = 4
const SYMBOL = /^[A-Z0-9.^-]{1,12}$/

/** Trims, uppercases and dedupes tickers. Anything failing the backend's 12-character rule lands in `invalid`. */
export function normalizeSymbols(raw: readonly string[]): { symbols: string[]; invalid: string[] } {
  const symbols: string[] = []
  const invalid: string[] = []
  for (const item of raw) {
    const symbol = item.trim().toUpperCase()
    if (!symbol || symbols.includes(symbol)) continue
    if (SYMBOL.test(symbol)) symbols.push(symbol)
    else invalid.push(item.trim())
  }
  return { symbols, invalid }
}

/** Why a set can't be compared yet, or null when it can. */
export function symbolsError(symbols: readonly string[]): string | null {
  if (symbols.length < MIN_SYMBOLS) return 'Add at least two tickers to compare.'
  if (symbols.length > MAX_SYMBOLS) return 'Compare up to four tickers at a time.'
  return null
}

/** `?compare=AMD,NVDA` → a valid set of tickers, or the fallback when the param can't be compared. */
export function symbolsFromParam(value: string | null | undefined, fallback: string[]): string[] {
  if (!value) return fallback
  const { symbols } = normalizeSymbols(value.split(','))
  return symbolsError(symbols) ? fallback : symbols
}

export type MetricKey = Exclude<keyof Company, 'symbol'>

export interface Metric {
  key: MetricKey
  label: string
  /** One plain sentence for the first-use explanation (DESIGN.md §12). */
  explain: string
  format: (value: number | null) => string
  /** Color the value by sign, like a return. Only growth; a high or low ratio is not good or bad by itself. */
  signed?: boolean
}

// Units per DESIGN.md §10: pe/ps/debtToEquity are ratios, margin and growth are fractions, eps and fcf are dollars per share.
export const METRICS: readonly Metric[] = [
  { key: 'pe', label: 'Price to earnings', explain: 'Share price divided by earnings per share over the last year.', format: multiple },
  { key: 'ps', label: 'Price to sales', explain: 'Market value divided by revenue over the last year.', format: multiple },
  { key: 'grossMargin', label: 'Gross margin', explain: 'Revenue left after the direct cost of what was sold.', format: (v) => percentFromFraction(v) },
  { key: 'revenueGrowth', label: 'Revenue growth', explain: 'Change in revenue versus the year before.', format: (v) => percentFromFraction(v, { signed: true }), signed: true },
  { key: 'epsTTM', label: 'Earnings per share', explain: 'Profit per share over the trailing twelve months.', format: currency },
  { key: 'fcfPerShare', label: 'Free cash flow per share', explain: 'Cash left after running and investing in the business, per share.', format: currency },
  { key: 'debtToEquity', label: 'Debt to equity', explain: 'Total debt relative to shareholder equity. Higher means more borrowing.', format: multiple },
]

/** Tone class for a cell: gain or loss for signed metrics, otherwise none. */
export function metricTone(metric: Metric, value: number | null): 'c-gain' | 'c-loss' | '' {
  if (!metric.signed) return ''
  const d = direction(value)
  return d > 0 ? 'c-gain' : d < 0 ? 'c-loss' : ''
}

/** Columns in request order, matched case-insensitively, plus the requested tickers the API didn't return. */
export function arrangeCompanies(requested: readonly string[], companies: readonly Company[]): { companies: Company[]; missing: string[] } {
  const ordered: Company[] = []
  const missing: string[] = []
  for (const symbol of requested) {
    const match = companies.find((c) => c.symbol.toUpperCase() === symbol.toUpperCase())
    if (match) ordered.push(match)
    else missing.push(symbol)
  }
  return { companies: ordered, missing }
}
