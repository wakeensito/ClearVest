import type { components } from '../api/schema'
import { multiple, percentFromFraction } from './format'
type AnnualIncome = components['schemas']['AnnualIncome']
type CompanyResearch = components['schemas']['CompanyResearch']

export function financialAmount(value: number | null | undefined, currency?: string | null, compact = false): string {
  if (value == null || !Number.isFinite(value)) return 'Not available'
  // minimumFractionDigits is explicit: Node 22 and 25 disagree on the currency default in compact notation ("5.0T" vs "5T").
  const options: Intl.NumberFormatOptions = { ...(compact && { minimumFractionDigits: 0 }), maximumFractionDigits: compact ? 1 : 2, notation: compact ? 'compact' : 'standard' }
  if (currency && /^[A-Z]{3}$/.test(currency)) Object.assign(options, { style: 'currency', currency, currencyDisplay: 'code' })
  return new Intl.NumberFormat('en-US', options).format(value)
}

/** Only consecutive annual periods in the same known reporting currency are comparable. */
export function revenueChange(rows: AnnualIncome[]): number | null {
  const [latest, prior] = rows
  if (!latest || !prior || !latest.currency || latest.currency !== prior.currency || Number(latest.year) - Number(prior.year) !== 1 || latest.revenue == null || prior.revenue == null || prior.revenue <= 0) return null
  const change = (latest.revenue - prior.revenue) / prior.revenue
  return Number.isFinite(change) ? change : null
}

export function historicalPE(rows: CompanyResearch['history']): { median: number; count: number } | null {
  const valid = rows.map(row => row.pe).filter((value): value is number => value != null && Number.isFinite(value) && value > 0).sort((a, b) => a - b)
  if (valid.length < 3) return null
  const middle = Math.floor(valid.length / 2)
  return { median: valid.length % 2 ? valid[middle]! : valid[middle - 1]! / 2 + valid[middle]! / 2, count: valid.length }
}

export function usablePE(pe: number | null | undefined, eps?: number | null): number | null {
  return pe != null && Number.isFinite(pe) && pe > 0 && !(eps != null && eps <= 0) ? pe : null
}

/** Neutral comparison of today's trailing P/E with its own multi-year middle value. No verdicts.
 *  `years` is how many annual observations the median uses, so the sentence never claims more history than it has. */
export function peVersusUsual(pe: number | null | undefined, median: number | null | undefined, years = 5): string | null {
  const today = usablePE(pe), usual = usablePE(median)
  if (today === null || usual === null) return null
  if (today >= usual * 1.15) return `Investors are paying more than usual for each dollar of profit: ${multiple(today)} today vs about ${multiple(usual)} across ${years} recent years.`
  if (today <= usual * 0.85) return `Investors are paying less than usual for each dollar of profit: ${multiple(today)} today vs about ${multiple(usual)} across ${years} recent years.`
  return `About the same as its usual ${multiple(usual)}.`
}

/** `dividendYield` arrives as a fraction (0.0045 = 0.45%). 0 is a reported "no dividend";
 *  null (or anything unusable) is unknown and must never be read as "pays nothing". */
export function dividendYieldLabel(dividendYield: number | null | undefined): string {
  if (dividendYield == null || !Number.isFinite(dividendYield) || dividendYield < 0) return 'Not available'
  return dividendYield === 0 ? 'No dividend' : percentFromFraction(dividendYield, { digits: 2 })
}

export function dividendSentence(dividendYield: number | null | undefined): string {
  if (dividendYield == null || !Number.isFinite(dividendYield) || dividendYield < 0) return 'Dividend information isn’t available for this company.'
  if (dividendYield === 0) return 'This company has not paid a cash dividend over the last 12 months. Any return would come from the share price changing.'
  return `Each year the company pays out about ${percentFromFraction(dividendYield, { digits: 2 })} of its share price in cash.`
}

export function marketCapSentence(marketCap: number | null | undefined, currency?: string | null): string | null {
  if (marketCap == null || !Number.isFinite(marketCap) || marketCap <= 0) return null
  return `Worth about ${financialAmount(marketCap, currency, true)} on the market`
}
