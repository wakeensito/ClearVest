import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDebouncer, SEARCH_DEBOUNCE_MS } from './useDebounce'

describe('createDebouncer', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('settles on the value 300 ms after the last push', () => {
    const settled: string[] = []
    const debouncer = createDebouncer<string>(SEARCH_DEBOUNCE_MS, (value) => settled.push(value))
    debouncer.push('ap')
    vi.advanceTimersByTime(299)
    expect(settled).toEqual([])
    vi.advanceTimersByTime(1)
    expect(settled).toEqual(['ap'])
  })

  it('drops intermediate values typed within the window', () => {
    const settled: string[] = []
    const debouncer = createDebouncer<string>(300, (value) => settled.push(value))
    debouncer.push('a')
    vi.advanceTimersByTime(100)
    debouncer.push('ap')
    vi.advanceTimersByTime(200)
    debouncer.push('app')
    vi.advanceTimersByTime(299)
    expect(settled).toEqual([])
    vi.advanceTimersByTime(1)
    expect(settled).toEqual(['app'])
  })

  it('cancel drops a pending value (unmount)', () => {
    const settled: string[] = []
    const debouncer = createDebouncer<string>(300, (value) => settled.push(value))
    debouncer.push('apple')
    debouncer.cancel()
    vi.advanceTimersByTime(1000)
    expect(settled).toEqual([])
  })
})
