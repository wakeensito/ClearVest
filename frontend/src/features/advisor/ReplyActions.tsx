import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import type { ChatMessage } from './chatContext'
import { showMe } from './showMe'
import styles from './ReplyActions.module.css'

export function ReplyActions({ message, onNavigate }: { message: ChatMessage; onNavigate?: (destination: string) => void }) {
  const action = showMe(message)
  if (!action) return null
  return <div className={styles.actions}><Link to={action.to} onClick={() => onNavigate?.(action.to)}>{action.label}<ArrowUpRight size={14} aria-hidden /></Link></div>
}
