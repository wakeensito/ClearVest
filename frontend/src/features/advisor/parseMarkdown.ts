// The subset of markdown advisor replies may use (DESIGN.md §4.8): paragraphs, bullet and numbered
// lists, `#` headings (shown as bold lead-ins), GFM comparison tables and **bold**. Line-based,
// because model output often starts a list or table without a blank line.

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }

const BULLET = /^\s*[-*•]\s+/
const NUMBERED = /^\s*\d+[.)]\s+/
const HEADING = /^#{1,6}\s+(.+)$/
const DELIMITER_CELL = /^:?-+:?$/
// A `|` not preceded by a backslash.
const PIPE = /(?<!\\)\|/

/** Splits a GFM table row into trimmed cells. Outer pipes are optional; `\|` is a literal pipe. */
export function splitCells(line: string): string[] {
  let row = line.trim()
  if (row.startsWith('|')) row = row.slice(1)
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1)
  return row.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, '|').trim())
}

function isDelimiterRow(line: string): boolean {
  if (!PIPE.test(line)) return false
  return splitCells(line).every((cell) => DELIMITER_CELL.test(cell))
}

function headingText(line: string): string | null {
  const match = HEADING.exec(line)
  if (!match) return null
  const text = (match[1] ?? '')
    .replace(/\s+#+$/, '') // optional closing hashes
    .trim()
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .trim()
  return text || null
}

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  const lines = text.split('\n')
  let paragraph: string[] = []

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'p', text: paragraph.join(' ') })
    paragraph = []
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? ''
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }

    const table = readTable(lines, i)
    if (table) {
      flush()
      blocks.push(table.block)
      i = table.end - 1
      continue
    }

    const heading = headingText(line)
    if (heading !== null) {
      flush()
      blocks.push({ kind: 'h', text: heading })
      continue
    }

    const kind = BULLET.test(raw) ? 'ul' : NUMBERED.test(raw) ? 'ol' : null
    if (kind) {
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

/**
 * A table needs a header row, a delimiter row with the same cell count, and at least one body row.
 * Body rows continue while lines contain a pipe; a blank line or plain sentence ends the table.
 * Ragged rows are padded with '' or truncated to the header width.
 */
function readTable(lines: string[], start: number): { block: Block; end: number } | null {
  const header = lines[start] ?? ''
  const delimiter = lines[start + 1]
  if (delimiter === undefined || !PIPE.test(header) || !isDelimiterRow(delimiter)) return null

  const head = splitCells(header)
  if (splitCells(delimiter).length !== head.length) return null

  const rows: string[][] = []
  let end = start + 2
  for (let line = lines[end]; line?.trim() && PIPE.test(line); line = lines[++end]) {
    const cells = splitCells(line).slice(0, head.length)
    while (cells.length < head.length) cells.push('')
    rows.push(cells)
  }
  if (!rows.length) return null
  return { block: { kind: 'table', head, rows }, end }
}

/** Splits `**bold**` runs out of a line; odd segments are bold. */
export function splitBold(text: string): string[] {
  return text.split(/\*\*([^*]+)\*\*/g)
}
