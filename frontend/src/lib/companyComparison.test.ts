import { describe, expect, it } from 'vitest'
import type { components } from '../api/schema'
type Companies = components['schemas']['Companies']
import { addCompanySymbols, comparisonBar, comparisonExport, parseCompanySymbols } from './companyComparison'

const data: Companies = {
  companies: [{ symbol: 'AMD', pe: 95.1, ps: null, grossMargin: 0.532, revenueGrowth: -0.1, epsTTM: 0, fcfPerShare: 4.1, debtToEquity: 0.06 }],
  notes: 'A "quoted", multiline\nnote', stale: true,
}
const retrievedAt = '2026-09-26T12:00:00.000Z'

describe('comparison input', () => {
  it('normalizes tickers and permits the backend ticker alphabet', () => {
    expect(parseCompanySymbols(' amd, brk-b, ^gspc, BRK.B ')).toEqual(['AMD', 'BRK-B', '^GSPC', 'BRK.B'])
  })
  it('rejects duplicates, invalid tickers and unsupported counts before a provider call', () => {
    for (const input of ['', 'AMD', 'A,B,C,D,E', 'amd, AMD', 'AMD, bad ticker', 'AMD, ABCDEFGHIJKLM']) expect(() => parseCompanySymbols(input)).toThrow()
  })
})

describe('comparison downloads', () => {
  it('retains raw precision, nulls, zero, negative numbers and explicit fraction units in JSON', () => {
    const exported = JSON.parse(comparisonExport(data, retrievedAt, 'json'))
    expect(exported.companies).toEqual(data.companies)
    expect(exported.retrievedAt).toBe(retrievedAt)
    expect(exported.stale).toBe(true)
    expect(exported.units.grossMargin).toBe('fraction')
  })
  it('exports spreadsheet-friendly CSV with unambiguous units, missing values and escaped notes', () => {
    const csv = comparisonExport(data, retrievedAt, 'csv')
    expect(csv).toContain('"Gross margin","fraction",0.532\r\n')
    expect(csv).toContain('"Revenue growth","fraction",-0.1\r\n')
    expect(csv).toContain('"Price / sales","ratio",\r\n')
    expect(csv).toContain('"Earnings per share","per share (currency not supplied)",0\r\n')
    expect(csv).toContain('"A ""quoted"", multiline\nnote"')
    expect(csv).toContain(retrievedAt)
  })
  it('neutralizes formula-like provider strings without changing numerical negatives', () => {
    const csv = comparisonExport({ ...data, notes: '=HYPERLINK("https://example.invalid")' }, retrievedAt, 'csv')
    expect(csv).toContain('"\'=HYPERLINK(')
    expect(csv).toContain(',-0.1')
  })
})


describe('visual comparison', () => {
  it('adds normalized companies without allowing duplicates or exceeding four', () => {
    expect(addCompanySymbols(['AMD'], ' nvda, brk-b ')).toEqual(['AMD', 'NVDA', 'BRK-B'])
    for (const input of ['', 'AMD', 'bad ticker', 'A,B,C,D']) expect(() => addCompanySymbols(['AMD'], input)).toThrow()
  })
  it('scales each positive metric from zero without turning missing values into zero', () => {
    expect(comparisonBar([10, 20, null], 10)).toEqual({ zero: 0, left: 0, width: 50 })
    expect(comparisonBar([0, 0], 0)?.width).toBe(0)
    expect(comparisonBar([10, null], null)).toBeNull()
  })
  it('shows negative values left of a shared zero with equal magnitude on the same scale', () => {
    expect(comparisonBar([-20, 10], -20)).toEqual({ zero: 50, left: 0, width: 50 })
    expect(comparisonBar([-20, 10], 10)).toEqual({ zero: 50, left: 50, width: 25 })
    expect(comparisonBar([Infinity, null], Infinity)).toBeNull()
  })
})
