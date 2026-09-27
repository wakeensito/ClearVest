// "Your plan vs. today": compare a client's actual stocks/bonds/cash/other mix against a model
// portfolio template chosen from their investment profile, and say the gap in one plain sentence.
// Pure math + a static ticker map — no LLM calls (DESIGN.md rule: never invent numbers).

import type { Fund, Holding } from '../api/client'
import type { components } from '../api/schema'
import { normalizeType } from './assetTypes'

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
// "Large Blend") — checked only for etf/mutual fund holdings, in this priority order.
const BOND_CATEGORY = /bond|treasury|fixed income|income/i
const CASH_CATEGORY = /money market|cash/i
const OTHER_CATEGORY = /commodit|gold|real estate|reit/i

/**
 * Plaid `type` decides most holdings outright. `etf`/`mutual fund` need the fund's `category` to
 * tell stocks from bonds/cash/other; with no fund loaded yet, an unknown fund is assumed to be a
 * stock fund (the UI shows "N of M funds checked" while funds are still loading).
 */
export function classify(holding: Holding, fund?: Fund | null): MixClass {
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

/** Long-only (value > 0), weighted by value. An empty (or all short/zero) account is all zeros. */
export function actualMix(holdings: readonly Holding[], funds: Record<string, Fund | undefined>): Mix {
  const totals = zeroMix()
  let total = 0
  for (const holding of holdings) {
    if (!(holding.value > 0)) continue
    totals[classify(holding, funds[holding.symbol])] += holding.value
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

/** `actual`/`target` are fractions (0..1); `templateName` is the plan's display name. */
export function drift(actual: Mix, target: Mix, templateName: string): Drift {
  const gaps = Object.fromEntries(MIX_ORDER.map((c) => [c, Math.round((actual[c] - target[c]) * 100)])) as Record<
    MixClass,
    number
  >

  let largest: MixClass | null = null
  let largestAbs = 0
  for (const c of MIX_ORDER) {
    const abs = Math.abs(gaps[c])
    if (abs >= GAP_THRESHOLD && abs > largestAbs) {
      largest = c
      largestAbs = abs
    }
  }

  if (largest === null) {
    return { gaps, largest, sentence: `Your mix is close to the ${templateName} plan.` }
  }

  const n = Math.abs(gaps[largest])
  const label = MIX_LABEL[largest].toLowerCase()
  const lead =
    gaps[largest] > 0
      ? `${n} points more in ${label} than the ${templateName} plan`
      : `${n} points less in ${label} than the ${templateName} plan`

  const callouts = CALLOUT_CLASSES.filter((c) => actual[c] === 0 && target[c] >= 0.1).map((c) => `nothing in ${c}`)

  return { gaps, largest, sentence: [lead, ...callouts].join('; ') + '.' }
}
