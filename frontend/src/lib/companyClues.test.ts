import { describe, expect, it } from 'vitest'
import { CLUES, GUIDED_RESEARCH, PROFESSOR_PROMPT, professorLink } from './companyClues'

describe('Home company-clues hook', () => {
  it('covers growth, profit, debt and price, one clue each', () => {
    expect(CLUES.map((c) => c.term)).toEqual(['Revenue', 'Net income', 'Debt', 'P/E ratio'])
  })
  it('asks the advisor to teach like a professor without promising safety', () => {
    expect(PROFESSOR_PROMPT).toMatch(/finance professor/)
    expect(PROFESSOR_PROMPT).toMatch(/income statement/)
    expect(PROFESSOR_PROMPT).toMatch(/no company is guaranteed not to fall/)
    expect(decodeURIComponent(professorLink.replace('/advisor?q=', ''))).toBe(PROFESSOR_PROMPT)
  })
  it('sends research to the guided company view', () => {
    expect(GUIDED_RESEARCH).toBe('/markets?symbol=AAPL&guided=1')
  })
})
