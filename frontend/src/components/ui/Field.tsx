import { AlertCircle } from 'lucide-react'
import { useId, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react'
import styles from './Field.module.css'

interface FieldProps {
  label: string
  help?: ReactNode
  error?: string
  /** Receives the ids to wire up aria-describedby and aria-invalid. */
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
  as?: 'div' | 'fieldset'
}

/** Label above, control, then help or error below (DESIGN.md §4.2). */
export function Field({ label, help, error, children, as = 'div' }: FieldProps) {
  const id = useId()
  const noteId = `${id}-note`
  const note = error ?? help
  const ids = { id, describedBy: note ? noteId : undefined, invalid: Boolean(error) }
  const Label = as === 'fieldset' ? 'legend' : 'label'
  const Wrapper = as

  return (
    <Wrapper className={styles.field}>
      <Label className={`t-caption ${styles.label}`} htmlFor={as === 'div' ? id : undefined}>
        {label}
      </Label>
      {children(ids)}
      {note && (
        <p id={noteId} className={`t-body-sm ${error ? styles.error : 'c-tertiary'}`}>
          {error && <AlertCircle size={14} aria-hidden />}
          {note}
        </p>
      )}
    </Wrapper>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={[styles.input, props.className].filter(Boolean).join(' ')} />
}

export interface Choice<T extends string> {
  value: T
  label: string
  description?: string
}

/** Radio cards: each option carries a one-line description (DESIGN.md §4.2). */
export function RadioCards<T extends string>({ name, options, value, onChange, describedBy }: {
  name: string
  options: Choice<T>[]
  value: T | undefined
  onChange: (value: T) => void
  describedBy?: string
}) {
  return (
    <div className={styles.radioCards} style={{ '--cols': options.length } as CSSProperties}>
      {options.map((o) => (
        <label key={o.value} className={styles.radioCard} data-checked={value === o.value || undefined}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            aria-describedby={describedBy}
            className={styles.radioControl}
          />
          <span className={styles.radioLabel}>{o.label}</span>
          {o.description && <span className={`t-body-sm c-secondary ${styles.radioDescription}`}>{o.description}</span>}
        </label>
      ))}
    </div>
  )
}
