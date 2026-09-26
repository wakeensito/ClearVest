// Learn-tab progress lives on this device only (storage.ts), like the other per-device preferences.
import { write } from './storage'
import { ALL_LESSONS } from './lessons'

export const LEARN_PROGRESS_KEY = 'cv-learn-progress'
const KEY = LEARN_PROGRESS_KEY

export interface LearnProgress {
  completed: string[]
  /** Local calendar day (YYYY-MM-DD) of the last completed lesson. */
  lastDay: string | null
  streak: number
}

export const EMPTY_PROGRESS: LearnProgress = { completed: [], lastDay: null, streak: 0 }

export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return localDay(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) - 1))
}

/** Mark a lesson done and advance the daily streak. Pure: returns a new object. */
export function completeLesson(progress: LearnProgress, lessonId: string, now: Date): LearnProgress {
  const today = localDay(now)
  const completed = progress.completed.includes(lessonId) ? progress.completed : [...progress.completed, lessonId]
  let streak = 1
  if (progress.lastDay === today) streak = Math.max(progress.streak, 1)
  else if (progress.lastDay && previousDay(today) === progress.lastDay) streak = progress.streak + 1
  return { completed, lastDay: today, streak }
}

/** The streak shown today: it lapses once a full day passes without a lesson. */
export function currentStreak(progress: LearnProgress, now: Date): number {
  const today = localDay(now)
  if (progress.lastDay === today || progress.lastDay === previousDay(today)) return progress.streak
  return 0
}

// Keep a session copy when browser storage is blocked. Serialized snapshots remain stable for React.
let memory: string | null = null
const listeners = new Set<() => void>()
export function progressSnapshot(): string {
  if (memory !== null) return memory
  try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
}
export function subscribeProgress(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function refreshProgress(): void {
  memory = null
  listeners.forEach(listener => listener())
}

/** Ignore damaged, duplicate and obsolete lesson IDs rather than inflating the progress meter. */
export function parseProgress(raw: string): LearnProgress {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return EMPTY_PROGRESS
    const value = parsed as Partial<LearnProgress>
    const completed = ALL_LESSONS.filter(lesson => Array.isArray(value.completed) && value.completed.includes(lesson.id)).map(lesson => lesson.id)
    const day = typeof value.lastDay === 'string' ? value.lastDay : ''
    const validDay = /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day
    return {
      completed,
      lastDay: validDay ? day : null,
      streak: validDay && typeof value.streak === 'number' && Number.isSafeInteger(value.streak) && value.streak > 0 ? value.streak : 0,
    }
  } catch { return EMPTY_PROGRESS }
}

export function loadProgress(): LearnProgress { return parseProgress(progressSnapshot()) }
export function saveProgress(progress: LearnProgress): void {
  memory = JSON.stringify(parseProgress(JSON.stringify(progress)))
  write(KEY, memory)
  listeners.forEach(listener => listener())
}
export function resetProgress(): void {
  memory = ''
  write(KEY, null)
  listeners.forEach(listener => listener())
}

/**
 * Future value of a fixed monthly contribution with monthly compounding, contributions at month end.
 * Educational illustration only: `annualRate` is a hypothetical constant rate, as a fraction (0.06 = 6%).
 */
export function growth(monthly: number, years: number, annualRate: number): { contributed: number; value: number } {
  const months = Math.max(0, Math.round(years * 12))
  const amount = Math.max(0, monthly)
  const contributed = amount * months
  const r = annualRate / 12
  const value = r === 0 ? contributed : amount * ((Math.pow(1 + r, months) - 1) / r)
  return { contributed, value }
}
