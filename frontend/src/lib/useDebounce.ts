import { useCallback, useEffect, useRef, useState } from 'react'

export const SEARCH_DEBOUNCE_MS = 300

/** Calls `onSettle` with the last pushed value once `delay` ms pass without another push. */
export function createDebouncer<T>(delay: number, onSettle: (value: T) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: { value: T } | undefined
  return {
    push(value: T) {
      clearTimeout(timer)
      pending = { value }
      timer = setTimeout(() => { pending = undefined; onSettle(value) }, delay)
    },
    /** Settle the pending value now (Enter before the pause ends). No-op when nothing is pending. */
    flush() {
      clearTimeout(timer)
      if (pending) { const { value } = pending; pending = undefined; onSettle(value) }
    },
    cancel() { clearTimeout(timer); pending = undefined },
  }
}

/**
 * `value`, but only after it has stopped changing for `delay` ms; intermediate values are dropped.
 * The second item settles the latest value immediately.
 */
export function useDebounce<T>(value: T, delay = SEARCH_DEBOUNCE_MS): [T, () => void] {
  const [settled, setSettled] = useState(value)
  const debouncer = useRef<ReturnType<typeof createDebouncer<T>> | null>(null)
  useEffect(() => {
    const next = createDebouncer(delay, setSettled)
    next.push(value)
    debouncer.current = next
    return next.cancel
  }, [value, delay])
  const flush = useCallback(() => debouncer.current?.flush(), [])
  return [settled, flush]
}
