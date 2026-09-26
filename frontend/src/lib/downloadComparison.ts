import type { Companies } from '../api/client'
import { comparisonExport } from './companyComparison'

export function downloadComparison(data: Companies, retrievedAt: string, format: 'csv' | 'json') {
  const blob = new Blob([comparisonExport(data, retrievedAt, format)], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `clearvest-comparison-${data.companies.map((company) => company.symbol.replace(/[^A-Z0-9.-]/gi, '')).join('-')}-${retrievedAt.slice(0, 10)}.${format}`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
