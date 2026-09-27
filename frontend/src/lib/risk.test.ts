// Mirrors tests/layer/test_risk.py case for case (same inputs, same expected scores/labels) so the
// Python and TypeScript risk ports cannot drift apart. Each `it` is named after its Python test.
import { describe, expect, it } from 'vitest'
import { riskScore, riskLabel, TYPE_RISK, type RiskInput } from './risk'

const h = (type: string, weight: number, symbol = 'X'): RiskInput => ({ symbol, type, weight })

describe('test_labels_without_profile', () => {
  it.each<[RiskInput[], string]>([
    [[h('cash', 1.0)], 'Conservative'],
    [[h('etf', 0.6), h('fixed income', 0.4)], 'Conservative'],
    [[h('etf', 1.0)], 'Moderate'],
    [[h('equity', 1.0, 'NVDA')], 'Aggressive'],
    [[h('cryptocurrency', 0.7, 'BTC'), h('etf', 0.3)], 'Aggressive'],
  ])('%#: %j -> %s', (holdings, expectedLabel) => {
    expect(riskScore(holdings, null).label).toBe(expectedLabel)
  })
})

it('test_single_stock_is_max_concentration', () => {
  const out = riskScore([h('equity', 1.0, 'NVDA')], null)
  expect(out.score).toBe(86) // 0.7*80 + 0.3*100
  expect(out.mix).toBe(80)
  expect(out.concentration).toBe(100)
  expect(out.label).toBe('Aggressive')
})

it('test_profile_shifts_score', () => {
  const base = riskScore([h('etf', 1.0)], null).score
  const nearRetirement = riskScore([h('etf', 1.0)], { age: 63, horizon: 'short' }).score
  const young = riskScore([h('etf', 1.0)], { age: 22, horizon: 'long' }).score
  expect(nearRetirement).toBe(base + 20)
  expect(young).toBe(base - 10)
})

it('test_empty_portfolio', () => {
  const out = riskScore([], null)
  expect(out.score).toBe(0)
  expect(out.label).toBe('Conservative')
  expect(out.mix).toBe(0)
  expect(out.concentration).toBe(0)
})

it('test_score_is_clamped', () => {
  expect(riskScore([h('derivative', 1.0)], { age: 70, horizon: 'short' }).score).toBe(100)
})

it('test_unknown_type_counts_as_other', () => {
  expect(riskScore([h('warrant', 1.0)], null).score).toBe(riskScore([h('other', 1.0)], null).score)
  expect(TYPE_RISK.other).toBe(0.6)
})

it('test_short_position_scores_aggressive_not_zero', () => {
  const out = riskScore([h('equity', -1.0, 'GME')], null)
  expect(out.label).toBe('Aggressive')
  expect(out.score).toBeGreaterThan(0)
})

it('test_holding_without_symbol_does_not_raise', () => {
  // risk.py guards a missing "symbol" key on an untyped dict; RiskInput requires `symbol` in
  // TypeScript, so the equivalent edge case here is an empty-string symbol rather than an absent
  // field — the port should still compute cleanly instead of throwing.
  const holdings: RiskInput[] = [{ symbol: '', type: 'equity', weight: 1.0 }]
  expect(() => riskScore(holdings, null)).not.toThrow()
  expect(riskScore(holdings, null).label).toBe('Aggressive')
})

it('sample account: VOO/QQQ/AAPL/NVDA/cash/VGT, age 25, long horizon', () => {
  // Hand-computed (matches a Python check of the same inputs):
  //   mix = 100 * (.449*.6 + .188*.6 + .144*.8 + .114*.8 + .063*0 + .042*.6) = 61.38
  //   concentration = 100 * (.144^2 + .114^2)                                = 3.3732
  //   base = 0.7*61.38 + 0.3*3.3732                                          = 43.97796
  //   adjust = -5 (long horizon) + -5 (age < 30)                            = -10
  //   score = round(43.97796 - 10) = round(33.97796)                        = 34 -> Moderate
  const holdings: RiskInput[] = [
    h('etf', 0.449, 'VOO'),
    h('etf', 0.188, 'QQQ'),
    h('equity', 0.144, 'AAPL'),
    h('equity', 0.114, 'NVDA'),
    h('cash', 0.063, 'CASH'),
    h('etf', 0.042, 'VGT'),
  ]
  const out = riskScore(holdings, { age: 25, horizon: 'long' })
  expect(out.score).toBe(34)
  expect(out.label).toBe('Moderate')
})

it('rounding: a base score landing exactly on .5 rounds to the nearest even integer, like Python', () => {
  // mix = 100 * (0.5*0.8 [equity] + 0.5*0 [cash]) = 40
  // concentration = 100 * 0.5^2 [equity is single-name]                     = 25
  // base = 0.7*40 + 0.3*25 = 28 + 7.5 = 35.5 exactly -> Python round(35.5) rounds to even -> 36
  const holdings: RiskInput[] = [h('equity', 0.5, 'AAPL'), h('cash', 0.5, 'CASH')]
  const out = riskScore(holdings, null)
  expect(out.mix).toBe(40)
  expect(out.concentration).toBe(25)
  expect(out.score).toBe(36)
})

describe('riskLabel', () => {
  it('bands are <=33 Conservative, <=66 Moderate, else Aggressive', () => {
    expect(riskLabel(0)).toBe('Conservative')
    expect(riskLabel(33)).toBe('Conservative')
    expect(riskLabel(34)).toBe('Moderate')
    expect(riskLabel(66)).toBe('Moderate')
    expect(riskLabel(67)).toBe('Aggressive')
    expect(riskLabel(100)).toBe('Aggressive')
  })
})
