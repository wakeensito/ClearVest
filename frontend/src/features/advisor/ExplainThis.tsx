import { MessageCircle } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import type { ScoutPageContext } from './scoutContext'
import styles from './ReplyActions.module.css'

export interface ExplainSelection { question: string; context: ScoutPageContext }
export const EXPLAIN_EVENT = 'clearvest:explain'

/** A deliberate selection opens a draft; it never submits a question on the user's behalf. */
export function ExplainThis({ context, question, label = 'Explain this', disabled = false }: ExplainSelection & { label?: string; disabled?: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()
  return <button type="button" className={styles.explain} disabled={disabled} aria-label={`${label}: ${question}`} onClick={event => {
    event.currentTarget.closest('dialog')?.close()
    if (location.pathname === '/advisor') {
      const params = new URLSearchParams({ q: question, chat: '1' })
      if (context.symbol) params.set('symbol', context.symbol)
      if (context.metric) params.set('metric', context.metric)
      navigate(`/advisor?${params}`)
    } else requestAnimationFrame(() => window.dispatchEvent(new CustomEvent<ExplainSelection>(EXPLAIN_EVENT, { detail: { question, context } })))
  }}><MessageCircle size={14} aria-hidden />{label}</button>
}
