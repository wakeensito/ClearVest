// The subset of markdown advisor replies may use (DESIGN.md §4.8): paragraphs, bullet and numbered
// lists, **bold**. Line-based, because model output often starts a list without a blank line.

export type Block = { kind: 'p'; text: string } | { kind: 'ul' | 'ol'; items: string[] }

const BULLET = /^\s*[-*•]\s+/
const NUMBERED = /^\s*\d+[.)]\s+/

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'p', text: paragraph.join(' ') })
    paragraph = []
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const kind = BULLET.test(raw) ? 'ul' : NUMBERED.test(raw) ? 'ol' : null
    if (!line) {
      flush()
    } else if (kind) {
      flush()
      const item = raw.replace(kind === 'ul' ? BULLET : NUMBERED, '').trim()
      const last = blocks[blocks.length - 1]
      if (last && last.kind === kind) last.items.push(item)
      else blocks.push({ kind, items: [item] })
    } else {
      paragraph.push(line)
    }
  }
  flush()
  return blocks
}

/** Splits `**bold**` runs out of a line; odd segments are bold. */
export function splitBold(text: string): string[] {
  return text.split(/\*\*([^*]+)\*\*/g)
}
