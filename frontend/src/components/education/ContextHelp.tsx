import type { ReactNode } from 'react'
import styles from './ContextHelp.module.css'
export function ContextHelp({ title, children }: { title: string; children: ReactNode }) {
  return <details className={styles.help}><summary>{title}</summary><div>{children}</div></details>
}
