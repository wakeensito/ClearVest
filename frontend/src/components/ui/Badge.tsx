import { Clock } from 'lucide-react'
import type { ReactNode } from 'react'
import { timestamp } from '../../lib/format'
import styles from './Badge.module.css'

type Tone = 'neutral' | 'stale' | 'sandbox' | 'gain' | 'loss'

export function Badge({ tone = 'neutral', icon, title, children }: {
  tone?: Tone
  icon?: ReactNode
  title?: string
  children: ReactNode
}) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`} title={title}>
      {icon}
      {children}
    </span>
  )
}

/** Shown when a 200 carries `stale: true` (DESIGN.md §11): the data is still shown, just flagged. */
export function StaleBadge({ asOf }: { asOf?: string | null }) {
  return (
    <Badge tone="stale" icon={<Clock size={12} aria-hidden />} title={asOf ? `Cached ${timestamp(asOf)}` : 'Cached data'}>
      Cached data
    </Badge>
  )
}
