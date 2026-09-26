import { describe, expect, it } from 'vitest'
import { historyPoints } from './history'

describe('historyPoints', () => {
  it('sorts dates and deduplicates with the latest observation, without mutating the response', () => {
    const input = [{ date: '2026-09-02', close: 21 }, { date: '2026-09-01', close: 20 }, { date: '2026-09-02', close: 22 }]
    expect(historyPoints(input)).toEqual([{ time: '2026-09-01', value: 20 }, { time: '2026-09-02', value: 22 }])
    expect(input[0].close).toBe(21)
  })
  it('rejects invalid calendar dates and non-positive or non-finite prices', () => {
    expect(historyPoints([
      { date: '2026-02-30', close: 10 }, { date: 'invalid', close: 10 },
      { date: '2026-01-01', close: NaN }, { date: '2026-01-02', close: Infinity },
      { date: '2026-01-03', close: -1 }, { date: '2026-01-04', close: 0 },
      { date: '2026-01-05', close: 12 },
    ])).toEqual([{ time: '2026-01-05', value: 12 }])
  })
})
