import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown } from './Markdown'
import { parseBlocks, splitBold, splitCells } from './parseMarkdown'

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

describe('parseBlocks headings', () => {
  it('reads #–###### headings as lead-ins and strips surrounding bold', () => {
    expect(parseBlocks('#### **401(k)**\nPre-tax money.')).toEqual([
      { kind: 'h', text: '401(k)' },
      { kind: 'p', text: 'Pre-tax money.' },
    ])
    expect(parseBlocks('# Big\n###### Small ##')).toEqual([
      { kind: 'h', text: 'Big' },
      { kind: 'h', text: 'Small' },
    ])
  })

  it('keeps a bare ### with no text as paragraph text', () => {
    expect(parseBlocks('###')).toEqual([{ kind: 'p', text: '###' }])
    expect(parseBlocks('###   ')).toEqual([{ kind: 'p', text: '###' }])
  })

  it('does not treat #hashtag without a space as a heading', () => {
    expect(parseBlocks('#ETFs are popular')).toEqual([{ kind: 'p', text: '#ETFs are popular' }])
  })
})

describe('parseBlocks tables', () => {
  const table = { kind: 'table', head: ['', '401(k)', 'Roth IRA'], rows: [['Tax', 'Pre-tax', 'After-tax']] }

  it('reads a GFM table with leading and trailing pipes', () => {
    expect(parseBlocks('| | 401(k) | Roth IRA |\n|---|---|---|\n| Tax | Pre-tax | After-tax |')).toEqual([table])
  })

  it('makes outer pipes optional and accepts alignment colons', () => {
    expect(parseBlocks('Feature | 401(k) | Roth IRA\n:--|:-:|--:\nTax | Pre-tax | After-tax |')).toEqual([
      { ...table, head: ['Feature', '401(k)', 'Roth IRA'] },
    ])
  })

  it('keeps a header without a delimiter row as paragraph text', () => {
    expect(parseBlocks('| A | B |\n| 1 | 2 |')).toEqual([{ kind: 'p', text: '| A | B | | 1 | 2 |' }])
  })

  it('keeps a header and delimiter with no body rows as paragraph text', () => {
    expect(parseBlocks('| A | B |\n|---|---|')).toEqual([{ kind: 'p', text: '| A | B | |---|---|' }])
    expect(parseBlocks('| A | B |\n|---|---|\n\nAfter')).toEqual([
      { kind: 'p', text: '| A | B | |---|---|' },
      { kind: 'p', text: 'After' },
    ])
  })

  it('needs the delimiter to match the header cell count', () => {
    expect(parseBlocks('A | B\n---|---|---\n1 | 2')[0].kind).toBe('p')
  })

  it('pads short rows with empty cells and drops cells beyond the header', () => {
    expect(parseBlocks('| A | B | C |\n|---|---|---|\n| 1 |\n| 1 | 2 | 3 | 4 | 5 |')).toEqual([
      {
        kind: 'table',
        head: ['A', 'B', 'C'],
        rows: [
          ['1', '', ''],
          ['1', '2', '3'],
        ],
      },
    ])
  })

  it('turns an escaped \\| into a literal pipe inside a cell', () => {
    expect(parseBlocks('| Term | Meaning |\n|---|---|\n| a \\| b | either \\| or |')).toEqual([
      { kind: 'table', head: ['Term', 'Meaning'], rows: [['a | b', 'either | or']] },
    ])
  })

  it('starts a table directly after a sentence with no blank line', () => {
    expect(parseBlocks('Here is how they compare:\n| | 401(k) | Roth IRA |\n|---|---|---|\n| Tax | Pre-tax | After-tax |')).toEqual([
      { kind: 'p', text: 'Here is how they compare:' },
      table,
    ])
  })

  it('ends a table at a sentence that follows it directly', () => {
    expect(parseBlocks('| | 401(k) | Roth IRA |\n|---|---|---|\n| Tax | Pre-tax | After-tax |\nBoth have limits.')).toEqual([
      table,
      { kind: 'p', text: 'Both have limits.' },
    ])
  })

  it('ends a table at a blank line and a list that follows', () => {
    expect(parseBlocks('| | 401(k) | Roth IRA |\n|---|---|---|\n| Tax | Pre-tax | After-tax |\n- Next step')).toEqual([
      table,
      { kind: 'ul', items: ['Next step'] },
    ])
  })

  it('does not treat a single pipe in prose as a table', () => {
    expect(parseBlocks('Compare A | B before choosing.\nThen decide.')).toEqual([
      { kind: 'p', text: 'Compare A | B before choosing. Then decide.' },
    ])
  })

  it('keeps bold markers inside cells for inline rendering', () => {
    const [block] = parseBlocks('| | 401(k) |\n|---|---|\n| **Match** | Often **free** money |')
    expect(block).toEqual({ kind: 'table', head: ['', '401(k)'], rows: [['**Match**', 'Often **free** money']] })
    expect(splitBold('Often **free** money')).toEqual(['Often ', 'free', ' money'])
  })
})

describe('splitCells', () => {
  it('keeps an escaped trailing pipe as cell content', () => {
    expect(splitCells('a | b \\|')).toEqual(['a', 'b |'])
  })
})

describe('Markdown rendering', () => {
  const render = (text: string) => renderToStaticMarkup(createElement(Markdown, { text }))

  it('renders a semantic, labelled, focusable table with row headers and bold cells', () => {
    const html = render('| | 401(k) | Roth IRA |\n|---|---|---|\n| **Tax** | Pre-tax | **After**-tax |')
    expect(html).toContain('role="region"')
    expect(html).toContain('aria-label="Comparison table"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('<thead><tr><th scope="col"></th><th scope="col">401(k)</th>')
    expect(html).toContain('<th scope="row"><strong>Tax</strong></th>')
    expect(html).toContain('<td><strong>After</strong>-tax</td>')
  })

  it('renders a heading as a bold lead-in paragraph, never an h1–h6', () => {
    const html = render('#### **401(k)** basics\nText')
    expect(html).not.toMatch(/<h[1-6]/)
    expect(html).toMatch(/^<p[^>]*><strong>401\(k\)<\/strong> basics<\/p><p>Text<\/p>$/)
  })

  it('escapes markup in model output instead of injecting it', () => {
    const html = render('| <b>x</b> | y |\n|---|---|\n| <img src=x onerror=alert(1)> | z |')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
})

describe('splitBold', () => {
  it('puts bold runs at odd indexes', () => {
    expect(splitBold('score is **58** today')).toEqual(['score is ', '58', ' today'])
  })
})
