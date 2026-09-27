import { useState } from 'react'
import { useCompanyResearch, useMarketNews } from '../../api/queries'
import { SymbolSearch } from '../../components/market/SymbolSearch'
import { timestamp } from '../../lib/format'
import type { ScoutPageContext } from './scoutContext'
import styles from './AdvisorTools.module.css'

function amount(value: number | null | undefined, unit: string | null | undefined) {
  return value == null ? 'Unavailable' : `${new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(value)} ${unit ?? '(currency unavailable)'}`
}
export function CompanyBrief({symbol,onSelect,onDiscuss,busy}: {busy:boolean;symbol:string;onSelect:(s:string)=>void;onDiscuss:(message:string,context:ScoutPageContext)=>void}) {
  const [ticker,setTicker] = useState(symbol)
  const [error,setError] = useState('')
  const research = useCompanyResearch(symbol)
  const news = useMarketNews(symbol ? [symbol] : [], !!symbol)
  const data = research.data, annual = data?.income[0]
  const ask = (message:string) => onDiscuss(message,{page:'advisor',symbol,metric:'business'})
  return <section aria-labelledby="brief-title">
    <div className={styles.toolHeading}><h2 id="brief-title">{data?.profile?.name ?? (symbol || 'Explore a company.')}</h2></div>
    <form className={styles.tickerForm} onSubmit={event=>{event.preventDefault();const next=ticker.trim().toUpperCase();if(!/^[A-Z0-9.^-]{1,12}$/.test(next)){setError('Enter a ticker such as NVDA or AAPL.');return}setError('');onSelect(next)}}><label className="sr-only" htmlFor="advisor-company">Company ticker</label><div><input id="advisor-company" value={ticker} onChange={e=>setTicker(e.target.value)} maxLength={12} placeholder="Company ticker, e.g. NVDA" aria-invalid={!!error} aria-describedby={error?'advisor-company-error':undefined}/><button type="submit">Explore</button></div></form>
    {error && <p id="advisor-company-error" role="alert" className={styles.source}>{error}</p>}
    <SymbolSearch onSelect={onSelect}/>
    {symbol && <>
      {research.isPending && <p className={styles.source}>Loading company facts…</p>}
      {research.isError && <div className={styles.empty}><p>Company facts are unavailable.</p><button onClick={()=>void research.refetch()}>Try again</button></div>}
      {data && <>
        <dl className={styles.fundamentals}><div><dt>Sales</dt><dd>{amount(annual?.revenue,annual?.currency)}</dd></div><div><dt>Net profit</dt><dd>{amount(annual?.netIncome,annual?.currency)}</dd></div><div><dt>P/E <small>Trailing 12 months</small></dt><dd>{data.valuation?.pe != null && data.valuation.pe > 0 ? `${data.valuation.pe.toFixed(1)}×` : 'Unavailable'}</dd></div></dl>
        <p className={styles.source}>{annual ? `FY ${annual.year} · period ended ${annual.date}` : 'No annual financials available'}</p>
        {data.profile?.description && <details className={styles.dates}><summary>About this business</summary><p className={styles.description}>{data.profile.description}</p></details>}
        <button className={styles.primary} disabled={busy || !data.sources.some(source=>!source.stale && source.section !== 'history')} onClick={()=>ask(`Explain ${symbol}'s business and available financial figures in plain language. Cite the source and period.`)}>Ask Scout about {symbol}</button>
        <details className={styles.dates}><summary>Financial sources</summary>{data.sources.map(source=><p key={source.section}>FMP {source.section} · retrieved {timestamp(source.fetchedAt)}{source.stale ? ' · Expired; excluded from new AI evidence' : ''}</p>)}{!!data.unavailable.length && <p>Unavailable: {data.unavailable.join(', ')}</p>}<p>A nonpositive P/E is shown as unavailable, not a meaningful positive earnings multiple.</p></details>
      </>}
      <details className={styles.newsDisclosure}><summary>Related reporting</summary>
        <div className={styles.newsHeading}><span>Publisher headlines</span><button onClick={()=>{void research.refetch();void news.refetch()}} disabled={research.isFetching||news.isFetching}>Refresh sources</button></div>
        {news.isPending && <p className={styles.source}>Loading headlines…</p>}
        {news.isError && <div className={styles.empty}><p>Headlines are unavailable.</p><button onClick={()=>void news.refetch()}>Try again</button></div>}
        {news.data && <><p className={styles.source}>{news.data.source} · retrieved {timestamp(news.data.fetchedAt)}{news.data.stale ? ' · Expired cache' : ''}</p>{!news.data.articles.length && <p className={styles.source}>No headlines returned.</p>}<ul className={styles.news}>{news.data.articles.slice(0,3).map(article=><li key={article.url}><p>{article.publisher} · {article.publishedAt?.slice(0,10) ?? 'Date unavailable'}</p><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a><button disabled={busy||news.data.stale} onClick={()=>ask(`Explain this headline about ${symbol} and what cannot be concluded from the headline alone: "${article.title.slice(0,300)}"`)}>Read with Scout</button></li>)}</ul><p className={styles.assumption}>Headlines only. Scout has not read the full article.</p></>}
      </details>
    </>}
  </section>
}
