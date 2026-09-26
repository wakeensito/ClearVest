import styles from './Dots.module.css'

/** The loading indicator: three small squares pulsing in turn (square geometry, DESIGN.md §6). */
export function Dots({ label }: { label?: string }) {
  return (
    <span className={styles.dots} role={label ? 'status' : undefined} aria-label={label} aria-hidden={!label}>
      <span />
      <span />
      <span />
    </span>
  )
}
