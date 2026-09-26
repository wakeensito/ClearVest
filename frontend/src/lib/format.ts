// Every number on screen goes through here (DESIGN.md §10). Check the units table there before
// adding a caller: weights and returns arrive as fractions, macro figures are already percentages.

type Num = number | null | undefined

export const MISSING = '—'
const MINUS = '−'

const isNum = (n: Num): n is number => typeof n === 'number' && Number.isFinite(n)
const trueMinus = (s: string) => s.replace('-', MINUS)

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usdSigned = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', signDisplay: 'exceptZero' })
const usdCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
})

/** `$10,000.00` */
export function currency(n: Num): string {
  return isNum(n) ? trueMinus(usd.format(n)) : MISSING
}

const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/** `$10,000`, rounded to whole dollars. For illustrations, not account balances. */
export function currencyWhole(n: Num): string {
  return isNum(n) ? trueMinus(usdWhole.format(n)) : MISSING
}

/** `$1.23M` at or above $1M, otherwise full currency. */
export function currencyCompact(n: Num): string {
  if (!isNum(n)) return MISSING
  return Math.abs(n) >= 1_000_000 ? trueMinus(usdCompact.format(n)) : currency(n)
}

/** `+$123.45`, `−$5.00`, `$0.00` */
export function signedCurrency(n: Num): string {
  return isNum(n) ? trueMinus(usdSigned.format(n)) : MISSING
}

/** Splits `$10,000.00` into `$10,000` and `.00` so the hero can set cents smaller. */
export function currencyParts(n: Num): { whole: string; cents: string } {
  const s = currency(n)
  const dot = s.lastIndexOf('.')
  return dot === -1 ? { whole: s, cents: '' } : { whole: s.slice(0, dot), cents: s.slice(dot) }
}

function pct(value: number, digits: number, signed: boolean): string {
  const f = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? 'exceptZero' : 'auto',
  })
  return `${trueMinus(f.format(value))}%`
}

/** For values that arrive as fractions (0.5 → `50.0%`): weights, allocations, returnPct, volatility, margins. */
export function percentFromFraction(f: Num, { digits = 1, signed = false } = {}): string {
  return isNum(f) ? pct(f * 100, digits, signed) : MISSING
}

/** For values that are already percentages (4.33 → `4.33%`): every `/market/macro` figure. */
export function percent(p: Num, { digits = 2, signed = false } = {}): string {
  return isNum(p) ? pct(p, digits, signed) : MISSING
}

/** `65.4×`: P/E, P/S, debt-to-equity. */
export function multiple(n: Num): string {
  if (!isNum(n)) return MISSING
  return `${trueMinus(n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 }))}×`
}

/** Up to 4 decimals, trailing zeros dropped. */
export function quantity(n: Num): string {
  return isNum(n) ? trueMinus(n.toLocaleString('en-US', { maximumFractionDigits: 4 })) : MISSING
}

/** -1, 0 or 1, for picking gain or loss color. */
export function direction(n: Num): -1 | 0 | 1 {
  if (!isNum(n) || n === 0) return 0
  return n > 0 ? 1 : -1
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Parses API dates. Date-only strings ("2026-08-01") are read as local dates: `new Date()` would
 * treat them as UTC midnight and show the previous day in US time zones.
 */
export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = DATE_ONLY.exec(s)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const timestampFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** `Sep 26, 2026` */
export function date(s: string | null | undefined): string {
  const d = parseDate(s)
  return d ? dateFmt.format(d) : MISSING
}

/** `Sep 26, 2026, 2:14 PM` for full timestamps; a plain date for date-only strings. */
export function timestamp(s: string | null | undefined): string {
  if (s && DATE_ONLY.test(s)) return date(s)
  const d = parseDate(s)
  return d ? timestampFmt.format(d) : MISSING
}

/** Security history omits currency metadata, so never imply USD for arbitrary symbols. */
export function marketPrice(n: Num): string {
  return isNum(n) ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : MISSING
}
