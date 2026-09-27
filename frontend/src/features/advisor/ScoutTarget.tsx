import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import styles from './ReplyActions.module.css'

/** Focus follows explicit Show me navigation, including content that loads asynchronously. */
export function ScoutTarget({ name, children, selected = true }: { name: string; children: ReactNode; selected?: boolean }) {
  const { search, key } = useLocation()
  const active = selected && new URLSearchParams(search).get('focus') === name
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!active) return
    const frame = requestAnimationFrame(() => { ref.current?.scrollIntoView({ block: 'center', behavior: 'instant' }); ref.current?.focus({ preventScroll: true }) })
    return () => cancelAnimationFrame(frame)
  }, [active, key])
  return <div ref={ref} tabIndex={active ? -1 : undefined} className={active ? styles.target : undefined} data-scout-highlight={active || undefined}>{children}</div>
}
