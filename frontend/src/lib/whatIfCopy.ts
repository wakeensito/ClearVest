// Copy and input rules for the ticker-page "What would this do to my portfolio?" card
// (DESIGN.md §4.15). The math lives in whatIf.ts; this file only turns its results into words and
// reads the amount box. No numbers are invented here.

import type { CompanyShare } from './whatIf'

export const AMOUNT_MIN = 1
export const AMOUNT_MAX = 1_000_000

export type ParsedAmount = { status: 'empty' } | { status: 'invalid' } | { status: 'ok'; dollars: number }

/** "$2,500" / "2500" / "12.50" → dollars; blank → use the preset; anything else → invalid. */
export function parseAmount(raw: string): ParsedAmount {
  const cleaned = raw.trim().replace(/^\$/, '').replace(/,/g, '')
  if (raw.trim() === '') return { status: 'empty' }
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { status: 'invalid' }
  const dollars = Number(cleaned)
  if (!(dollars >= AMOUNT_MIN && dollars <= AMOUNT_MAX)) return { status: 'invalid' }
  return { status: 'ok', dollars }
}

/** "NVDA would become your biggest single company." only when the top company actually changes. */
export function biggestCompanyLine(before: CompanyShare | null, after: CompanyShare | null): string | null {
  if (!after) return null
  const key = (c: CompanyShare) => c.symbol ?? c.name
  if (before && key(before) === key(after)) return null
  return `${after.symbol ?? after.name} would become your biggest single company.`
}

/** The 12px data line under the figures. */
export function whatIfCaption({ checked, total }: { checked: number; total: number }): string {
  const basis = total > 0 ? `Counting each fund's top 10 holdings (${checked} of ${total} funds checked).` : 'Based on your holdings.'
  return `${basis} Educational, not a recommendation.`
}
