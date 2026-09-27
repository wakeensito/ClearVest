import { describe, expect, it } from 'vitest'
import { focusReturnTarget } from './focusReturn'

const el = (isConnected: boolean) => ({ isConnected, focus: () => {} })

describe('focusReturnTarget', () => {
  it('returns focus to what had it when the dialog opened (the search box after Shift+Enter)', () => {
    const search = el(true)
    const button = el(true)
    expect(focusReturnTarget(search, button)).toBe(search)
  })

  it('falls back when nothing was remembered, it left the page, or it cannot take focus', () => {
    const button = el(true)
    expect(focusReturnTarget(null, button)).toBe(button)
    expect(focusReturnTarget(el(false), button)).toBe(button)
    expect(focusReturnTarget({ isConnected: true } as unknown as Element, button)).toBe(button)
    expect(focusReturnTarget(null, null)).toBe(null)
  })
})
