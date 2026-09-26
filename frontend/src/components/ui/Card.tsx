import type { ReactNode } from 'react'
import styles from './Card.module.css'

interface Props {
  title?: ReactNode
  /** Right side of the header: a badge, a tertiary action. */
  aside?: ReactNode
  /** "As of …" and source line (DESIGN.md §4.3). */
  footer?: ReactNode
  flush?: boolean
  className?: string
  children: ReactNode
}

export function Card({ title, aside, footer, flush, className, children }: Props) {
  return (
    <div className={[styles.card, flush && styles.flush, className].filter(Boolean).join(' ')}>
      {(title || aside) && (
        <div className={styles.header}>
          {title && <h3 className="t-h3">{title}</h3>}
          {aside && <div className={styles.aside}>{aside}</div>}
        </div>
      )}
      <div className={styles.body}>{children}</div>
      {footer && <p className={`t-caption c-tertiary ${styles.footer}`}>{footer}</p>}
    </div>
  )
}
