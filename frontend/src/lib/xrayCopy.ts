// Sentences for the "What you really own" and "Your plan vs. today" cards (DESIGN.md §4.14).
// Copy only: the math lives in lookThrough.ts and targetMix.ts. Fractions in, words out; every
// number goes through format.ts.

import { expenseRatioLabel, feePerTenThousand, NO_FEE } from './fundExplainer'
import { currencyWhole, percentFromFraction } from './format'
import type { Exposure, FundFees, LookThrough } from './lookThrough'
import { MIX_LABEL } from './targetMix'

const HALF_PERCENT = 0.005

/** 0.1932 → "19%"; a positive sliver under half a percent → "under 1%", never "0%". */
export function wholePercent(f: number): string {
  if (f > 0 && f < HALF_PERCENT) return 'under 1%'
  return percentFromFraction(f, { digits: 0 })
}

/** "VOO", "VOO and QQQ", "VOO, QQQ and VGT". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const displayName = (c: Exposure) => c.name || c.symbol || 'This company'

/**
 * "Apple is about 19% of your money: 14% directly, 5% inside VOO, QQQ and VGT."
 * The fund part is the rounded total minus the rounded direct part, so the two parts always add
 * up to the headline number on screen.
 */
export function ownershipHeadline(c: Exposure, { unopened = 0, checking = false }: { unopened?: number; checking?: boolean } = {}): string {
  const lead = `${displayName(c)} is ${c.share > 0 && c.share < HALF_PERCENT ? 'under 1%' : `about ${wholePercent(c.share)}`} of your money`
  const funds = joinList(c.via.map((v) => v.fund))
  if (c.via.length === 0) {
    // "All of it held directly" is only true once every fund has been looked inside.
    if (unopened > 0) {
      const which = `${unopened} of your funds`
      return checking ? `${lead}, held directly (still looking inside ${which}).` : `${lead}, held directly (we couldn't look inside ${which}).`
    }
    return `${lead}, all of it held directly.`
  }
  if (!(c.direct > 0)) return `${lead}, all of it inside ${funds}.`
  const totalPoints = Math.round(c.share * 100)
  const directPoints = Math.round(c.direct * 100)
  const viaPoints = Math.max(totalPoints - directPoints, 0)
  const directText = directPoints === 0 ? 'under 1%' : `${directPoints}%`
  const viaText = viaPoints === 0 ? 'under 1%' : `${viaPoints}%`
  return `${lead}: ${directText} directly, ${viaText} inside ${funds}.`
}

/** "14% direct · VOO 3% · QQQ 2%", dropping any part under half a percent. */
export function viaLine(c: Exposure): string {
  const parts: string[] = []
  if (c.direct >= HALF_PERCENT) parts.push(`${wholePercent(c.direct)} direct`)
  for (const v of c.via) if (v.share >= HALF_PERCENT) parts.push(`${v.fund} ${wholePercent(v.share)}`)
  return parts.join(' · ')
}

/** "Your top 7 companies are 52% of everything." Null with fewer than two companies. */
export function topCompaniesLine(lt: Pick<LookThrough, 'companies' | 'topShare'>, top = 7): string | null {
  const n = Math.min(top, lt.companies.length)
  if (n < 2) return null
  return `Your top ${n} companies are ${wholePercent(lt.topShare(n))} of everything.`
}

/** The 12px data line under the company rows. `asOf` arrives already formatted. */
export function coverageCaption({ checked, total, coverage, asOf }: { checked: number; total: number; coverage: number; asOf: string }): string {
  if (total === 0) return `Based on your holdings as of ${asOf}`
  const base = `Counting each fund's top 10 holdings (${checked} of ${total} funds checked) · as of ${asOf}`
  return coverage < 0.5 ? `${base} · funds' smaller holdings aren't counted` : base
}

export interface FeeCopy {
  cost: string
  /** "That's about $8 a year on every $10,000." A rate, so Hide portfolio values keeps it. */
  perTenThousand: string | null
  tenYear: string | null
  cheapest: string | null
  /** Funds that loaded without a fee, or whose request failed. */
  unknown: string | null
  /** Funds never requested (past the 8-fund cap, or not a valid ticker). */
  notChecked: string | null
}

export const FEES_PENDING = 'Adding up fees…'

const aboutDollars = (n: number) => (n < 0.5 ? 'under $1' : `about ${currencyWhole(n)}`)

/** The blended ratio on every $10,000; null without a positive rate. */
function perTenThousandLine(ratio: number | null): string | null {
  const fee = feePerTenThousand(ratio)
  if (fee === null || fee === NO_FEE) return null
  return fee === 'under $1' ? 'Under $1 a year on every $10,000.' : `That's about ${fee} a year on every $10,000.`
}

/**
 * The "What it costs" sentences, for settled fee data (the card shows FEES_PENDING while any
 * requested fund is still loading). `notChecked` are funds never requested; every other fund in
 * `fees.unknown` loaded without a fee or failed. `hidden` (Hide portfolio values) removes every
 * dollar figure and keeps the percents. Null when the account holds no funds. Never recommends a fund.
 */
export function feeCopy(fees: FundFees, hidden: boolean, { notChecked = [] }: { notChecked?: readonly string[] } = {}): FeeCopy | null {
  const skipped = new Set(notChecked.map((s) => s.trim().toUpperCase()))
  const unavailable = fees.unknown.filter((s) => !skipped.has(s.trim().toUpperCase()))
  const skippedHeld = fees.unknown.filter((s) => skipped.has(s.trim().toUpperCase()))
  const unknown = unavailable.length ? `Fee not available: ${unavailable.join(', ')}` : null
  const notCheckedLine = skippedHeld.length ? `Not checked: ${skippedHeld.join(', ')}` : null
  const tail = { unknown, notChecked: notCheckedLine }
  if (fees.rows.length === 0 || fees.blendedRatio == null) {
    if (!unknown && !notCheckedLine) return null
    return { cost: "Fee information isn't available for your funds.", perTenThousand: null, tenYear: null, cheapest: null, ...tail }
  }
  // Some funds' fees are missing: say whose cost this is rather than undercount "your funds".
  const who = fees.unknown.length ? 'The funds we could check' : 'Your funds'
  if (fees.perYear === 0) return { cost: `${who} charge no yearly fee.`, perTenThousand: null, tenYear: null, cheapest: null, ...tail }

  const blended = percentFromFraction(fees.blendedRatio, { digits: 2 })
  const cheapestLabel = expenseRatioLabel(fees.cheapestRatio)
  const saves = fees.ifAllCheapest != null && fees.perYear - fees.ifAllCheapest >= 1
  const whatIf = `If every fund cost what your cheapest one does (${cheapestLabel})`
  const perTenThousand = perTenThousandLine(fees.blendedRatio)

  if (hidden) {
    return {
      cost: `${who} cost about ${blended} of the money in them each year.`,
      perTenThousand,
      tenYear: null,
      cheapest: saves && cheapestLabel ? `${whatIf}, you would pay less each year.` : null,
      ...tail,
    }
  }
  const cost = aboutDollars(fees.perYear)
  return {
    cost: `${who} cost ${cost} a year (${blended} of the money in them).`,
    perTenThousand,
    tenYear: `At the same balance that's ${aboutDollars(fees.tenYear)} over 10 years.`,
    cheapest: saves && cheapestLabel ? `${whatIf}, it would be ${aboutDollars(fees.ifAllCheapest ?? 0)} a year.` : null,
    ...tail,
  }
}

const YOUR_MIX = 'Your mix is '
const NOTHING_IN = 'Nothing in '
const CLASS_LEAD = new RegExp(`^(${Object.values(MIX_LABEL).join('|')}): `)

/**
 * Prefilled, never auto-sent (DESIGN.md §6.2): the drift() sentence in the first person.
 * "Stocks: 94% today vs 60% in the … plan" → "My mix has stocks at 94% today vs 60% in the … plan";
 * "Nothing in bonds, where …" → "My mix has nothing in bonds, where …"; "Your mix is close …" → "My mix is close …".
 */
export function advisorMixHref(sentence: string): string {
  const lead = CLASS_LEAD.exec(sentence)
  const mine = sentence.startsWith(NOTHING_IN)
    ? `My mix has nothing in ${sentence.slice(NOTHING_IN.length)}`
    : lead
      ? `My mix has ${(lead[1] ?? '').toLowerCase()} at ${sentence.slice(lead[0].length)}`
      : `My mix is ${sentence.startsWith(YOUR_MIX) ? sentence.slice(YOUR_MIX.length) : sentence}`
  return `/advisor?q=${encodeURIComponent(`${mine} What should a beginner understand about that?`)}`
}

/** "1 of 3 funds checked · assumes unchecked funds hold stocks"; null once every fund is checked. */
export function fundsCheckedCaption({ loaded, total, pending }: { loaded: number; total: number; pending: boolean }): string | null {
  if (total === 0 || (!pending && loaded >= total)) return null
  const base = `${loaded} of ${total} funds checked`
  return total > loaded ? `${base} · assumes unchecked funds hold stocks` : base
}
