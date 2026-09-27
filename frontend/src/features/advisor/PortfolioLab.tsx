import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useHoldings } from '../../api/queries'
import { currency, timestamp } from '../../lib/format'
import { scenarioResult } from '../../lib/scenario'
import type { ScoutPageContext } from './scoutContext'
import styles from './AdvisorTools.module.css'

export function PortfolioLab({ onDiscuss, onContextChange, busy, initialSymbol = '', initialDrop = 20 }: {initialSymbol?:string;initialDrop?:number;busy:boolean;onDiscuss:(message:string, context:ScoutPageContext)=>void;onContextChange:(context:ScoutPageContext)=>void}) {
  const query = useHoldings()
  const [selected,setSelected] = useState(initialSymbol)
  const [drop,setDrop] = useState(Number.isInteger(initialDrop) && initialDrop >= 0 && initialDrop <= 60 ? initialDrop : 20)
  const data = query.data
  const positions = new Map<string, number>()
  data?.holdings.filter(h => h.type !== 'cash' && h.value > 0).forEach(h => positions.set(h.symbol, (positions.get(h.symbol) ?? 0) + h.value))
  const symbols = [...positions].sort((a,b) => b[1]-a[1]).map(([symbol]) => symbol)
  const symbol = symbols.includes(selected) ? selected : symbols[0] ?? ''
  const result = data ? scenarioResult(data,symbol,drop) : null
  const supported = !!result
  useEffect(() => {
    onContextChange(supported ? {page:'advisor',scenario:{symbol,dropPct:drop}} : {page:'advisor'})
  }, [drop, onContextChange, supported, symbol])
  if (!data) return <div className={styles.empty}><h3>A scenario starts with what you own.</h3><p>{query.isPending ? 'Loading your saved holdings…' : 'Connect an account to try a scenario.'}</p><Link to="/portfolio">Open Portfolio</Link>{query.isError && <button onClick={() => void query.refetch()}>Try again</button>}</div>
  return <section aria-labelledby="scenario-title">
    <div className={styles.toolHeading}><h2 id="scenario-title">What if one holding falls?</h2></div>
    <div className={styles.controls}><label>Holding<select value={symbol} onChange={e=>setSelected(e.target.value)} disabled={!symbols.length}>{symbols.map(s=><option key={s}>{s}</option>)}</select></label><div className={styles.shock}><span>Hypothetical price drop</span><output htmlFor="scenario-drop">−{drop}%</output></div></div>
    <input id="scenario-drop" className={styles.slider} type="range" aria-label="Hypothetical price drop" min={0} max={60} step={1} value={drop} onChange={e=>setDrop(Number(e.target.value))} />
    <div className={styles.rangeLabels}><span>0%</span><span>60%</span></div>
    {result ? <>
      <div className={styles.impact} aria-live="polite"><p>Illustrative portfolio change</p><strong>−{result.portfolioDropPct.toFixed(2)}<span>%</span></strong><p>{currency(result.loss)} decrease · {symbol} is {(result.weight*100).toFixed(1)}% of this portfolio</p></div>
      <div className={styles.comparison} aria-label={`Portfolio before ${currency(result.before)}, after ${currency(result.after)}`}><div><span>Before</span><div className={styles.barTrack}><i style={{width:'100%'}} /></div><strong>{currency(result.before)}</strong></div><div><span>After</span><div className={styles.barTrack}><i style={{width:`${result.after/result.before*100}%`}} /></div><strong>{currency(result.after)}</strong></div></div>
      <p className={styles.assumption}>A hypothetical drop. Other holdings stay flat.</p><details className={styles.dates}><summary>Assumptions & source</summary><p>No taxes, fees, dividends or correlations. This is not a forecast or a new risk score.</p><p>Saved holdings · {timestamp(data.asOf)}{data.stale ? ' · Cached snapshot' : ''}</p></details>
      <button className={styles.primary} disabled={busy} onClick={()=>onDiscuss(`Explain this hypothetical ${drop}% decline in ${symbol} and why its weight matters.`, {page:'advisor',scenario:{symbol,dropPct:drop}})}>Explain this with Scout</button>
    </> : <p className={styles.empty}>This scenario needs a positive portfolio with a supported holding. Short positions and derivatives are outside this illustration.</p>}
  </section>
}
