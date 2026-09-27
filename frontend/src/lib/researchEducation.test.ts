import { describe, expect, it } from 'vitest'
import type { components } from '../api/schema'
type AnnualIncome = components['schemas']['AnnualIncome']
import { dividendSentence, financialAmount, historicalPE, marketCapSentence, peVersusUsual, revenueChange, usablePE } from './researchEducation'
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
  it('compares P/E with its usual level only past a 15% band, without verdicts', () => {
    expect(peVersusUsual(28, 24)).toBe('Investors are paying more than usual for each dollar of profit: 28.0× today vs about 24.0× over the last 5 years.')
    expect(peVersusUsual(20, 24)).toBe('Investors are paying less than usual for each dollar of profit: 20.0× today vs about 24.0× over the last 5 years.')
    expect(peVersusUsual(24, 24)).toBe('About the same as its usual 24.0×.')
    expect(peVersusUsual(28, 24, 3)).toContain('over the last 3 years.') // never claims more years than observed
    expect(peVersusUsual(27.6, 24)).toContain('more than usual') // exactly ×1.15
    expect(peVersusUsual(27.5, 24)).toBe('About the same as its usual 24.0×.')
    expect(peVersusUsual(20.4, 24)).toContain('less than usual') // exactly ×0.85
    expect(peVersusUsual(20.5, 24)).toBe('About the same as its usual 24.0×.')
    for (const [pe, median] of [[null, 24], [28, null], [undefined, 24], [NaN, 24], [28, 0], [-5, 24]] as const) expect(peVersusUsual(pe, median)).toBeNull()
    for (const pe of [10, 24, 40]) expect(peVersusUsual(pe, 24)).not.toMatch(/cheap|expensive|bargain|overvalued|undervalued/i)
  })
  it('explains a dividend yield that arrives as a fraction, or says there is none', () => {
    expect(dividendSentence(0.0045)).toBe('Each year the company pays out about 0.45% of its share price in cash.')
    expect(dividendSentence(0.0239)).toContain('2.39%')
    for (const value of [null, undefined, 0, -0.01, NaN]) expect(dividendSentence(value)).toBe('No dividend')
  })
  it('states market value compactly in the reported currency', () => {
    expect(marketCapSentence(3.4e12, 'USD')).toBe('Worth about USD\u00a03.4T on the market')
    expect(marketCapSentence(5009416510920, 'USD')).toBe('Worth about USD\u00a05T on the market')
    expect(marketCapSentence(null, 'USD')).toBeNull()
    expect(marketCapSentence(0, 'USD')).toBeNull()
  })
})
