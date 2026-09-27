import { describe, expect, it } from 'vitest'
import type { Schemas } from '../api/client'
import { historyRefreshInterval } from './historyRefresh'

const now = Date.parse('2026-09-26T12:00:00Z')
const pending: Schemas['History'] = {
  series: [], refreshing: true,
  refresh: [{ symbol: 'VOO', status: 'pending', fetchedAt: null, requestedAt: new Date(now).toISOString() }],
}

describe('history refresh polling', () => {
  it('polls cold and stale pending snapshots every five seconds', () => {
    expect(historyRefreshInterval(pending, now)).toBe(5000)
    expect(historyRefreshInterval({ ...pending, stale: true }, now + 119_000)).toBe(5000)
  })
  it('stops after two minutes and when work finishes or fails', () => {
    expect(historyRefreshInterval(pending, now + 120_000)).toBe(false)
    expect(historyRefreshInterval({ ...pending, refreshing: false }, now)).toBe(false)
    expect(historyRefreshInterval({ ...pending, refresh: [{ ...pending.refresh![0], status: 'failed' }] }, now)).toBe(false)
  })
  it('does not poll legacy responses or malformed timestamps forever', () => {
    expect(historyRefreshInterval(undefined, now)).toBe(false)
    expect(historyRefreshInterval({ series: [] }, now)).toBe(false)
    expect(historyRefreshInterval({ ...pending, refresh: [{ ...pending.refresh![0], requestedAt: 'bad' }] }, now)).toBe(false)
  })
})
