import { Search } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Fragment, useId, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from 'react'
import { useNavigate } from 'react-router'
import type { FundKind } from '../../api/client'
import { companySearchQuery, useCompanySearch } from '../../api/queries'
import { HIGH_RISK, type FundState } from '../../lib/fundExplainer'
import { answeredLocally, chipsFor, compareTarget, escapeAction, moveHighlight, providerState, resolveRowSubmit, rowSuggestions, searchTerm, shouldAwaitSearch, type SubmitResult } from '../../lib/searchBox'
import { buildRows, GROUP_LABELS, providerTerm, showGroupHeaders, type ProviderState, type Row } from '../../lib/searchIntent'
import { useDebounce } from '../../lib/useDebounce'
import styles from './SymbolSearch.module.css'

const NO_MATCHES = 'No matches. Try a ticker such as VOO, or ask the advisor.'

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
  /** The symbol being researched now and its fund facts: fund rows can then offer "Compare with …". */
  current?: string
  currentFund?: FundState
  /** Present → fund rows get "Compare with <current>" (Shift+Enter from the keyboard). */
  onCompare?: (symbol: string) => void
  /** Only list these kinds (Compare companies passes `['stock']`). */
  kinds?: readonly FundKind[]
  /** Suggestions shown while the box is empty. */
  chips?: readonly string[]
}

/**
 * One box for anything a beginner types: a ticker, a company or fund name, or a category word such
 * as "index fund" (DESIGN.md §4.1, §4.9, §4.17). Curated funds answer instantly from the raw text;
 * provider names arrive after a 300 ms pause; a question hands off to the advisor. Enter follows
 * `resolveRowSubmit`. The list is an in-flow block under the input so it can never overflow a
 * 320px screen or hide behind a phone keyboard.
 */
export function SymbolSearch({
  value = '', onSelect, inputRef, clearOnSelect = false, label = 'Find a stock or fund', placeholder = 'Apple, index fund, VOO…', className,
  current, currentFund, onCompare, kinds, chips,
}: SymbolSearchProps) {
  const id = useId()
  const listId = `${id}-list`
  const navigate = useNavigate()
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
  // Curated and intent rules read the RAW text ("index fund"); only the provider call is normalized.
  const term = providerTerm(input) ? searchTerm(input) : ''
  const [settled, flush] = useDebounce(term)
  // Only the settled draft searches: the prefilled symbol ("VOO") settling late must not cost a call
  // once the user has typed "v" (one character never reaches the provider).
  const query = useCompanySearch(typed && settled === term ? settled : '')
  const queryClient = useQueryClient()
  // Bumped by every edit and pick, so an Enter still waiting on its search can tell it is outdated.
  const edits = useRef(0)
  const provider = providerState(input, { typed, term, settled, data: query.data, isError: query.isError })
  const build = (draft: string, state: ProviderState) => buildRows(draft, { provider: state, current, currentFund, canCompare: !!onCompare, kinds })
  const built = build(input, provider)
  const showList = open && typed && built.intent !== 'empty'
  const rows = showList ? built.rows : []
  const active = rows[highlighted] ? `${listId}-${highlighted}` : undefined
  // Announced after the same pause as the search, never once per keystroke.
  const [announced] = useDebounce(showList ? built.status : '')
  const shownChips = input.trim() === '' ? chipsFor(chips, kinds) : []

  const close = () => { setOpen(false); setHighlighted(-1) }
  const pick = (symbol: string) => {
    edits.current += 1
    setError(''); close(); setTyped(false)
    setInput(clearOnSelect ? '' : symbol)
    onSelect(symbol)
  }
  const act = (result: SubmitResult) => {
    if ('error' in result) { setError(result.error); return }
    if ('advisor' in result) { edits.current += 1; close(); void navigate(result.advisor); return }
    pick(result.symbol)
  }
  const choose = (row: Row) => act(row.type === 'advisor' ? { advisor: row.href } : { symbol: row.symbol })
  const compare = (symbol: string | null) => {
    if (!symbol || !onCompare) return
    edits.current += 1
    close(); setTyped(false); setError(''); setInput(clearOnSelect ? '' : value)
    onCompare(symbol)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const shown = showList ? highlighted : -1
    const loading = query.isFetching || (!query.data && !query.isError)
    // A category word ("index fund", "ETF", "bonds") is answered by the curated list already on screen.
    const local = answeredLocally(built.rows)
    // Enter never races the search: settle the pause now and resolve against that search's answer.
    if (shown === -1 && typed && term !== '' && !local && shouldAwaitSearch(input, settled === term, loading, rowSuggestions(built.rows))) {
      const draft = input
      const edit = edits.current
      flush(); setOpen(true)
      const answer = draft.trim()
      queryClient.fetchQuery(companySearchQuery(term)).then(
        (data) => {
          if (edits.current !== edit) return
          act(resolveRowSubmit(draft, build(draft, { query: answer, status: 'success', results: data.results, unavailable: data.unavailable, stale: data.stale }).rows, -1))
        },
        // A failed search never blocks: a ticker-shaped draft becomes a "Look up" row and researches.
        () => { if (edits.current === edit) act(resolveRowSubmit(draft, build(draft, { query: answer, status: 'error', results: [] }).rows, -1)) },
      )
      return
    }
    act(resolveRowSubmit(input, built.rows, shown))
  }
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && typed && built.rows.length) {
      event.preventDefault()
      setOpen(true)
      setHighlighted(moveHighlight(showList ? highlighted : -1, event.key === 'ArrowDown' ? 1 : -1, built.rows.length))
    } else if ((event.key === 'Home' || event.key === 'End') && rows.length && highlighted >= 0) {
      event.preventDefault()
      setHighlighted(event.key === 'Home' ? 0 : rows.length - 1)
    } else if (event.key === 'Enter' && event.shiftKey && rows.length) {
      // The keyboard path to "Compare with …"; a row without it does nothing (never a stray submit).
      event.preventDefault()
      compare(compareTarget(rows, highlighted))
    } else if (event.key === 'Escape') {
      // First Escape closes the list, the second clears the box. Neither reaches a dialog or explainer.
      const action = escapeAction(showList, input)
      if (!action) return
      event.preventDefault()
      event.stopPropagation()
      if (action === 'close') close()
      else { edits.current += 1; setInput(''); setTyped(false); setError('') }
    }
  }
  const tapChip = (chip: string) => {
    edits.current += 1
    setInput(chip); setTyped(true); setOpen(true); setHighlighted(-1); setError('')
    document.getElementById(id)?.focus()
  }
  const hint = `Arrow keys move through results. Enter researches.${onCompare ? ` Shift+Enter compares${current ? ` with ${current}` : ''}.` : ''}`

  return <div className={`${styles.box} ${className ?? ''}`}>
    <label htmlFor={id} className={styles.label}>{label}</label>
    <form onSubmit={submit} className={styles.field} role="search">
      <input
        ref={inputRef} id={id} value={input} placeholder={placeholder} maxLength={80} spellCheck={false} autoComplete="off"
        autoCapitalize="none" enterKeyHint="search"
        role="combobox" aria-autocomplete="list" aria-expanded={showList && rows.length > 0} aria-controls={listId} aria-activedescendant={active}
        aria-invalid={!!error} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
        onChange={(event) => { edits.current += 1; setInput(event.target.value); setTyped(true); setOpen(true); setHighlighted(-1); setError('') }}
        onKeyDown={keyDown}
        onBlur={close}
      />
      <button type="submit" aria-label="Research symbol"><Search size={17} aria-hidden /></button>
    </form>
    <p id={`${id}-hint`} className="sr-only">{hint}</p>
    {shownChips.length > 0 && <div className={styles.chips} aria-label="Try one" data-search-chips>
      {shownChips.map(chip => <button key={chip} type="button" className={styles.chip} onMouseDown={(event) => event.preventDefault()} onClick={() => tapChip(chip)}>{chip}</button>)}
    </div>}
    {showList && <SuggestionList id={listId} rows={rows} highlighted={highlighted} note={noteFor(built)} compareWith={current} onPick={choose} onCompare={(row) => compare(row.symbol)} />}
    <p role="status" className="sr-only">{announced}</p>
    {error && <p id={`${id}-error`} role="alert" className="t-body-sm c-loss">{error}</p>}
  </div>
}

/** The quiet caption above the list: provider trouble first, then "No matches" when only the advisor is left. */
function noteFor({ intent, rows, notice, status }: ReturnType<typeof buildRows>): string | null {
  if (notice) return notice
  if (!rows.length) return status
  if (intent !== 'open' && rows.every(row => row.type === 'advisor')) return NO_MATCHES
  return null
}

export interface SuggestionListProps {
  id: string
  rows: readonly Row[]
  highlighted: number
  /** A quiet caption: "Searching…", "Live search is unavailable", "Previously saved results". */
  note?: string | null
  /** The researched symbol named on each "Compare with …" button. */
  compareWith?: string
  onPick: (row: Row) => void
  onCompare?: (row: Extract<Row, { type: 'security' }>) => void
}

/** The rows from `buildRows`: group headers only when there is more than one group. */
export function SuggestionList({ id, rows, highlighted, note, compareWith, onPick, onCompare }: SuggestionListProps) {
  if (!rows.length) return note ? <p id={id} className={styles.note}>{note}</p> : null
  const headers = showGroupHeaders(rows)
  const option = (row: Row, index: number) => <li
    key={row.id} id={`${id}-${index}`} role="option" aria-selected={index === highlighted} className={styles.option}
    // Keep focus in the input so blur does not close the list before the click lands.
    onMouseDown={(event) => event.preventDefault()}
    onClick={() => onPick(row)}
  >
    <RowBody row={row} />
    {row.type === 'security' && row.compare && onCompare && <button
      type="button" tabIndex={-1} className={styles.compare} aria-label={`Compare with ${compareWith}`}
      onClick={(event) => { event.stopPropagation(); onCompare(row) }}
    >Compare<span className={styles.withCurrent}> with {compareWith}</span></button>}
  </li>
  const groups: { group: Row['group']; items: { row: Row; index: number }[] }[] = []
  rows.forEach((row, index) => {
    const last = groups[groups.length - 1]
    if (last?.group === row.group) last.items.push({ row, index })
    else groups.push({ group: row.group, items: [{ row, index }] })
  })
  return <>
    {note && <p className={styles.note}>{note}</p>}
    <ul id={id} role="listbox" aria-label="Suggestions" className={styles.list}>
      {headers ? groups.map(({ group, items }) => <Fragment key={group}>
        <li role="presentation" className={styles.group}>{GROUP_LABELS[group]}</li>
        {items.map(({ row, index }) => option(row, index))}
      </Fragment>) : rows.map(option)}
    </ul>
  </>
}

function RowBody({ row }: { row: Row }) {
  if (row.type === 'advisor') return <span className={styles.main}><span className={styles.title}>Ask the advisor: “{row.query}” →</span></span>
  if (row.type === 'lookup') return <span className={styles.main}><span className={styles.title}>Look up <span className={`t-mono ${styles.symbol}`}>{row.symbol}</span> as a ticker</span></span>
  const risk = ` · ${HIGH_RISK}`
  const label = row.leveraged && row.label.endsWith(risk) ? row.label.slice(0, -risk.length) : row.label
  return <span className={styles.main}>
    <span className={styles.title}><span className={`t-mono ${styles.symbol}`}>{row.symbol}</span><span className={styles.name}>{row.name}</span></span>
    <span className={styles.meta}>
      {label}{row.leveraged && <> · <span className="c-loss">{HIGH_RISK}</span></>}
      {row.sameLabel && <> · <span className={styles.same}>{row.sameLabel}</span></>}
      {row.exchange && <> · <span className={styles.exchange}>{row.exchange}</span></>}
    </span>
    {row.oneLiner && <span className={styles.oneLiner}>{row.oneLiner}</span>}
  </span>
}
