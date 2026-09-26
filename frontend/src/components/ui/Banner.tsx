import { AlertCircle, AlertTriangle, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './Banner.module.css'

type Tone = 'info' | 'warning' | 'error'

const ICONS = { info: Info, warning: AlertTriangle, error: AlertCircle }

/** Inline, next to what it's about. Errors are never toasts (DESIGN.md §4.12). */
export function Banner({ tone = 'info', action, children }: { tone?: Tone; action?: ReactNode; children: ReactNode }) {
  const Icon = ICONS[tone]
  return (
    <div className={`${styles.banner} ${styles[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={18} className={styles.icon} aria-hidden />
      <div className={styles.text}>{children}</div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
