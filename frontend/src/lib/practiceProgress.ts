import { ALL_LESSONS, findLesson } from './lessons'
import { read, write } from './storage'
import { getUserId } from './userId'

export interface PracticeResult {
  lessonId: string
  // One first attempt per question; retries never inflate the score.
  answers: Record<string, boolean>
  reflection?: 'explained' | 'revisit'
}
export type PracticeProgress = PracticeResult[]
export const practiceKey = () => `cv-practice:${getUserId()}`
const memories = new Map<string, string>()
const listeners = new Set<() => void>()

export function parsePractice(raw: string): PracticeProgress {
  try {
    const values: unknown = JSON.parse(raw)
    if (!Array.isArray(values)) return []
    return ALL_LESSONS.flatMap(lesson => {
      const record = values.find(value => value && typeof value === 'object' && value.lessonId === lesson.id)
      if (!record) return []
      const answers: Record<string, boolean> = {}
      lesson.quiz.forEach((_, index) => {
        if (typeof record.answers?.[String(index)] === 'boolean') answers[String(index)] = record.answers[String(index)]
      })
      const reflection = record.reflection === 'explained' || record.reflection === 'revisit' ? record.reflection : undefined
      return Object.keys(answers).length || reflection ? [{ lessonId: lesson.id, answers, ...(reflection ? { reflection } : {}) }] : []
    })
  } catch { return [] }
}

export function recordPractice(progress: PracticeProgress, lessonId: string, event: { question: number; correct: boolean } | { reflection: 'explained' | 'revisit' }): PracticeProgress {
  const lesson = findLesson(lessonId)?.lesson
  if (!lesson) return progress
  const existing = progress.find(item => item.lessonId === lessonId) ?? { lessonId, answers: {} }
  let updated: PracticeResult
  if ('question' in event) {
    if (!Number.isInteger(event.question) || !lesson.quiz[event.question] || existing.answers[event.question] !== undefined) return progress
    updated = { ...existing, answers: { ...existing.answers, [event.question]: event.correct } }
  } else updated = { ...existing, reflection: event.reflection }
  return [...progress.filter(item => item.lessonId !== lessonId), updated]
}

export function practiceSnapshot(): string {
  const key = practiceKey()
  return memories.get(key) ?? read(key) ?? ''
}
export function subscribePractice(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function refreshPractice() { memories.delete(practiceKey()); listeners.forEach(listener => listener()) }
export function savePractice(lessonId: string, event: Parameters<typeof recordPractice>[2]) {
  const key = practiceKey()
  const value = JSON.stringify(recordPractice(parsePractice(practiceSnapshot()), lessonId, event))
  memories.set(key, value)
  write(key, value)
  listeners.forEach(listener => listener())
}
export function resetPractice() {
  memories.set(practiceKey(), '')
  write(practiceKey(), null)
  listeners.forEach(listener => listener())
}
