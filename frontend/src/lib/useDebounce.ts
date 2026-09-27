import { useEffect, useState } from 'react'

export const SEARCH_DEBOUNCE_MS = 300

/** Calls `onSettle` with the last pushed value once `delay` ms pass without another push. */
export function createDebouncer<T>(delay: number, onSettle: (value: T) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    push(value: T) {
      clearTimeout(timer)
      timer = setTimeout(() => onSettle(value), delay)
    },
    cancel() { clearTimeout(timer) },
  }
}

/** `value`, but only after it has stopped changing for `delay` ms; intermediate values are dropped. */
export function useDebounce<T>(value: T, delay = SEARCH_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const debouncer = createDebouncer(delay, setSettled)
    debouncer.push(value)
    return debouncer.cancel
  }, [value, delay])
  return settled
}
