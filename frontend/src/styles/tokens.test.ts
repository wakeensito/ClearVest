import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// DESIGN.md is the source of truth for tokens; this fails when tokens.css drifts from it.
describe('tokens.css', () => {
  it('matches DESIGN.md section 13', () => {
    const design = readFileSync(new URL('../../../DESIGN.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
    const block = /## 13\. Implementation: tokens[\s\S]*?```css\n([\s\S]*?)```/.exec(design)?.[1]
    const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
    expect(block).toBeTruthy()
    expect(tokens.slice(tokens.indexOf('\n') + 1)).toBe(block)
  })
})
