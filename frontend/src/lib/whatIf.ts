// Ticker-page "what would adding $X of this do to my portfolio?" math (DESIGN.md — the card itself
// is a separate task). Pure math only: no React, no fetching, no new numbers invented. Builds
// directly on lookThrough() (frontend/src/lib/lookThrough.ts) and riskScore() (frontend/src/lib/
// risk.ts) — this module never re-implements either's math, only feeds them a hypothetical
// "holdings after" account.

import type { Fund, FundKind, Holding } from '../api/client'
import { type FundMap, lookThrough } from './lookThrough'
import { currencyWhole } from './format'
import { type RiskProfile, type RiskResult, riskScore } from './risk'
import { wholePercent } from './xrayCopy'

export interface WhatIfInput {
  holdings: readonly Holding[]
  funds: FundMap
  symbol: string
  fund: Fund
  dollars: number
  profile?: RiskProfile | null
}

export interface CompanyShare {
  symbol: string | null
  name: string
  share: number
}

export interface WhatIfResult {
  /** false for index/other kinds (nothing to buy) or dollars <= 0. */
  addable: boolean
  /** Renormalized weights; the symbol's row grown or appended. Equal to the input holdings (copied) when not addable. */
  holdingsAfter: Holding[]
  riskBefore: RiskResult
  riskAfter: RiskResult
  /**
   * This company's share of the portfolio, as a fraction (0..1). A lower bound: funds are only
   * looked through their top 10 holdings, so a company can also sit, uncounted, deeper in a fund.
   */
  exposureBefore: number
  exposureAfter: number
  largestBefore: CompanyShare | null
  largestAfter: CompanyShare | null
  /** dollars / (total + dollars); 0 when not addable. */
  addedShare: number
  /** The account already holds an ETF or mutual fund, so a 0% exposure may just be unseen. */
  holdsFunds: boolean
}

/** Holding types a dollar amount can actually be added as. index/other funds aren't a position. */
type AddableType = 'equity' | 'etf' | 'mutual fund' | 'cryptocurrency'

/** Fund.kind -> Plaid-style holding type (task brief). index/other can't be "added" here. */
function mapFundKind(kind: FundKind): AddableType | null {
  switch (kind) {
    case 'stock':
      return 'equity'
    case 'etf':
      return 'etf'
    case 'mutual_fund':
      return 'mutual fund'
    case 'crypto':
      return 'cryptocurrency'
    default:
      return null // index, other
  }
}

const upperOf = (symbol: string) => symbol.trim().toUpperCase()
const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0)

/** Sum of this symbol's own portfolio weight(s) — the fund/ETF's direct share, not look-through. */
function directWeight(holdings: readonly Holding[], upper: string): number {
  return holdings.reduce((sum, h) => (upperOf(h.symbol) === upper ? sum + h.weight : sum), 0)
}

/**
 * This company's share of the portfolio. For an ETF/mutual fund being added, that's its own direct
 * weight (per the task brief); for everything else (equity, crypto, or an unmapped kind), it's the
 * look-through company share lookThrough() already computed, or just the direct weight when
 * the company falls outside lookThrough()'s top 10 — 0 when the symbol owns nothing yet.
 */
function exposureOf(holdings: readonly Holding[], lt: ReturnType<typeof lookThrough>, upper: string, mappedType: AddableType | null): number {
  if (mappedType === 'etf' || mappedType === 'mutual fund') return directWeight(holdings, upper)
  const company = lt.companies.find(c => c.symbol === upper)
  // lookThrough() keeps only the top 10 companies; below that, the direct holding is still real.
  return company ? company.share : directWeight(holdings, upper)
}

function largestOf(lt: ReturnType<typeof lookThrough>): CompanyShare | null {
  const top = lt.companies[0]
  return top ? { symbol: top.symbol, name: top.name, share: top.share } : null
}

/**
 * The hypothetical account after adding `dollars` of `symbol`: existing holdings keep their dollar
 * value (nothing is sold), so every weight shrinks to make room, and the target row's value grows
 * (or a new row is appended) before all weights are renormalized against the new total.
 */
function growHoldings(
  holdings: readonly Holding[],
  upper: string,
  fund: Fund,
  mappedType: AddableType,
  dollars: number,
  newTotal: number,
): Holding[] {
  const idx = holdings.findIndex(h => upperOf(h.symbol) === upper)
  if (idx === -1) {
    const grown = holdings.map(h => ({ ...h, weight: safeDiv(h.value, newTotal) }))
    grown.push({
      symbol: upper,
      name: fund.name,
      type: mappedType,
      price: 0,
      quantity: 0,
      value: dollars,
      weight: safeDiv(dollars, newTotal),
    })
    return grown
  }
  return holdings.map((h, i) => {
    if (i !== idx) return { ...h, weight: safeDiv(h.value, newTotal) }
    const value = h.value + dollars
    return { ...h, name: fund.name, type: mappedType, value, weight: safeDiv(value, newTotal) }
  })
}

export function whatIf(input: WhatIfInput): WhatIfResult {
  const { holdings, funds, symbol, fund, dollars, profile } = input
  const upper = upperOf(symbol)
  const mappedType = mapFundKind(fund.kind)
  const addable = mappedType !== null && dollars > 0

  const riskBefore = riskScore(holdings, profile)
  const ltBefore = lookThrough(holdings, funds)
  const exposureBefore = exposureOf(holdings, ltBefore, upper, mappedType)
  const largestBefore = largestOf(ltBefore)
  const holdsFunds = ltBefore.fundsTotal > 0

  if (!addable) {
    return {
      addable: false,
      holdingsAfter: holdings.map(h => ({ ...h })),
      riskBefore,
      riskAfter: riskBefore,
      exposureBefore,
      exposureAfter: exposureBefore,
      largestBefore,
      largestAfter: largestBefore,
      addedShare: 0,
      holdsFunds,
    }
  }

  const total = holdings.reduce((sum, h) => sum + h.value, 0)
  const newTotal = total + dollars
  const holdingsAfter = growHoldings(holdings, upper, fund, mappedType, dollars, newTotal)
  // The added fund's own top holdings must flow into look-through after, even on the first purchase.
  const fundsAfter: FundMap = { ...funds, [upper]: fund }

  const riskAfter = riskScore(holdingsAfter, profile)
  const ltAfter = lookThrough(holdingsAfter, fundsAfter)
  const exposureAfter = exposureOf(holdingsAfter, ltAfter, upper, mappedType)
  const largestAfter = largestOf(ltAfter)

  return {
    addable: true,
    holdingsAfter,
    riskBefore,
    riskAfter,
    exposureBefore,
    exposureAfter,
    largestBefore,
    largestAfter,
    addedShare: safeDiv(dollars, newTotal),
    holdsFunds,
  }
}

// Whole percents; a positive sliver reads "under 1%", never "0%" (same rule as §4.14).
const pct = wholePercent
const about = (f: number) => (f > 0 && f < 0.005 ? 'under 1%' : `about ${pct(f)}`)

/**
 * "Adding $1,000 of NVDA: NVDA would be about 22% of your money instead of 19% (counting your funds'
 * top 10 holdings), and your risk score would go from 44 to 47 out of 100 (Moderate)." Starting from
 * 0%: "… instead of none today", or, when the account holds funds (only their top 10 are counted),
 * "… instead of none we can see today". The risk label is repeated on both sides only when it
 * actually changes: "… would go from 44 (Moderate) to 68 (Aggressive) out of 100."
 */
export function whatIfSentence(r: WhatIfResult, symbol: string, dollars: number): string {
  const before = r.exposureBefore === 0 ? (r.holdsFunds ? 'none we can see today' : 'none today') : pct(r.exposureBefore)
  const exposurePart = `${symbol} would be ${about(r.exposureAfter)} of your money instead of ${before}`

  const sameLabel = r.riskBefore.label === r.riskAfter.label
  const riskPart = sameLabel
    ? `your risk score would go from ${r.riskBefore.score} to ${r.riskAfter.score} out of 100 (${r.riskAfter.label})`
    : `your risk score would go from ${r.riskBefore.score} (${r.riskBefore.label}) to ${r.riskAfter.score} (${r.riskAfter.label}) out of 100`

  return `Adding ${currencyWhole(dollars)} of ${symbol}: ${exposurePart} (counting your funds' top 10 holdings), and ${riskPart}.`
}
