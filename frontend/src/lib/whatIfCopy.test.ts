// Copy and input rules for the ticker-page "What would this do to my portfolio?" card (DESIGN.md §4.15).
import { describe, expect, it } from 'vitest'
import { AMOUNT_MAX, biggestCompanyLine, parseAmount, whatIfCaption } from './whatIfCopy'

describe('parseAmount', () => {
  it('an empty box means "use the preset"', () => {
    expect(parseAmount('')).toEqual({ status: 'empty' })
    expect(parseAmount('   ')).toEqual({ status: 'empty' })
  })

  it('accepts whole and decimal dollars, with or without $ and thousands commas', () => {
    expect(parseAmount('2500')).toEqual({ status: 'ok', dollars: 2500 })
    expect(parseAmount('$2,500')).toEqual({ status: 'ok', dollars: 2500 })
    expect(parseAmount('12.50')).toEqual({ status: 'ok', dollars: 12.5 })
    expect(parseAmount('1')).toEqual({ status: 'ok', dollars: 1 })
    expect(parseAmount('1,000,000')).toEqual({ status: 'ok', dollars: AMOUNT_MAX })
  })

  it('rejects anything outside $1 to $1,000,000 or not a number', () => {
    for (const raw of ['0', '0.5', '-5', '1000001', 'abc', '1e3', '12..5', '$']) {
      expect(parseAmount(raw)).toEqual({ status: 'invalid' })
    }
  })
})

describe('biggestCompanyLine', () => {
  const apple = { symbol: 'AAPL', name: 'Apple', share: 0.2 }
  const nvidia = { symbol: 'NVDA', name: 'NVIDIA', share: 0.21 }

  it('speaks only when the biggest single company changes', () => {
    expect(biggestCompanyLine(apple, nvidia)).toBe('NVDA would become your biggest single company.')
    expect(biggestCompanyLine(apple, apple)).toBeNull()
    expect(biggestCompanyLine(apple, null)).toBeNull()
  })

  it('a first company in an account with none before still reads plainly; a nameless holding uses its name', () => {
    expect(biggestCompanyLine(null, nvidia)).toBe('NVDA would become your biggest single company.')
    expect(biggestCompanyLine(apple, { symbol: null, name: 'Samsung Electronics', share: 0.3 })).toBe('Samsung Electronics would become your biggest single company.')
  })
})

describe('whatIfCaption', () => {
  it('counts the account funds that were looked inside', () => {
    expect(whatIfCaption({ checked: 3, total: 3 })).toBe("Counting each fund's top 10 holdings (3 of 3 funds checked). Educational, not a recommendation.")
    expect(whatIfCaption({ checked: 2, total: 3 })).toContain('(2 of 3 funds checked)')
  })

  it('a stock-only account has no funds to count', () => {
    expect(whatIfCaption({ checked: 0, total: 0 })).toBe('Based on your holdings. Educational, not a recommendation.')
  })
})
