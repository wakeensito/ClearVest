import { parseBlocks, splitBold } from './parseMarkdown'

// Rendered as React nodes, never innerHTML, so model output can't inject markup.
function Inline({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}
    </>
  )
}

export function Markdown({ text }: { text: string }) {
  return (
    <>
      {parseBlocks(text).map((block, i) => {
        if (block.kind === 'p') {
          return (
            <p key={i}>
              <Inline text={block.text} />
            </p>
          )
        }
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
      })}
    </>
  )
}
