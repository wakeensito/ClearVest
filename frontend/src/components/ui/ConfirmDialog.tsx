import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'
import styles from './ConfirmDialog.module.css'

/** Native <dialog>: focus trap, Esc and inert background come free (DESIGN.md §4.12). */
export function ConfirmDialog({ open, title, confirmLabel, busy, onConfirm, onClose, children }: {
  open: boolean
  title: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="confirm-title"
    >
      <h2 id="confirm-title" className="t-h2">
        {title}
      </h2>
      <div className={`t-body c-secondary ${styles.body}`}>{children}</div>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
