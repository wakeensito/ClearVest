import styles from './Markdown.module.css'
import { parseBlocks, splitBold, type Block } from './parseMarkdown'

// Rendered as React nodes, never innerHTML, so model output can't inject markup.
function Inline({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}
    </>
  )
}

/** Up to three columns fit a 320px phone; wider tables scroll inside their own region. */
const FITTED_COLUMNS = 3

function Table({ block }: { block: Extract<Block, { kind: 'table' }> }) {
  const wide = block.head.length > FITTED_COLUMNS
  return (
    // A focusable, labelled region so keyboard and screen-reader users can reach and scroll it.
    <div
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
                <Inline text={cell} />
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
                    <Inline text={cell} />
                  </th>
                ) : (
                  <td key={j}>
                    <Inline text={cell} />
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

export function Markdown({ text }: { text: string }) {
  return (
    <>
      {parseBlocks(text).map((block, i) => {
        switch (block.kind) {
          case 'p':
            return (
              <p key={i}>
                <Inline text={block.text} />
              </p>
            )
          case 'h':
            // A bold lead-in, not an h1–h6: replies sit inside the page's own heading outline.
            return (
              <p key={i} className={styles.lead}>
                <Inline text={block.text} />
              </p>
            )
          case 'table':
            return <Table key={i} block={block} />
          default: {
            const List = block.kind
            return (
              <List key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>
                    <Inline text={item} />
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
