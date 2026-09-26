import { useSyncExternalStore } from 'react'
import { read, write } from './storage'
import { getUserId } from './userId'

export const RESEARCH_MILESTONES = ['share', 'profit', 'pe'] as const
export type ResearchMilestone = typeof RESEARCH_MILESTONES[number]
const listeners = new Set<() => void>()
const memory = new Map<string, string>()
const key = () => `cv-research-progress-v1:${getUserId()}`
function snapshot() { const id = key(); return memory.get(id) ?? read(id) ?? '' }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function markResearchProgress(milestone: ResearchMilestone) {
  const values = new Set(snapshot().split(','))
  values.add(milestone)
  const value = RESEARCH_MILESTONES.filter(item => values.has(item)).join(',')
  memory.set(key(), value)
  write(key(), value)
  listeners.forEach(listener => listener())
}
export function useResearchProgress() {
  const value = useSyncExternalStore(subscribe, snapshot)
  return RESEARCH_MILESTONES.filter(item => value.split(',').includes(item))
}
