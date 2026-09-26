import type { components } from '../api/schema'
type HistorySeries = components['schemas']['HistorySeries']

/** The chart requires unique, ascending trading dates and finite prices. Last observation wins. */
export function historyPoints(points: HistorySeries['points']) {
  const unique = new Map<string, number>()
  for (const point of points) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(point.date) || !Number.isFinite(point.close) || point.close <= 0) continue
    const parsed = new Date(`${point.date}T00:00:00Z`)
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== point.date) continue
    unique.set(point.date, point.close)
  }
  return [...unique].sort(([a], [b]) => a.localeCompare(b)).map(([time, value]) => ({ time, value }))
}
