// "Your plan vs. today": compare a client's actual stocks/bonds/cash/other mix against a model
// portfolio template chosen from their investment profile, and say the gap in one plain sentence.
// Pure math + a static ticker map — no LLM calls (DESIGN.md rule: never invent numbers).

import type { Fund, Holding } from '../api/client'
import type { components } from '../api/schema'
import { normalizeType } from './assetTypes'
import { percentFromFraction } from './format'

export type Template = components['schemas']['Template']
export type Profile = components['schemas']['Profile']

export type MixClass = 'stocks' | 'bonds' | 'cash' | 'other'
/** Fractions; sum to 1, or all 0 for an empty account. */
export type Mix = Record<MixClass, number>

export const MIX_ORDER: MixClass[] = ['stocks', 'bonds', 'cash', 'other']
export const MIX_LABEL: Record<MixClass, string> = {
  stocks: 'Stocks',
  bonds: 'Bonds',
  cash: 'Cash',
  other: 'Other',
}

const zeroMix = (): Mix => ({ stocks: 0, bonds: 0, cash: 0, other: 0 })

// Fund category text (yfinance-style strings, e.g. "Intermediate-Term Bond", "Money Market",
// "Large Blend") — checked only for etf/mutual fund holdings, in this priority order. "Income" on
// its own is not bonds: "Derivative Income" (JEPI) and "Equity Income" funds hold stocks.
const BOND_CATEGORY = /bond|treasury|fixed income|muni(cipal)?\b|aggregate/i
const CASH_CATEGORY = /money market|cash/i
const OTHER_CATEGORY = /commodit|gold|real estate|reit/i

// Static ticker → class map for every ticker used across templates.json. Unknown ticker → other.
const TICKER_CLASS: Record<string, MixClass> = {
  VTI: 'stocks',
  VXUS: 'stocks',
  VOO: 'stocks',
  BND: 'bonds',
  BNDX: 'bonds',
  TLT: 'bonds',
  IEI: 'bonds',
  SHV: 'cash',
  GLD: 'other',
  DBC: 'other',
}

/**
 * Plaid `type` decides most holdings outright. `etf`/`mutual fund` need the fund's `category` to
 * tell stocks from bonds/cash/other; with no fund loaded yet, an unknown fund is assumed to be a
 * stock fund (the UI shows "N of M funds checked" while funds are still loading).
 */
export function classify(holding: Holding, fund?: Fund | null): MixClass {
  // The template tickers are known outright (SHV is cash even though its category says bond).
  const known = TICKER_CLASS[holding.symbol.trim().toUpperCase()]
  if (known) return known
  const type = normalizeType(holding.type)
  if (type === 'cash') return 'cash'
  if (type === 'fixed income') return 'bonds'
  // crypto/derivatives are "risk assets" — keep it simple and bucket them with stocks.
  if (type === 'equity' || type === 'cryptocurrency' || type === 'derivative') return 'stocks'
  if (type === 'other') return 'other'
  // Only 'etf' / 'mutual fund' remain.
  if (!fund) return 'stocks'
  const category = fund.category ?? ''
  if (BOND_CATEGORY.test(category)) return 'bonds'
  if (CASH_CATEGORY.test(category)) return 'cash'
  if (OTHER_CATEGORY.test(category)) return 'other'
  return 'stocks'
}

/**
 * Long-only (value > 0), weighted by value. An empty (or all short/zero) account is all zeros.
 * `funds` is keyed by uppercase symbol (portfolioXray's FundMap); holdings are looked up the same way.
 */
export function actualMix(holdings: readonly Holding[], funds: Record<string, Fund | undefined>): Mix {
  const totals = zeroMix()
  let total = 0
  for (const holding of holdings) {
    if (!(holding.value > 0)) continue
    totals[classify(holding, funds[holding.symbol.trim().toUpperCase()])] += holding.value
    total += holding.value
  }
  if (total <= 0) return zeroMix()
  return {
    stocks: totals.stocks / total,
    bonds: totals.bonds / total,
    cash: totals.cash / total,
    other: totals.other / total,
  }
}

/** Weights normalized to sum to 1 (templates.json entries already do, but don't assume it). */
export function templateMix(template: Template): Mix {
  const totals = zeroMix()
  let total = 0
  for (const allocation of template.allocations) {
    totals[TICKER_CLASS[allocation.asset] ?? 'other'] += allocation.weight
    total += allocation.weight
  }
  if (total <= 0) return zeroMix()
  return {
    stocks: totals.stocks / total,
    bonds: totals.bonds / total,
    cash: totals.cash / total,
    other: totals.other / total,
  }
}

/**
 * Deterministic, evaluated in order (first match wins):
 *   no profile                                  → three-fund
 *   riskTolerance 'low'  or horizon 'short'      → sixty-forty
 *   riskTolerance 'high' and horizon 'long'      → buffett-90-10
 *   horizon 'long' and age < 30                  → target-date-2065
 *   riskTolerance 'medium' or horizon 'medium'   → three-fund
 *   anything else                                → three-fund
 */
export function suggestTemplate(profile: Profile | null | undefined): Template['id'] {
  if (!profile) return 'three-fund'
  if (profile.riskTolerance === 'low' || profile.horizon === 'short') return 'sixty-forty'
  if (profile.riskTolerance === 'high' && profile.horizon === 'long') return 'buffett-90-10'
  if (profile.horizon === 'long' && profile.age < 30) return 'target-date-2065'
  if (profile.riskTolerance === 'medium' || profile.horizon === 'medium') return 'three-fund'
  return 'three-fund'
}

export interface Drift {
  gaps: Record<MixClass, number>
  largest: MixClass | null
  sentence: string
}

const GAP_THRESHOLD = 3
/** Classes that are worth calling out by name when the client holds nothing there at all. */
const CALLOUT_CLASSES = ['bonds', 'cash'] as const

/** 0.9368 → "94%": whole percents, as the plan sentence says them. */
const whole = (f: number) => percentFromFraction(f, { digits: 0 })

/** "Stocks: 94% today vs 60% in the plan" — both numbers, never a bare "N points" gap. */
const compare = (c: MixClass, actual: Mix, target: Mix, plan: string) =>
  `${MIX_LABEL[c]}: ${whole(actual[c])} today vs ${whole(target[c])} in ${plan}`

/**
 * `actual`/`target` are fractions (0..1); `templateName` is the plan's display name. `unsure`: some
 * fund in the account is still loading, failed or was never checked, so it was assumed to be a
 * stock fund; "Nothing in bonds" could be false (it may be a bond fund), so neither "Nothing in"
 * form is said and only the "X: A% today vs B% in the plan" comparison is used.
 */
export function drift(actual: Mix, target: Mix, templateName: string, { unsure = false }: { unsure?: boolean } = {}): Drift {
  const gaps = Object.fromEntries(MIX_ORDER.map((c) => [c, Math.round((actual[c] - target[c]) * 100)])) as Record<
    MixClass,
    number
  >

  // Prefer the largest OVER gap — being overweight somewhere is the actionable, sellable story
  // for the client. Only fall back to the largest UNDER gap when nothing is overweight by 3+
  // points. (Gaps always sum to 0 across the four classes, so an under-gap almost always has
  // some offsetting over-gap somewhere; this rule picks the one worth leading with.)
  let largest: MixClass | null = null
  let bestOver = 0
  for (const c of MIX_ORDER) {
    if (gaps[c] >= GAP_THRESHOLD && gaps[c] > bestOver) {
      bestOver = gaps[c]
      largest = c
    }
  }
  if (largest === null) {
    let bestUnderAbs = 0
    for (const c of MIX_ORDER) {
      if (gaps[c] <= -GAP_THRESHOLD && Math.abs(gaps[c]) > bestUnderAbs) {
        bestUnderAbs = Math.abs(gaps[c])
        largest = c
      }
    }
  }

  if (largest === null) {
    return { gaps, largest, sentence: `Your mix is close to the ${templateName} plan.` }
  }

  // Exception: when the single biggest gap (by size, ties by MIX_ORDER) is a class the client holds
  // none of while the plan keeps 10%+ there, "nothing in bonds" is the story — lead with it.
  let biggest: MixClass | null = null
  for (const c of MIX_ORDER) {
    if (Math.abs(gaps[c]) >= GAP_THRESHOLD && (biggest === null || Math.abs(gaps[c]) > Math.abs(gaps[biggest]))) biggest = c
  }
  if (
    !unsure &&
    biggest !== null &&
    gaps[biggest] < 0 &&
    (CALLOUT_CLASSES as readonly MixClass[]).includes(biggest) &&
    actual[biggest] === 0 &&
    target[biggest] >= 0.1
  ) {
    const empty = biggest
    const lead = `Nothing in ${MIX_LABEL[empty].toLowerCase()}, where the ${templateName} plan keeps ${whole(target[empty])}.`
    const over = gaps[largest] > 0 ? ` ${compare(largest, actual, target, 'the plan')}.` : ''
    return { gaps, largest: empty, sentence: `${lead}${over}` }
  }

  const lead = compare(largest, actual, target, `the ${templateName} plan`)

  // Never repeat the lead clause's own class in the tail (saying "less in bonds ... nothing in
  // bonds" says the same thing twice).
  const callouts = CALLOUT_CLASSES.filter((c) => !unsure && c !== largest && actual[c] === 0 && target[c] >= 0.1).map(
    (c) => `nothing in ${c}`,
  )

  return { gaps, largest, sentence: [lead, ...callouts].join('; ') + '.' }
}
