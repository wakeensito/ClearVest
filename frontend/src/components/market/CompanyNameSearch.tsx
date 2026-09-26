import { useId, useRef, useState, type FormEvent } from 'react'
import { useCompanySearch } from '../../api/queries'
import { QueryView } from '../QueryView'
import { CompanyLogo } from './CompanyLogo'
import styles from './CompanyNameSearch.module.css'

export function CompanyNameSearch({ onSelect }: { onSelect: (symbol: string) => void }) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [error, setError] = useState('')
  const query = useCompanySearch(submitted)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = input.trim()
    if (!value) { setError('Enter a company name or ticker.'); return }
    setError('')
    if (value === submitted) void query.refetch()
    else setSubmitted(value)
  }
  return <details className={styles.search}>
    <summary>Don’t know the ticker? Find a company by name</summary>
    <p>A ticker is a short label for an investment. Apple’s is AAPL.</p>
    <form onSubmit={submit}><label className="sr-only" htmlFor={id}>Company name or ticker</label><input ref={inputRef} id={id} value={input} onChange={event => setInput(event.target.value)} maxLength={80} placeholder="e.g. Apple or Microsoft" aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} /><button type="submit">Find company</button></form>
    {error && <p id={`${id}-error`} role="alert">{error}</p>}
    {submitted && <QueryView query={query} label="Finding companies" noun="Company search">{data => data.results.length ? <><p role="status">Results for “{submitted}”{data.stale ? " · Previously saved results" : ""}</p><ul aria-label="Company search results">{data.results.map(result => <li key={result.symbol}><button onClick={() => { onSelect(result.symbol); setSubmitted(''); setInput(''); requestAnimationFrame(() => inputRef.current?.focus()) }}><CompanyLogo symbol={result.symbol} small /><span><strong>{result.name}</strong><small>{result.symbol}{result.exchange ? ` · ${result.exchange}` : ''}</small></span><span className={styles.action}>Explore</span></button></li>)}</ul></> : <p role="status">No companies found for “{submitted}”. Try a shorter name or a ticker such as AAPL.</p>}</QueryView>}
  </details>
}
