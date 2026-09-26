import type { CSSProperties } from 'react'
import styles from './Skeleton.module.css'

/** Appears after 300ms so fast responses don't flash (DESIGN.md §4.12). CSS-only delay. */
export function Skeleton({ width = '100%', height = 16, style }: { width?: number | string; height?: number; style?: CSSProperties }) {
  return <span className={styles.skeleton} style={{ width, height, ...style }} aria-hidden />
}

/** A block of skeleton lines plus the "still working" note that fades in after 8s. */
export function SkeletonBlock({ lines = 3, label = 'Loading' }: { lines?: number; label?: string }) {
  return (
    <div className={styles.block} role="status" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
      <p className={`t-caption c-tertiary ${styles.slow}`}>Still working. This can take up to 30 seconds.</p>
    </div>
  )
}
