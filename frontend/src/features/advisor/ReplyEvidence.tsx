import type { ChatMessage } from './chatContext'
import styles from './ReplyEvidence.module.css'

/** A receipt for checks that actually ran, never a blanket "safe AI" badge. */
export function ReplyEvidence({ message }: { message: ChatMessage }) {
  if (!message.safety) return null
  const { safety, sources } = message
  const receipts = safety.status === 'passed' && sources?.map((source, i) => <details key={source.label}>
      <summary>{safety.grounding === 'checked' ? (source.kind === 'portfolio' || !source.kind ? 'Checked against your portfolio' : 'Checked against source') : 'Context used'} · [{i + 1}] View source</summary>
      <p>{source.label} · {source.asOf}</p>
      {source.retrievedAt && <p>Retrieved {source.retrievedAt}</p>}
      <p className={styles.source}>{source.text}</p>
      {source.url && (/^https?:\/\//.test(source.url) || /^\/learn\/[a-z0-9-]+$/.test(source.url)) && <a href={source.url} target="_blank" rel="noopener noreferrer">{source.kind === 'news' ? 'Read the publisher’s article' : 'Open source'}</a>}
    </details>)
  return <div className={styles.evidence}>
    {safety.status === 'intervened' && <p>{safety.grounding === 'withheld' ? 'Answer held back · source check' : 'Safety boundary applied'}</p>}
    {safety.status === 'unavailable' && <p>Safety checks unavailable · no model answer shown</p>}
    {receipts && receipts.length > 1 ? <details>
      <summary>Sources ({receipts.length}) · {safety.grounding === 'checked' ? 'Checked against references' : 'Context used'}</summary>
      {receipts}
    </details> : receipts}
  </div>
}
