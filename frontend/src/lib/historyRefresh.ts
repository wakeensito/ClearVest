import type { Schemas } from '../api/client'

/** Pending jobs get bounded foreground polling; old/backlogged jobs need a manual check. */
export function historyRefreshInterval(data: Schemas['History'] | undefined, now = Date.now()): number | false {
  if (!data?.refreshing) return false
  return data.refresh?.some(item => {
    if (item.status !== 'pending' || !item.requestedAt) return false
    const age = now - Date.parse(item.requestedAt)
    return Number.isFinite(age) && age >= -30_000 && age < 120_000
  }) ? 5_000 : false
}
