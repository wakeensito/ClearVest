// Learn-tab progress lives on this device only (storage.ts), like the other per-device preferences.
import { read, write } from './storage'

const KEY = 'cv-learn-progress'

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

export function loadProgress(): LearnProgress {
  const raw = read(KEY)
  if (!raw) return EMPTY_PROGRESS
  try {
    const parsed = JSON.parse(raw) as Partial<LearnProgress>
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed.filter((id): id is string => typeof id === 'string') : [],
      lastDay: typeof parsed.lastDay === 'string' ? parsed.lastDay : null,
      streak: typeof parsed.streak === 'number' && parsed.streak > 0 ? Math.floor(parsed.streak) : 0,
    }
  } catch {
    return EMPTY_PROGRESS
  }
}

export function saveProgress(progress: LearnProgress): void {
  write(KEY, JSON.stringify(progress))
}

export function resetProgress(): void {
  write(KEY, null)
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
