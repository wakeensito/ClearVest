import { describe, expect, it } from 'vitest'
import {
  currency,
  currencyCompact,
  currencyParts,
  date,
  direction,
  MISSING,
  multiple,
  percent,
  percentFromFraction,
  quantity,
  signedCurrency,
} from './format'

describe('format', () => {
  it('formats currency with a true minus', () => {
    expect(currency(10000)).toBe('$10,000.00')
    expect(currency(-5)).toBe('−$5.00')
    expect(signedCurrency(123.45)).toBe('+$123.45')
    expect(signedCurrency(0)).toBe('$0.00')
  })

  it('splits cents off for the hero number', () => {
    expect(currencyParts(10000)).toEqual({ whole: '$10,000', cents: '.00' })
    expect(currencyParts(null)).toEqual({ whole: MISSING, cents: '' })
  })

  it('compacts currency only from $1M', () => {
    expect(currencyCompact(999_999)).toBe('$999,999.00')
    expect(currencyCompact(1_234_567)).toBe('$1.23M')
  })

  it('treats weights and returns as fractions, macro as percentages', () => {
    expect(percentFromFraction(0.5)).toBe('50.0%')
    expect(percentFromFraction(0.0494, { digits: 2, signed: true })).toBe('+4.94%')
    expect(percentFromFraction(-0.0231, { digits: 2, signed: true })).toBe('−2.31%')
    expect(percent(4.33)).toBe('4.33%')
  })

  it('formats multiples and quantities', () => {
    expect(multiple(65.4)).toBe('65.4×')
    expect(multiple(0.06)).toBe('0.06×')
    expect(quantity(20)).toBe('20')
    expect(quantity(0.123456)).toBe('0.1235')
  })

  it('shows an em dash for missing values', () => {
    expect(currency(null)).toBe(MISSING)
    expect(percent(undefined)).toBe(MISSING)
    expect(multiple(Number.NaN)).toBe(MISSING)
    expect(date(null)).toBe(MISSING)
  })

  it('reads date-only strings as local dates, not UTC', () => {
    expect(date('2026-08-01')).toBe('Aug 1, 2026')
  })

  it('reports direction', () => {
    expect(direction(2)).toBe(1)
    expect(direction(-2)).toBe(-1)
    expect(direction(0)).toBe(0)
    expect(direction(null)).toBe(0)
  })
})
