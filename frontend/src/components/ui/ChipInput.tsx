import { Plus, X } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import styles from './ChipInput.module.css'

interface Props {
  id: string
  value: string[]
  onChange: (value: string[]) => void
  suggestions?: string[]
  max?: number
  maxLength?: number
  describedBy?: string
  placeholder?: string
}

/** Goals: up to 10 chips of at most 200 characters, matching the API limits (DESIGN.md §4.2). */
export function ChipInput({ id, value, onChange, suggestions = [], max = 10, maxLength = 200, describedBy, placeholder }: Props) {
  const [draft, setDraft] = useState('')
  const full = value.length >= max

  const add = (raw: string) => {
    const goal = raw.trim().slice(0, maxLength)
    if (!goal || full || value.some((v) => v.toLowerCase() === goal.toLowerCase())) return
    onChange([...value, goal])
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  const unused = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>
        {value.map((goal) => (
          <span key={goal} className={styles.chip}>
            {goal}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== goal))} aria-label={`Remove ${goal}`}>
              <X size={14} aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          maxLength={maxLength}
          disabled={full}
          aria-describedby={describedBy}
          placeholder={full ? `Up to ${max} goals` : placeholder}
          className={styles.input}
        />
      </div>
      {unused.length > 0 && !full && (
        <div className={styles.suggestions}>
          {unused.map((s) => (
            <button key={s} type="button" className={styles.suggestion} onClick={() => add(s)}>
              <Plus size={14} aria-hidden />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
