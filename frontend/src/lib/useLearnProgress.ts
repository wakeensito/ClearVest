import { useEffect, useSyncExternalStore } from 'react'
import { LEARN_PROGRESS_KEY, parseProgress, progressSnapshot, refreshProgress, subscribeProgress } from './learnProgress'

export function useLearnProgress() {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === LEARN_PROGRESS_KEY || event.key === null) refreshProgress()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return parseProgress(useSyncExternalStore(subscribeProgress, progressSnapshot, () => ''))
}
