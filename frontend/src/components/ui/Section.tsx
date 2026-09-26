import type { ReactNode } from 'react'
import styles from './Section.module.css'

interface Props {
  eyebrow?: string
  title?: ReactNode
  /** Page titles use the larger h1; sections use h2. */
  level?: 1 | 2
  actions?: ReactNode
  /** Compatibility flag for an unframed section. */
  bare?: boolean
  className?: string
  children?: ReactNode
}

/** Shared section heading; avoid repeating a category label when a title is present. */
export function Section({ eyebrow, title, level = 2, actions, bare, className, children }: Props) {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <section className={[styles.section, bare && styles.bare, className].filter(Boolean).join(' ')}>
      {(eyebrow || title || actions) && (
        <header className={styles.header}>
          <div>
            {eyebrow && !title && <p className={`t-overline c-tertiary ${styles.eyebrow}`}>{eyebrow}</p>}
            {title && <Heading className={level === 1 ? 't-h1' : 't-h2'}>{title}</Heading>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
