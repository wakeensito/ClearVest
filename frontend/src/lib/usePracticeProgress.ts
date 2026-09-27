import { useEffect, useSyncExternalStore } from 'react'
import { parsePractice, practiceKey, practiceSnapshot, refreshPractice, subscribePractice } from './practiceProgress'

export function usePracticeProgress() {
  useEffect(() => {
    const update = (event: StorageEvent) => { if (event.key === practiceKey() || event.key === null) refreshPractice() }
    window.addEventListener('storage', update)
    return () => window.removeEventListener('storage', update)
  }, [])
  return parsePractice(useSyncExternalStore(subscribePractice, practiceSnapshot, () => ''))
}
