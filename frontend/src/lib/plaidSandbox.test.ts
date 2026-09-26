import { describe, expect, it } from 'vitest'
import { sampleAccountEnabled } from './plaidSandbox'

describe('sampleAccountEnabled', () => {
  it('is on by default, including production builds with the flag unset', () => {
    expect(sampleAccountEnabled(undefined)).toBe(true)
    expect(sampleAccountEnabled('')).toBe(true)
  })

  it('is on for any value other than false', () => {
    expect(sampleAccountEnabled('true')).toBe(true)
    expect(sampleAccountEnabled('1')).toBe(true)
  })

  it('turns off only for false, ignoring case and whitespace', () => {
    expect(sampleAccountEnabled('false')).toBe(false)
    expect(sampleAccountEnabled(' FALSE ')).toBe(false)
  })
})
