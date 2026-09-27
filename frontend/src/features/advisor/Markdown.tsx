import { Fragment, type ReactNode } from 'react'
import { Term } from '../../components/education/Term'
import { explainPieces } from '../../lib/explainTerms'
import styles from './Markdown.module.css'
import { parseBlocks, splitBold, type Block } from './parseMarkdown'

// Rendered as React nodes, never innerHTML, so model output can't inject markup.
// Investing terms become tap-to-explain buttons, each only the first time it appears in a reply.
// `seen` is null when explanations are off (the default), which renders plain text exactly as before.
// Plain functions, not components: the whole reply is planned in one render pass, so React's double
// render in development can't spend the shared `seen` set twice.
function inline(text: string, seen: Set<string> | null): ReactNode {
  const render = (part: string): ReactNode =>
    seen ? explainPieces(part, seen).map((piece, k) => (typeof piece === 'string' ? piece : <Term key={k} text={piece.text} explainer={piece.explainer} />)) : part
  return splitBold(text).map((part, i) => (i % 2 ? <strong key={i}>{render(part)}</strong> : <Fragment key={i}>{render(part)}</Fragment>))
}

/** Up to three columns fit a 320px phone; wider tables scroll inside their own region. */
const FITTED_COLUMNS = 3

function table(key: number, block: Extract<Block, { kind: 'table' }>, seen: Set<string> | null) {
  const wide = block.head.length > FITTED_COLUMNS
  return (
    // A focusable, labelled region so keyboard and screen-reader users can reach and scroll it.
    <div
      key={key}
      className={`${styles.tableWrap} ${wide ? styles.wide : ''}`}
      role="region"
      aria-label="Comparison table"
      tabIndex={0}
    >
      <table className={styles.table}>
        <thead>
          <tr>
            {block.head.map((cell, j) => (
              <th key={j} scope="col">
                {inline(cell, seen)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {inline(cell, seen)}
                  </th>
                ) : (
                  <td key={j}>
                    {inline(cell, seen)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** `explain` turns investing terms into tap-to-explain buttons (the advisor page opts in). */
export function Markdown({ text, explain = false }: { text: string; explain?: boolean }) {
  // Rebuilt every render, so the same reply always underlines the same first occurrences.
  const seen = explain ? new Set<string>() : null
  return (
    <>
      {parseBlocks(text).map((block, i) => {
        switch (block.kind) {
          case 'p':
            return (
              <p key={i}>
                {inline(block.text, seen)}
              </p>
            )
          case 'h':
            // A bold lead-in, not an h1–h6: replies sit inside the page's own heading outline.
            return (
              <p key={i} className={styles.lead}>
                {inline(block.text, seen)}
              </p>
            )
          case 'table':
            return table(i, block, seen)
          default: {
            const List = block.kind
            return (
              <List key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>
                    {inline(item, seen)}
                  </li>
                ))}
              </List>
            )
          }
        }
      })}
    </>
  )
}
