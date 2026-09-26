import { describe, expect, it } from 'vitest'
import { parseBlocks, splitBold } from './parseMarkdown'

describe('parseBlocks', () => {
  it('splits a list that follows a sentence without a blank line', () => {
    expect(parseBlocks('Three things drive it:\n- Concentration\n- Asset mix')).toEqual([
      { kind: 'p', text: 'Three things drive it:' },
      { kind: 'ul', items: ['Concentration', 'Asset mix'] },
    ])
  })

  it('joins wrapped lines into one paragraph and separates paragraphs on blank lines', () => {
    expect(parseBlocks('One\ntwo\n\nThree')).toEqual([
      { kind: 'p', text: 'One two' },
      { kind: 'p', text: 'Three' },
    ])
  })

  it('reads numbered lists', () => {
    expect(parseBlocks('1. Roth IRA\n2) 401(k)')).toEqual([{ kind: 'ol', items: ['Roth IRA', '401(k)'] }])
  })
})

describe('splitBold', () => {
  it('puts bold runs at odd indexes', () => {
    expect(splitBold('score is **58** today')).toEqual(['score is ', '58', ' today'])
  })
})
