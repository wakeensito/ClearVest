import { ArrowLeftRight, ChevronDown, Download, Plus, X } from 'lucide-react'
import { useId, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import type { Companies } from '../../api/client'
import { useCompanies } from '../../api/queries'
import { addCompanySymbols, companyMetrics, comparisonBar, comparisonSource, parseCompanySymbols } from '../../lib/companyComparison'
import { downloadComparison } from '../../lib/downloadComparison'
import { MISSING, timestamp } from '../../lib/format'
import { QueryView } from '../QueryView'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { SymbolSearch } from './SymbolSearch'
import { ContextHelp } from '../education/ContextHelp'
import { CompanyLogo } from './CompanyLogo'
import styles from './CompanyComparison.module.css'

const colors = ['var(--cv-viz-1)', 'var(--cv-viz-2)', 'var(--cv-viz-3)', 'var(--cv-viz-4)']
const groups = [
  { id: 'valuation', label: 'Valuation', question: 'What are you paying for?', description: 'Compare the price investors pay for each dollar of earnings and sales.', keys: ['pe', 'ps'] },
  { id: 'growth', label: 'Growth & profitability', question: 'How is the business performing?', description: 'Look at revenue growth, the share of sales retained and earnings per share.', keys: ['revenueGrowth', 'grossMargin', 'epsTTM'] },
  { id: 'strength', label: 'Financial strength', question: 'What supports the business?', description: 'Explore cash generation and debt relative to shareholder equity.', keys: ['fcfPerShare', 'debtToEquity'] },
]
const pairs = [ { label: 'Semiconductors', symbols: ['AMD', 'NVDA'] }, { label: 'Big tech', symbols: ['AAPL', 'MSFT'] }, { label: 'Payments', symbols: ['V', 'MA'] } ]

export function CompanyComparison({ selected, onSelectedChange }: { selected: string[]; onSelectedChange: (symbols: string[]) => void }) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState('')
  const [symbols, setSymbols] = useState<string[]>([])
  const [error, setError] = useState('')
  const [group, setGroup] = useState('valuation')
  const [view, setView] = useState('visual')
  const query = useCompanies(symbols)
  const add = (event: FormEvent) => {
    event.preventDefault()
    try { onSelectedChange(addCompanySymbols(selected, input)); setInput(''); setError(''); inputRef.current?.focus() }
    catch (error) { setError((error as Error).message) }
  }
  const run = (next = selected) => {
    try {
      const valid = parseCompanySymbols(next.join(','))
      setError(''); setInput(''); onSelectedChange(valid)
      if (valid.join(',') === symbols.join(',')) void query.refetch()
      else setSymbols(valid)
    } catch (error) { setError((error as Error).message); inputRef.current?.focus() }
  }
  const activeGroup = groups.find((item) => item.id === group) ?? groups[0]!
  const canDownload = query.isSuccess && query.data.companies.length > 0 && !query.isFetching
  return <section className={styles.panel} aria-labelledby={`${id}-heading`}>
    <header className={styles.heading}>
      <div><h2 id={`${id}-heading`}>Put companies in perspective</h2><p>Build your own comparison, then explore what the numbers mean.</p></div>
      <details className={styles.export} onKeyDown={(event) => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}>
        <summary><Download size={15} aria-hidden />Download<ChevronDown size={13} aria-hidden /></summary>
        <div className={styles.exportMenu}>{(['csv', 'json'] as const).map((format) => <button key={format} disabled={!canDownload} onClick={(event) => { if (query.data) downloadComparison(query.data, new Date(query.dataUpdatedAt).toISOString(), format); const menu = event.currentTarget.closest('details'); if (menu) { menu.open = false; menu.querySelector('summary')?.focus() } }}>Download {format.toUpperCase()}</button>)}{!canDownload && <p>Available after a comparison loads.</p>}</div>
      </details>
    </header>
    <div className={styles.builder}>
      <div className={styles.selections} aria-label="Selected companies">
        {selected.map((symbol, index) => <span className={styles.chip} key={symbol} style={{ '--company-color': colors[index] } as CSSProperties}><CompanyLogo symbol={symbol} small />{symbol}<button aria-label={`Remove ${symbol}`} onClick={() => { onSelectedChange(selected.filter((item) => item !== symbol)); setError('') }}><X size={14} aria-hidden /></button></span>)}
        {selected.length === 0 && <span className={styles.selectionHint}>Your comparison starts with 2–4 companies.</span>}
        <span className={styles.selectionCount}>{selected.length} / 4 selected</span>
      </div>
      <div className={styles.builderActions}>
        <form onSubmit={add} className={styles.addForm}>
          <label htmlFor={id} className="sr-only">Add company tickers</label>
          <input ref={inputRef} id={id} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Add ticker, e.g. AAPL" aria-invalid={!!error} aria-describedby={error ? `${id}-error` : `${id}-help`} spellCheck={false} autoCapitalize="characters" maxLength={58} disabled={selected.length >= 4} />
          <button type="submit" disabled={selected.length >= 4} aria-label="Add company"><Plus size={17} aria-hidden /></button>
        </form>
        <Button variant="primary" onClick={() => run()} loading={query.isFetching} loadingLabel="Comparing" icon={<ArrowLeftRight size={16} aria-hidden />}>Compare companies</Button>
      </div>
      <p id={`${id}-help`} className={styles.help}>Add tickers one at a time or separate them with commas.</p>
      {error && <p id={`${id}-error`} role="alert" className="t-body-sm c-loss">{error}</p>}
      <SymbolSearch clearOnSelect label="Find a company by name or ticker" placeholder="Find a company (Apple, Microsoft, …)" className={styles.finder} onSelect={symbol => { try { onSelectedChange(addCompanySymbols(selected, symbol)); setError('') } catch (error) { setError((error as Error).message) } }} />
      <div className={styles.presets}><span>Try a pair</span>{pairs.map((pair) => <button key={pair.label} disabled={query.isFetching} onClick={() => run(pair.symbols)}><span>{pair.label}</span><strong>{pair.symbols.join(' + ')}</strong></button>)}</div>
    </div>
    <ContextHelp title="How do I compare companies fairly?"><p>Start with businesses that sell similar things. A ratio puts a number in context: P/E compares share price with earnings per share, and a margin shows how much of each unit of sales remains after certain costs.</p><p>There is no universal good P/E. A lower number can reflect lower growth or higher risk. Negative or missing P/E values are not useful for this comparison. Per-share values below have no confirmed currency, so do not compare them across currencies.</p></ContextHelp>
    {symbols.length === 0 ? <div className={styles.empty}><ArrowLeftRight size={28} strokeWidth={1.5} aria-hidden /><h3>Different businesses. A common lens.</h3><p>Choose a pair above or add your own companies. Explore price, performance and financial strength with the same measures side by side.</p><div className={styles.emptyTopics}>{groups.map((item) => <div key={item.id}><strong>{item.label}</strong><span>{item.question}</span></div>)}</div></div> : <div className={styles.results}>
      <QueryView query={query} label="Loading company comparison" noun="Company comparison data">
        {(data) => data.companies.length === 0 ? <p className={styles.empty}>No company data was returned. Try another pair of tickers.</p> : <>
          <div className={styles.resultHeader}><div><h3>{data.companies.map((company) => company.symbol).join(' vs ')}</h3><div className={styles.legend}>{data.companies.map((company, index) => <span key={company.symbol} style={{ '--company-color': colors[index] } as CSSProperties}><i className={styles.dot} aria-hidden /><CompanyLogo symbol={company.symbol} small />{company.symbol}</span>)}{data.stale && <Badge tone="stale">Cached data</Badge>}</div></div><div className={styles.viewSwitch} role="group" aria-label="Comparison display"><button aria-pressed={view === 'visual'} onClick={() => setView('visual')}>Visual</button><button aria-pressed={view === 'table'} onClick={() => setView('table')}>Data table</button></div></div>
          {selected.join(',') !== symbols.join(',') && <p className={styles.draftNote} role="status">Your selection has changed. Compare again to update these results.</p>}
          {view === 'visual' ? <>
            <div className={styles.groupTabs} role="group" aria-label="Comparison focus">{groups.map((item) => <button key={item.id} aria-pressed={group === item.id} onClick={() => setGroup(item.id)}>{item.label}</button>)}</div>
            <div className={styles.groupHeading}><h4>{activeGroup.question}</h4><p>{activeGroup.description}</p></div>
            <div className={styles.metrics}>{companyMetrics.filter((metric) => activeGroup.keys.includes(metric.key)).map((metric) => <article key={metric.key} className={styles.metric} aria-label={metric.label}>
              <h4>{metric.label}</h4><p>{metric.description}</p>
              <ul>{data.companies.map((company, index) => {
                const geometry = comparisonBar(data.companies.map((entry) => entry[metric.key]), company[metric.key])
                return <li key={company.symbol} style={{ '--company-color': colors[index] } as CSSProperties}><div className={styles.barLabel}><span><i className={styles.dot} aria-hidden />{company.symbol}</span><strong><MetricValue value={metric.format(company[metric.key])} /></strong></div><div className={styles.barTrack} aria-hidden>{geometry && <><span className={styles.zero} style={{ left: `${geometry.zero}%` }} /><span className={styles.bar} style={{ left: `${geometry.left}%`, width: `${geometry.width}%` }} /></>}</div></li>
              })}</ul>
            </article>)}</div>
            <p className={styles.scaleNote}>Bars start at zero and use a separate scale for each measure. Length shows the value, not an investment rating.</p>
          </> : <ComparisonTable data={data} />}
          <details className={styles.notes}><summary>Sources & how to read this comparison</summary><div><p>{data.notes}</p><p>{comparisonSource}</p><p>Retrieved {timestamp(new Date(query.dataUpdatedAt).toISOString())}. Reporting periods may differ. Compare businesses in a similar industry; a higher or lower number alone does not identify a better investment.</p><p>Downloads include all seven measures with their raw values, units and source notes. Fraction values such as 0.532 equal 53.2%.</p></div></details>
        </>}
      </QueryView>
    </div>}
  </section>
}

function MetricValue({ value }: { value: string }) {
  return value === MISSING ? <span title="Not available from the data provider" aria-label="Not available from the data provider">{value}</span> : <>{value}</>
}

function ComparisonTable({ data }: { data: Companies }) {
  return <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Scrollable company comparison"><table className={styles.table}><caption>Fundamentals for {data.companies.map((company) => company.symbol).join(' and ')}</caption><thead><tr><th scope="col">Measure</th>{data.companies.map((company) => <th scope="col" key={company.symbol}>{company.symbol}</th>)}</tr></thead><tbody>{companyMetrics.map((metric) => <tr key={metric.key}><th scope="row">{metric.label}</th>{data.companies.map((company) => <td key={company.symbol}><MetricValue value={metric.format(company[metric.key])} /></td>)}</tr>)}</tbody></table></div>
}
