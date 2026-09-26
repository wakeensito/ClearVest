import type { components } from '../api/schema'
type AnnualIncome = components['schemas']['AnnualIncome']
type CompanyResearch = components['schemas']['CompanyResearch']

export function financialAmount(value: number | null | undefined, currency?: string | null, compact = false): string {
  if (value == null || !Number.isFinite(value)) return 'Not available'
  const options: Intl.NumberFormatOptions = { maximumFractionDigits: compact ? 1 : 2, notation: compact ? 'compact' : 'standard' }
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
