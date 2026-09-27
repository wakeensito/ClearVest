// Sentences for the "What you really own" and "Your plan vs. today" cards (DESIGN.md §4.14).
// Copy only: the math lives in lookThrough.ts and targetMix.ts. Fractions in, words out; every
// number goes through format.ts.

import { expenseRatioLabel } from './fundExplainer'
import { currencyWhole, percentFromFraction } from './format'
import type { Exposure, FundFees, LookThrough } from './lookThrough'

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
export function ownershipHeadline(c: Exposure): string {
  const lead = `${displayName(c)} is ${c.share > 0 && c.share < HALF_PERCENT ? 'under 1%' : `about ${wholePercent(c.share)}`} of your money`
  const funds = joinList(c.via.map((v) => v.fund))
  if (c.via.length === 0) return `${lead}, all of it held directly.`
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
  tenYear: string | null
  cheapest: string | null
  unknown: string | null
}

const aboutDollars = (n: number) => (n < 0.5 ? 'under $1' : `about ${currencyWhole(n)}`)

/**
 * The "What it costs" sentences. `hidden` (Hide portfolio values) removes every dollar figure and
 * keeps the percents. Null when the account holds no funds at all. Never recommends a fund.
 */
export function feeCopy(fees: FundFees, hidden: boolean): FeeCopy | null {
  const unknown = fees.unknown.length ? `Fee not available: ${fees.unknown.join(', ')}` : null
  if (fees.rows.length === 0 || fees.blendedRatio == null) {
    if (!unknown) return null
    return { cost: "Fee information isn't available for your funds.", tenYear: null, cheapest: null, unknown }
  }
  if (fees.perYear === 0) return { cost: 'Your funds charge no yearly fee.', tenYear: null, cheapest: null, unknown }

  const blended = percentFromFraction(fees.blendedRatio, { digits: 2 })
  const cheapestLabel = expenseRatioLabel(fees.cheapestRatio)
  const saves = fees.ifAllCheapest != null && fees.perYear - fees.ifAllCheapest >= 1
  const whatIf = `If every fund cost what your cheapest one does (${cheapestLabel})`

  if (hidden) {
    return {
      cost: `Your funds cost about ${blended} of the money in them each year.`,
      tenYear: null,
      cheapest: saves && cheapestLabel ? `${whatIf}, you would pay less each year.` : null,
      unknown,
    }
  }
  const cost = aboutDollars(fees.perYear)
  return {
    cost: `Your funds cost ${cost} a year (${blended} of the money in them).`,
    tenYear: `At the same balance that's ${aboutDollars(fees.tenYear)} over 10 years.`,
    cheapest: saves && cheapestLabel ? `${whatIf}, it would be ${aboutDollars(fees.ifAllCheapest ?? 0)} a year.` : null,
    unknown,
  }
}

const YOUR_MIX = 'Your mix is '
const NOTHING_IN = 'Nothing in '

/**
 * targetMix.drift() sentences either stand alone ("Your mix is close…", "Nothing in bonds, where…")
 * or lack a subject ("34 points more in stocks…"); give the latter one.
 */
export function mixLead(sentence: string): string {
  return sentence.startsWith(YOUR_MIX) || sentence.startsWith(NOTHING_IN) ? sentence : `${YOUR_MIX}${sentence}`
}

/** Prefilled, never auto-sent (DESIGN.md §6.2). */
export function advisorMixHref(sentence: string): string {
  const mine = sentence.startsWith(NOTHING_IN)
    ? `My mix has nothing in ${sentence.slice(NOTHING_IN.length)}`
    : `My mix is ${sentence.startsWith(YOUR_MIX) ? sentence.slice(YOUR_MIX.length) : sentence}`
  return `/advisor?q=${encodeURIComponent(`${mine} What should a beginner understand about that?`)}`
}

/** "1 of 3 funds checked · assumes unchecked funds hold stocks"; null once every fund is checked. */
export function fundsCheckedCaption({ loaded, total, pending }: { loaded: number; total: number; pending: boolean }): string | null {
  if (total === 0 || (!pending && loaded >= total)) return null
  const base = `${loaded} of ${total} funds checked`
  return total > loaded ? `${base} · assumes unchecked funds hold stocks` : base
}
