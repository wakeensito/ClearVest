import type { components } from '../api/schema'
type Companies = components['schemas']['Companies']
type Company = components['schemas']['Company']
import { marketPrice, multiple, percentFromFraction } from './format'

type MetricKey = Exclude<keyof Company, 'symbol'>
export const companyMetrics: { key: MetricKey; label: string; unit: string; description: string; format: (value: number | null) => string }[] = [
  { key: 'pe', label: 'Price / earnings', unit: 'ratio', description: 'Share price divided by earnings per share for the latest 12 months. Lower is not automatically better.', format: multiple },
  { key: 'ps', label: 'Price / sales', unit: 'ratio', description: 'Share price relative to sales per share over the trailing 12 months.', format: multiple },
  { key: 'grossMargin', label: 'Gross margin', unit: 'fraction', description: 'The share of revenue left after the cost of goods sold.', format: percentFromFraction },
  { key: 'revenueGrowth', label: 'Revenue growth', unit: 'fraction', description: 'Change in annual revenue compared with the previous year.', format: percentFromFraction },
  { key: 'epsTTM', label: 'Earnings per share', unit: 'per share (currency not supplied)', description: 'Net income per share over the trailing 12 months.', format: marketPrice },
  { key: 'fcfPerShare', label: 'Free cash flow per share', unit: 'per share (currency not supplied)', description: 'Cash remaining after capital spending, per share.', format: marketPrice },
  { key: 'debtToEquity', label: 'Debt / equity', unit: 'ratio', description: 'Debt relative to shareholder equity. Interpret alongside the company’s industry.', format: multiple },
]

export const comparisonSource = 'FMP ratios; SEC EDGAR annual revenue growth where available, otherwise FMP. Reporting dates and the source used for each value are not supplied.'

export function parseCompanySymbols(input: string): string[] {
  const symbols = input.split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)
  if (symbols.length < 2 || symbols.length > 4) throw new Error('Enter 2 to 4 company tickers, separated by commas.')
  if (symbols.some((symbol) => !/^[A-Z0-9.^-]{1,12}$/.test(symbol))) throw new Error('Use ticker symbols of up to 12 characters, such as AMD or BRK-B.')
  if (new Set(symbols).size !== symbols.length) throw new Error('Choose a different ticker for each company.')
  return symbols
}

// Quote CSV fields and neutralize spreadsheet formulas in provider-supplied text.
function csvCell(value: string | number | null): string {
  if (value === null) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  const safe = /^[\s]*[=+\-@\t\r\n]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function comparisonExport(data: Companies, retrievedAt: string, format: 'csv' | 'json'): string {
  if (format === 'json') return JSON.stringify({ ...data, retrievedAt, sourceNotes: comparisonSource, units: Object.fromEntries(companyMetrics.map((metric) => [metric.key, metric.unit])) }, null, 2)
  const rows: (string | number | null)[][] = [
    ['Metric', 'Unit', ...data.companies.map((company) => company.symbol)],
    ...companyMetrics.map((metric) => [metric.label, metric.unit, ...data.companies.map((company) => company[metric.key])]),
    [], ['Retrieved at (not reporting date)', retrievedAt],
    ['Cached data flag', data.stale === undefined ? 'Not supplied' : String(data.stale)],
    ['Sources', comparisonSource], ['Notes', data.notes],
    ['Missing values', 'Blank cells mean not available. Fraction values such as 0.532 equal 53.2%.'],
  ]
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}


export function addCompanySymbols(current: string[], input: string): string[] {
  const additions = input.split(',').map((value) => value.trim().toUpperCase()).filter(Boolean)
  if (!additions.length) throw new Error('Enter a company ticker to add.')
  const next = [...current, ...additions]
  if (next.some((symbol) => !/^[A-Z0-9.^-]{1,12}$/.test(symbol))) throw new Error('Use ticker symbols of up to 12 characters, such as AMD or BRK-B.')
  if (new Set(next).size !== next.length) throw new Error('That company is already selected. Choose a different ticker.')
  if (next.length > 4) throw new Error('Compare up to 4 companies. Remove one before adding another.')
  return next
}

/** Each metric has its own zero-based scale; signed metrics share a centered zero. */
export function comparisonBar(values: (number | null)[], value: number | null) {
  const finite = values.filter((entry): entry is number => entry !== null && Number.isFinite(entry))
  if (value === null || !Number.isFinite(value)) return null
  const signed = finite.some((entry) => entry < 0)
  const max = Math.max(...finite.map(Math.abs), 0)
  const zero = signed ? 50 : 0
  const width = max === 0 ? 0 : Math.abs(value) / max * (signed ? 50 : 100)
  return { zero, left: value < 0 ? zero - width : zero, width }
}
