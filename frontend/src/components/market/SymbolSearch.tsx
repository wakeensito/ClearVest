import { Search } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from 'react'
import { companySearchQuery, useCompanySearch } from '../../api/queries'
import { EMPTY_SEARCH_ERROR, MAX_SUGGESTIONS, moveHighlight, normalizeQuery, resolveSubmit, searchTerm, shouldAwaitSearch, TICKER, type Suggestion } from '../../lib/searchBox'
import { useDebounce } from '../../lib/useDebounce'
import styles from './SymbolSearch.module.css'

export type SuggestionStatus = 'hidden' | 'loading' | 'empty' | 'ready'

export interface SymbolSearchProps {
  /** The researched symbol. The box shows it, and a new one (from anywhere) replaces the draft. */
  value?: string
  onSelect: (symbol: string) => void
  /** The explainer returns focus here (`useExplainer`), so it must reach the real input. */
  inputRef?: Ref<HTMLInputElement>
  /** Empty the box after a pick (adding to a list) instead of showing the picked symbol. */
  clearOnSelect?: boolean
  label?: string
  placeholder?: string
  className?: string
}

/**
 * One box for tickers and company names (DESIGN.md §4.1, §4.9). Typing two or more characters shows
 * up to eight `/market/search` suggestions after a 300 ms pause; Enter follows `resolveSubmit`. The
 * list is an in-flow block under the input so it can never overflow a 320px screen.
 */
export function SymbolSearch({ value = '', onSelect, inputRef, clearOnSelect = false, label = 'Search a ticker or company', placeholder = 'Search a ticker or company (VOO, Apple, …)', className }: SymbolSearchProps) {
  const id = useId()
  const listId = `${id}-list`
  const [input, setInput] = useState(value)
  const [synced, setSynced] = useState(value)
  // Only a user's own typing searches: the prefilled symbol on each mounted panel costs no request.
  const [typed, setTyped] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [error, setError] = useState('')
  if (value !== synced) {
    setSynced(value); setInput(value); setTyped(false); setOpen(false); setHighlighted(-1); setError('')
  }
  const term = searchTerm(input)
  const [settled, flush] = useDebounce(term)
  const query = useCompanySearch(typed ? settled : '')
  const queryClient = useQueryClient()
  // Bumped by every edit and pick, so an Enter still waiting on its search can tell it is outdated.
  const edits = useRef(0)
  // Suggestions count only when they answer what is in the box now, never a draft from 300 ms ago.
  const current = typed && term !== '' && settled === term && !query.isError
  const suggestions = current && query.data ? query.data.results.slice(0, MAX_SUGGESTIONS) : []
  const status: SuggestionStatus = !open || !typed || !term || query.isError ? 'hidden'
    : !current || !query.data ? 'loading'
    : suggestions.length ? 'ready' : 'empty'
  const expanded = status !== 'hidden'
  const active = status === 'ready' && suggestions[highlighted] ? `${listId}-${highlighted}` : undefined

  const pick = (symbol: string) => {
    edits.current += 1
    setError(''); setOpen(false); setHighlighted(-1); setTyped(false)
    setInput(clearOnSelect ? '' : symbol)
    onSelect(symbol)
  }
  const finish = (result: { symbol: string } | { error: string }) => {
    if ('error' in result) { setError(result.error); return }
    pick(result.symbol)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const shown = status === 'ready' ? highlighted : -1
    const loading = typed && (query.isFetching || (!query.data && !query.isError))
    // Enter never races the search: settle the pause now and resolve against that search's answer.
    if (shown === -1 && typed && shouldAwaitSearch(input, settled === term, loading, suggestions)) {
      const draft = input
      const edit = edits.current
      flush(); setOpen(true)
      queryClient.fetchQuery(companySearchQuery(term)).then(
        (data) => { if (edits.current === edit) finish(resolveSubmit(draft, data.results.slice(0, MAX_SUGGESTIONS), -1)) },
        // A failed search never blocks: a ticker-shaped draft goes straight to the chart.
        () => {
          if (edits.current !== edit) return
          const upper = normalizeQuery(draft).toUpperCase()
          finish(TICKER.test(upper) ? { symbol: upper } : { error: EMPTY_SEARCH_ERROR })
        },
      )
      return
    }
    finish(resolveSubmit(input, suggestions, shown))
  }
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length) {
      event.preventDefault()
      setOpen(true)
      setHighlighted(moveHighlight(status === 'ready' ? highlighted : -1, event.key === 'ArrowDown' ? 1 : -1, suggestions.length))
    } else if (event.key === 'Escape' && status !== 'hidden') {
      // Close the list only; a second Escape reaches the explainer (it skips handled events).
      event.preventDefault()
      setOpen(false); setHighlighted(-1)
    }
  }

  return <div className={`${styles.box} ${className ?? ''}`}>
    <form onSubmit={submit} className={styles.field} role="search">
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        ref={inputRef} id={id} value={input} placeholder={placeholder} maxLength={80} spellCheck={false} autoComplete="off"
        role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={listId} aria-activedescendant={active}
        aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => { edits.current += 1; setInput(event.target.value); setTyped(true); setOpen(true); setHighlighted(-1) }}
        onKeyDown={keyDown}
        onBlur={() => { setOpen(false); setHighlighted(-1) }}
      />
      <button type="submit" aria-label="Research symbol"><Search size={17} aria-hidden /></button>
    </form>
    <SuggestionList id={listId} status={status} suggestions={suggestions} highlighted={highlighted} onPick={pick} />
    {error && <p id={`${id}-error`} role="alert" className="t-body-sm c-loss">{error}</p>}
  </div>
}

export function SuggestionList({ id, status, suggestions, highlighted, onPick }: { id: string; status: SuggestionStatus; suggestions: readonly Suggestion[]; highlighted: number; onPick: (symbol: string) => void }) {
  if (status === 'hidden') return null
  if (status === 'loading') return <p id={id} role="status" className={styles.note}>Searching…</p>
  if (status === 'empty') return <p id={id} role="status" className={styles.note}>No matches. Try a ticker such as VOO or a shorter name.</p>
  return <ul id={id} role="listbox" aria-label="Suggestions" className={styles.list}>
    {suggestions.map((item, index) => <li
      key={item.symbol} id={`${id}-${index}`} role="option" aria-selected={index === highlighted} className={styles.option}
      // Keep focus in the input so blur does not close the list before the click lands.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onPick(item.symbol)}
    >
      <span className={`t-mono ${styles.symbol}`}>{item.symbol}</span>
      <span className={styles.name}>{item.name}</span>
      {item.exchange && <span className={styles.exchange}>{item.exchange}</span>}
    </li>)}
  </ul>
}
