import { describe, expect, it } from 'vitest'
import { currencyWhole } from './format'
import { FAQ } from './faq'
import { TERMS } from './learning'
import { heldFund } from './fundPlay'
import { completeLesson, currentStreak, EMPTY_PROGRESS, growth, localDay, parseProgress } from './learnProgress'
import { ALL_LESSONS, findLesson, nextLesson, PLAY_LESSON, UNITS } from './lessons'

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12)

describe('starter path content', () => {
  it('has unique lesson ids and valid quiz answers', () => {
    const ids = ALL_LESSONS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const lesson of ALL_LESSONS) {
      expect(lesson.cards.length).toBeGreaterThan(0)
      const questions = lesson.play?.decisions ?? lesson.quiz
      expect(questions.length).toBeGreaterThan(0)
      for (const q of questions) {
        expect(q.answer).toBeGreaterThanOrEqual(0)
        expect(q.answer).toBeLessThan(q.options.length)
        expect(new Set(q.options).size).toBe(q.options.length)
      }
    }
  })
  it('finds lessons with their unit and suggests the first unfinished one', () => {
    expect(findLesson('funds')).toMatchObject({ unit: { id: 'what-to-buy' } })
    expect(findLesson('nope')).toBeNull()
    expect(nextLesson([])).toBe(ALL_LESSONS[0])
    expect(nextLesson([ALL_LESSONS[0]!.id])).toBe(ALL_LESSONS[1])
    expect(nextLesson(ALL_LESSONS.map((l) => l.id))).toBeNull()
    expect(UNITS.flatMap((u) => u.lessons)).toHaveLength(ALL_LESSONS.length)
  })
  it('keeps the glossary and FAQ free of duplicates', () => {
    expect(new Set(TERMS.map((t) => t.term)).size).toBe(TERMS.length)
    expect(new Set(FAQ.map((f) => f.question)).size).toBe(FAQ.length)
  })
})

describe('be the fund', () => {
  const play = PLAY_LESSON?.play
  it('plays a real fund whose decisions point at holdings in the strip', () => {
    expect(PLAY_LESSON?.id).toBe('be-the-fund')
    expect(findLesson('be-the-fund')?.unit.id).toBe('what-to-buy')
    if (!play) throw new Error('no play block')
    expect(PLAY_LESSON?.quiz).toHaveLength(0)
    const symbols = play.holdings.map((h) => h.symbol)
    expect(new Set(symbols).size).toBe(symbols.length)
    for (const d of play.decisions) expect(symbols).toContain(d.focus)
    expect(symbols).toContain(play.spotlight)
    const weights = play.holdings.map((h) => h.weight)
    expect(weights).toEqual([...weights].sort((a, b) => b - a))
    const sum = weights.reduce((s, w) => s + w, 0)
    expect(sum).toBeCloseTo(play.topShare, 2)
    expect(sum).toBeLessThan(1)
    expect(play.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('ties the fund back to what the user holds, or nothing', () => {
    if (!play) throw new Error('no play block')
    expect(heldFund(play, undefined)).toBeNull()
    expect(heldFund(play, [])).toBeNull()
    expect(heldFund(play, [{ symbol: 'QQQ', value: 100 }, { symbol: 'VOO', value: 0 }])).toBeNull()
    const held = heldFund(play, [{ symbol: 'VOO', value: 10000 }, { symbol: 'AAPL', value: 500 }, { symbol: 'VOO', value: 662 }])
    expect(held?.held).toBe(10662)
    expect(held?.weight).toBe(0.07)
    expect(held?.inside).toBeCloseTo(746.34, 2)
  })
})

describe('learning progress', () => {
  it('counts a daily streak and lapses after a missed day', () => {
    const day1 = completeLesson(EMPTY_PROGRESS, 'a', at(2026, 9, 26))
    expect(day1).toEqual({ completed: ['a'], lastDay: '2026-09-26', streak: 1 })
    const sameDay = completeLesson(day1, 'b', at(2026, 9, 26))
    expect(sameDay.streak).toBe(1)
    const day2 = completeLesson(sameDay, 'a', at(2026, 9, 27))
    expect(day2).toEqual({ completed: ['a', 'b'], lastDay: '2026-09-27', streak: 2 })
    expect(currentStreak(day2, at(2026, 9, 28))).toBe(2)
    expect(currentStreak(day2, at(2026, 9, 29))).toBe(0)
    expect(completeLesson(day2, 'c', at(2026, 9, 30)).streak).toBe(1)
  })
  it('handles month and year boundaries in local time', () => {
    expect(localDay(at(2026, 1, 5))).toBe('2026-01-05')
    const dec31 = completeLesson(EMPTY_PROGRESS, 'a', at(2026, 12, 31))
    expect(completeLesson(dec31, 'b', at(2027, 1, 1)).streak).toBe(2)
  })
})

describe('growth illustration', () => {
  it('matches the future value of monthly contributions', () => {
    expect(growth(100, 10, 0)).toEqual({ contributed: 12000, value: 12000 })
    const g = growth(100, 30, 0.06)
    expect(g.contributed).toBe(36000)
    expect(g.value).toBeCloseTo(100451.5, 1)
    expect(growth(-5, 10, 0.06)).toEqual({ contributed: 0, value: 0 })
  })
  it('formats whole dollars', () => {
    expect(currencyWhole(100451.5)).toBe("$100,452")
    expect(currencyWhole(null)).toBe('—')
  })
})


describe('saved lesson progress', () => {
  it('deduplicates known lessons and ignores unknown or malformed entries', () => {
    expect(parseProgress(JSON.stringify({ completed: ['funds', 'funds', 'unknown', null, 5], lastDay: '2026-09-26', streak: 2 })).completed).toEqual(['funds'])
  })
  it('recovers from malformed storage and rejects impossible dates and streaks', () => {
    for (const raw of ['', 'null', 'oops', '42', '[]']) expect(parseProgress(raw)).toEqual(EMPTY_PROGRESS)
    expect(parseProgress('{"lastDay":"2026-02-30","streak":9}')).toEqual(EMPTY_PROGRESS)
    expect(parseProgress('{"lastDay":"2026-09-26","streak":1e309}').streak).toBe(0)
  })
})
