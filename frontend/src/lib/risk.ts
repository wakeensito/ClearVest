// TypeScript port of the backend portfolio risk score (src/layer/clearvest/risk.py `score()`).
// Ported so the ticker page can compute a hypothetical "risk before → after" client-side without
// a round trip. Keep this in lockstep with risk.py — the Python file wins on any difference, and
// frontend/src/lib/risk.test.ts mirrors tests/layer/test_risk.py case for case so the two
// implementations cannot drift apart.

export type RiskLabel = 'Conservative' | 'Moderate' | 'Aggressive'

/** weight: portfolio fraction (0..1 of the account, or negative for a short/margin position). */
export interface RiskInput {
  symbol: string
  type: string
  weight: number
}

export interface RiskProfile {
  age?: number | null
  horizon?: 'short' | 'medium' | 'long' | null
}

export interface RiskResult {
  score: number
  label: RiskLabel
  mix: number
  concentration: number
}

export const TYPE_RISK: Record<string, number> = {
  cash: 0,
  'fixed income': 0.25,
  etf: 0.6,
  'mutual fund': 0.6,
  other: 0.6,
  equity: 0.8,
  cryptocurrency: 1.0,
  derivative: 1.0,
}

// Single-name positions: risk.py's SINGLE_NAME set. A negative-weight (short/margin) holding
// also counts as single-name concentration regardless of its reported type.
const SINGLE_NAME = new Set(['equity', 'cryptocurrency', 'derivative'])

export function riskLabel(score: number): RiskLabel {
  if (score <= 33) return 'Conservative'
  return score <= 66 ? 'Moderate' : 'Aggressive'
}

// Short/margin positions (negative weight) can lose more than 100%, so they carry the max type
// risk regardless of the reported instrument type — mirrors risk.py's `type_risk`.
function typeRisk(h: RiskInput): number {
  if (h.weight < 0) return 1.0
  return TYPE_RISK[h.type.toLowerCase()] ?? 0.6
}

// Python's round() with no ndigits rounds half-to-even ("banker's rounding") on the exact double
// value: round(85.5) == 86, round(86.5) == 86 (both go to the nearest even integer). JS's
// Math.round rounds half-away-from-zero instead (Math.round(85.5) === 86 but Math.round(86.5) ===
// 87), so it cannot be reused here. This reimplements Python's rule so the two ports agree on the
// rare case where the clamped score lands exactly on a .5 boundary.
function pythonRound(x: number): number {
  const floor = Math.floor(x)
  const diff = x - floor
  if (diff < 0.5) return floor
  if (diff > 0.5) return floor + 1
  return floor % 2 === 0 ? floor : floor + 1
}

export function riskScore(holdings: readonly RiskInput[], profile?: RiskProfile | null): RiskResult {
  const invested = holdings.filter(h => h.weight !== 0)
  if (invested.length === 0) {
    return { score: 0, label: 'Conservative', mix: 0, concentration: 0 }
  }

  const mix = 100 * invested.reduce((sum, h) => sum + Math.abs(h.weight) * typeRisk(h), 0)
  const singles = invested.filter(h => SINGLE_NAME.has(h.type.toLowerCase()) || h.weight < 0)
  const concentration = 100 * singles.reduce((sum, h) => sum + h.weight ** 2, 0)
  const base = 0.7 * mix + 0.3 * concentration

  let adjust = 0
  if (profile) {
    const { horizon, age } = profile
    if (horizon === 'short') adjust += 10
    else if (horizon === 'long') adjust -= 5
    if (typeof age === 'number' && age >= 60) adjust += 10
    else if (typeof age === 'number' && age < 30) adjust -= 5
  }

  const score = pythonRound(Math.min(100, Math.max(0, base + adjust)))
  return { score, label: riskLabel(score), mix, concentration }
}
