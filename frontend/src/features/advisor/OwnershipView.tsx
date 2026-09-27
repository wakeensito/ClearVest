import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, RefreshCw } from 'lucide-react'
import { isApiError } from '../../api/errors'
import { usePortfolioExposure } from '../../api/queries'
import { currency, timestamp } from '../../lib/format'
import type { ScoutPageContext } from './scoutContext'
import styles from './OwnershipView.module.css'
import tools from './AdvisorTools.module.css'

export function OwnershipView({ onDiscuss, busy, focusSymbol }: { focusSymbol?:string; busy:boolean; onDiscuss:(text:string,context:ScoutPageContext)=>void }) {
  const {holdings,exposure,loading,refresh} = usePortfolioExposure()
  const [overlapsOnly,setOverlapsOnly] = useState(false)
  const [limit,setLimit] = useState(8)
  const data = exposure.data
  if (loading) return <div className={tools.empty} role="status">Looking inside your funds…</div>
  if (!holdings.data && holdings.isError && !(isApiError(holdings.error) && holdings.error.code === 'NOT_LINKED')) return <div className={tools.empty}><h2>We couldn’t load your portfolio.</h2><button onClick={()=>void refresh()}>Try again</button></div>
  if (!holdings.data) return <div className={tools.empty}><h2>Start with your portfolio.</h2><p>Connect an account to see what you own.</p><Link to="/portfolio">Open Portfolio</Link>{holdings.isError && <button onClick={()=>void refresh()}>Try again</button>}</div>
  if (!data || exposure.isError) return <div className={tools.empty}><h2>Holdings are unavailable.</h2><button onClick={()=>void refresh()}>Try again</button></div>
  if (data.totalValue === 0 && !holdings.data.holdings.length) return <div className={tools.empty}><h2>No investments to unpack yet.</h2><Link to="/portfolio">View portfolio</Link></div>
  if (data.status === 'unsupported') return <div className={tools.empty}><h2>This portfolio needs a closer look.</h2><p>This view supports positive stock and fund positions. Shorts, derivatives and inconsistent balances are not mapped.</p><Link to="/portfolio">View portfolio</Link></div>
  const filtered = data.exposures.filter(row=>!overlapsOnly || row.overlap)
  const ask = (symbol?:string) => onDiscuss(symbol ? `Explain my direct and fund exposure to ${symbol}, including missing coverage.` : 'Explain where my funds overlap and what remains unmapped. Use the calculated ownership facts.',{page:'advisor',metric:'exposure',...(symbol?{symbol}:{})})
  return <section aria-labelledby="ownership-title">
    <div className={styles.heading}><div><h2 id="ownership-title">What do I really own?</h2><p>See where your funds overlap.</p></div><button className={styles.refresh} aria-label="Refresh ownership" disabled={loading} onClick={()=>void refresh()}><RefreshCw size={16} aria-hidden /></button></div>
    <div className={styles.filters} role="group" aria-label="Ownership filter"><button aria-pressed={!overlapsOnly} onClick={()=>setOverlapsOnly(false)}>All holdings</button><button aria-pressed={overlapsOnly} onClick={()=>setOverlapsOnly(true)}>Overlaps <span>{data.overlapCount}</span></button></div>
    <div className={styles.legend}><span><i />Direct</span><span><i />Through funds</span><span>% of portfolio</span></div>
    <div className={styles.rows}>
      {filtered.slice(0,Math.max(limit, filtered.findIndex(row => row.symbol === focusSymbol) + 1)).map(row=><details className={styles.row} key={row.symbol} open={row.symbol === focusSymbol || undefined} data-scout-highlight={row.symbol === focusSymbol || undefined}>
        <summary aria-label={`${row.symbol}, ${row.weightPct.toFixed(2)}% exposure${row.overlap ? ', overlapping holdings' : ''}`}><span className={styles.name}><strong>{row.symbol}</strong><span>{row.name}</span></span><span className={styles.bar} aria-hidden><i style={{width:`${Math.min(row.weightPct,100)}%`}}><b style={{width:`${row.value ? row.directValue/row.value*100 : 0}%`}} /></i></span><strong className={styles.percent}>{row.weightPct.toFixed(2)}%</strong><ChevronDown size={15} aria-hidden /></summary>
        <div className={styles.breakdown}><p>{currency(row.value)} in mapped exposure</p>{row.paths.map(path=><div key={path.via ?? 'direct'}><span>{path.via ? `Through ${path.via}` : 'Owned directly'}{path.fundWeightPct != null && <small>{path.fundWeightPct.toFixed(2)}% of that fund</small>}</span><span>{currency(path.value)}<small>{path.weightPct.toFixed(2)}% of portfolio</small></span></div>)}<button disabled={busy} onClick={()=>ask(row.symbol)}>Ask Scout about {row.symbol}</button></div>
      </details>)}
      {!filtered.length && <p className={tools.empty}>{overlapsOnly ? 'No overlap in the holdings we could map.' : 'No underlying holdings could be mapped yet.'}</p>}
    </div>
    {filtered.length>limit && <button className={styles.more} onClick={()=>setLimit(limit+12)}>Show more holdings</button>}
    <details className={styles.coverage}><summary><span>{data.mappedPct.toFixed(1)}% mapped{data.unmappedValue > 0 ? ` · ${currency(data.unmappedValue)} unmapped` : ''}</span><span>Sources & limits <ChevronDown size={14} aria-hidden /></span></summary>
      <p>Portfolio saved {timestamp(data.asOf)}. Cash: {currency(data.cashValue)}. Unmapped holdings are unknown, not zero.</p>
      {data.funds.map(fund=><div key={fund.symbol}><strong>{fund.symbol} · {fund.status === 'available' || fund.status === 'partial' ? `${fund.coveragePct.toFixed(1)}% mapped` : fund.status === 'outdated' ? 'Outdated data excluded' : 'Holdings unavailable'}</strong><p>{fund.providerUpdatedAt ? `FMP updated ${fund.providerUpdatedAt}` : 'No dated fund source'}{fund.fetchedAt ? ` · retrieved ${timestamp(fund.fetchedAt)}` : ''}</p></div>)}
      <p>One level of reported holdings, matched by security ticker. Share classes stay separate. Provider update dates are not filing dates. Fund assets can include securities other than companies. Older data, unknown assets and unexpanded funds remain unmapped. We load up to eight funds, largest first; partial lists are never scaled to 100%.</p>
      <a href="https://site.financialmodelingprep.com/developer/docs/stable/holdings" target="_blank" rel="noreferrer">About the fund data</a>
    </details>
    <button className={tools.primary} disabled={busy || !data.exposures.length} onClick={()=>ask()}>Ask Scout about overlap</button>
  </section>
}
