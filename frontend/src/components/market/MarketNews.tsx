import { ArrowUpRight, Newspaper } from 'lucide-react'
import { useState } from 'react'
import { useMarketNews } from '../../api/queries'
import { date, timestamp } from '../../lib/format'
import { QueryView } from '../QueryView'
import { Badge } from '../ui/Badge'
import { ContextHelp } from '../education/ContextHelp'
import { CompanyLogo } from './CompanyLogo'
import styles from './MarketNews.module.css'

export function MarketNews({ symbols, enabled = true }: { symbols: string[]; enabled?: boolean }) {
  const [scope, setScope] = useState('related')
  const selected = [...new Set(symbols.filter(Boolean))].slice(0, 2)
  const relatedQuery = useMarketNews(scope === 'related' ? selected : [], enabled)
  const fallback = scope === 'related' && selected.length > 0 && relatedQuery.isSuccess && relatedQuery.data.articles.length === 0
  const marketQuery = useMarketNews([], enabled && fallback)
  const query = fallback ? marketQuery : relatedQuery
  return <section className={styles.panel} aria-label="Market news">
    <header className={styles.header}><div><h2><Newspaper size={21} aria-hidden />Market news</h2><p>{scope === 'related' && selected.length && !fallback ? `The latest headlines connected to ${selected.join(' and ')}.` : 'The latest headlines from across the stock market.'}</p></div><div className={styles.filters} role="group" aria-label="News scope"><button aria-pressed={scope === 'related'} onClick={() => setScope('related')}>Related news</button><button aria-pressed={scope === 'market'} onClick={() => setScope('market')}>Market-wide</button></div></header>
    <ContextHelp title="How can I learn from a headline?"><p>Ask what actually changed: sales, costs, rules or expectations? Read the full article and check its date. A headline alone cannot explain a company’s long-term prospects.</p><p>Find a word you do not know? Keep it as a question for Learn or the advisor. You do not need to act on every story.</p></ContextHelp>
    {fallback && <p className={styles.fallback}>No related stories were returned for {selected.join(' and ')}. Showing market-wide headlines.</p>}
    <QueryView query={query} label="Loading market news" noun="Market news">
      {(data) => <>{data.stale && <div className={styles.cached}><Badge tone="stale">Cached data</Badge></div>}{data.articles.length ? <div className={styles.articles}>{data.articles.map((article, index) => <article key={article.url} className={index === 0 ? styles.lead : styles.story}>
        {index === 0 && <NewsImage url={article.image} />}
        <div className={styles.storyBody}><div className={styles.meta}>{article.symbol && <span className={styles.symbol}><CompanyLogo symbol={article.symbol} small />{article.symbol}</span>}<span>{article.publisher}</span></div><h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}<ArrowUpRight size={16} aria-hidden /><span className="sr-only"> (opens publisher in a new tab)</span></a></h3><p className={styles.date}>{article.publishedAt ? date(article.publishedAt.slice(0, 10)) : 'Publication date unavailable'}</p></div>
      </article>)}</div> : <div className={styles.empty}><p>{scope === 'related' && !fallback ? `No related stories were returned for ${selected.join(' and ')}.` : 'No market headlines were returned. Check back later.'}</p>{scope === 'related' && <button onClick={() => setScope('market')}>See market-wide news</button>}</div>}<footer className={styles.footer}>Headlines via {data.source} · Retrieved {timestamp(data.fetchedAt)} · Full articles open with their publishers.</footer></>}
    </QueryView>
  </section>
}

function NewsImage({ url }: { url: string | null }) {
  const [failed, setFailed] = useState<string | null>(null)
  return <div className={styles.image}>{url && failed !== url ? <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(url)} /> : <div className={styles.imageFallback}><Newspaper size={44} strokeWidth={1.25} aria-hidden /><span>In the headlines</span></div>}</div>
}
