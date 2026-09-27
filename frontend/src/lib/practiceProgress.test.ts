import { describe, expect, it } from 'vitest'
import { parsePractice, recordPractice } from './practiceProgress'

describe('practice results', () => {
  it('keeps the first attempt rather than counting corrected answers as mastery', () => {
    const first = recordPractice([], 'diversification', { question: 0, correct: false })
    expect(recordPractice(first, 'diversification', { question: 0, correct: true })).toEqual(first)
    expect(recordPractice(first, 'diversification', { question: 1, correct: true })[0]?.answers).toEqual({ 0: false, 1: true })
  })
  it('tracks self-review separately and never turns it into a quiz score', () => {
    const review = recordPractice([], 'funds', { reflection: 'explained' })
    expect(review).toEqual([{ lessonId: 'funds', answers: {}, reflection: 'explained' }])
    expect(recordPractice(review, 'funds', { reflection: 'revisit' })[0]?.reflection).toBe('revisit')
  })
  it('rejects unknown lessons, out-of-range and fractional questions', () => {
    expect(recordPractice([], 'unknown', { question: 0, correct: true })).toEqual([])
    expect(recordPractice([], 'funds', { question: -1, correct: true })).toEqual([])
    expect(recordPractice([], 'funds', { question: 99, correct: true })).toEqual([])
    expect(recordPractice([], 'funds', { question: 0.5, correct: true })).toEqual([])
  })
  it('bounds stored data to existing quiz slots, strips writing and ignores damaged records', () => {
    const raw = JSON.stringify([{ lessonId: 'funds', answers: { 0: true, 1: 'yes', 2: true, 9999: true }, explanation: 'private writing', reflection: 'mastered' }, { lessonId: 'unknown', answers: { 0: true } }, { lessonId: 'funds', answers: { 1: true } }])
    expect(parsePractice(raw)).toEqual([{ lessonId: 'funds', answers: { 0: true } }])
    for (const raw of ['', 'bad json', '{}', 'null', '[null,1,"text",{}]']) expect(parsePractice(raw)).toEqual([])
  })
})
