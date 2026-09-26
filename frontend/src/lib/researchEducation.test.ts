import { describe, expect, it } from 'vitest'
import type { components } from '../api/schema'
type AnnualIncome = components['schemas']['AnnualIncome']
import { financialAmount, historicalPE, revenueChange, usablePE } from './researchEducation'
const row = (year: string, revenue: number | null, currency: string | null = 'USD'): AnnualIncome => ({ date: `${year}-12-31`, year, currency, revenue, costOfRevenue: null, grossProfit: null, operatingIncome: null, netIncome: null, epsDiluted: null })
describe('financial teaching calculations', () => {
  it('does not call missing, zero-base, skipped-year or mixed-currency data growth', () => {
    expect(revenueChange([row('2025', 120), row('2024', 100)])).toBe(0.2)
    expect(revenueChange([row('2025', 80), row('2024', 100)])).toBe(-0.2)
    for (const prior of [row('2024', 0), row('2024', -5), row('2024', null), row('2023', 100), row('2024', 100, 'EUR')]) expect(revenueChange([row('2025', 120), prior])).toBeNull()
    expect(revenueChange([row('2025', 120, null), row('2024', 100, null)])).toBeNull()
    expect(revenueChange([])).toBeNull()
  })
  it('uses a median of at least three positive historical observations', () => {
    const history = (values: (number | null)[]) => values.map((pe, i) => ({ year: String(2020 + i), date: `${2020 + i}-12-31`, pe }))
    expect(historicalPE(history([null, -10, 0, 20, 25]))).toBeNull()
    expect(historicalPE(history([20, 25, 150]))).toEqual({ median: 25, count: 3 })
    expect(historicalPE(history([20, 25, 40, 50]))).toEqual({ median: 32.5, count: 4 })
  })
  it('never implies a useful P/E for losses or zero earnings', () => {
    for (const pe of [0, -10, null, Infinity, NaN]) expect(usablePE(pe)).toBeNull()
    expect(usablePE(20, -2)).toBeNull()
    expect(usablePE(20, 0)).toBeNull()
    expect(usablePE(20, 2)).toBe(20)
  })
  it('preserves currency, negative signs and missing versus zero', () => {
    expect(financialAmount(null, 'USD')).toBe('Not available')
    expect(financialAmount(Infinity)).toBe('Not available')
    expect(financialAmount(0, 'USD')).toContain('0.00')
    expect(financialAmount(-5, 'EUR')).toContain('-')
    expect(financialAmount(1000000, 'EUR', true)).toContain('EUR')
    expect(financialAmount(5, null)).toBe('5')
    expect(financialAmount(5, 'invalid')).toBe('5')
  })
})
