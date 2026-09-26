import { Check, ChevronDown, Plus } from 'lucide-react'
import { useState } from 'react'
import type { MarketCategory } from '../../api/client'
import { useMarketMovers } from '../../api/queries'
import { marketPrice, percentFromFraction, timestamp } from '../../lib/format'
import { QueryView } from '../QueryView'
import { Badge } from '../ui/Badge'
import { CompanyLogo } from './CompanyLogo'
import styles from './MarketBoard.module.css'

type Props = { onResearch: (symbol: string) => void; onCompare: (symbol: string) => void; selected: string; comparisonSymbols: string[] }
const titles = { active: 'Top 10 most active', gainers: 'Top gainers', losers: 'Top losers' }

export function MarketBoard(props: Props) {
  const [movers, setMovers] = useState<'gainers' | 'losers'>('gainers')
  return <div className={styles.board}>
    <MarketList category="active" {...props} />
    <MarketList key={movers} category={movers} onCategoryChange={setMovers} {...props} />
    <p className={styles.disclosure}>FMP’s covered stocks · Daily moves versus the previous close · Lists are cached for an hour and may be delayed.</p>
  </div>
}

function MarketList({ category, onCategoryChange, onResearch, onCompare, selected, comparisonSymbols }: Props & { category: MarketCategory; onCategoryChange?: (category: 'gainers' | 'losers') => void }) {
  const query = useMarketMovers(category)
  const active = category === 'active'
  return <section className={styles.panel} aria-label={titles[category]}>
    <header className={styles.header}>
      <div>{active ? <h2>Top 10 most active</h2> : <div className={styles.moverTabs} role="group" aria-label="Market movers"><button aria-pressed={category === 'gainers'} onClick={() => onCategoryChange?.('gainers')}>Top gainers</button><button aria-pressed={category === 'losers'} onClick={() => onCategoryChange?.('losers')}>Top losers</button></div>}<p>{active ? 'The stocks drawing the most trading activity.' : category === 'gainers' ? 'Largest daily percentage increases.' : 'Largest daily percentage declines.'}</p></div>
      {query.data?.stale && <Badge tone="stale">Cached data</Badge>}
    </header>
    <QueryView query={query} label={`Loading ${titles[category].toLowerCase()}`} noun={titles[category]}>
      {(data) => data.stocks.length === 0 ? <p className={styles.empty}>No stocks returned for this list. Check back later.</p> : <>
        <div className={styles.columns} aria-hidden><span>{active ? 'Rank / company' : 'Company'}</span><span>Price</span><span>Day change</span><span /></div>
        <div className={styles.scroll} tabIndex={0} role="region" aria-label={`Scrollable ${titles[category].toLowerCase()}`}>
          <ol className={styles.list}>{data.stocks.map((stock, index) => <li key={stock.symbol} className={stock.symbol === selected ? styles.selected : ''}>
            <button className={styles.company} onClick={() => onResearch(stock.symbol)} aria-label={`Research ${stock.symbol}`}>
              {active && <span className={styles.rank}>{index + 1}</span>}<CompanyLogo symbol={stock.symbol} small />
              <span className={styles.identity}><strong>{stock.symbol}</strong><span>{stock.name}</span></span>
            </button>
            <span className={styles.price}>{marketPrice(stock.price)}</span>
            <span className={`${styles.change} ${stock.changePct > 0 ? 'c-gain' : stock.changePct < 0 ? 'c-loss' : 'c-secondary'}`}>{percentFromFraction(stock.changePct, { signed: true, digits: 2 })}</span>
            <button className={styles.add} disabled={comparisonSymbols.length >= 4 && !comparisonSymbols.includes(stock.symbol)} onClick={() => onCompare(stock.symbol)} aria-label={`Compare ${stock.symbol}`} title={comparisonSymbols.length >= 4 && !comparisonSymbols.includes(stock.symbol) ? 'Comparison is full. Remove a company to add another.' : `Compare ${stock.symbol}`}>{comparisonSymbols.includes(stock.symbol) ? <Check size={15} aria-hidden /> : <Plus size={15} aria-hidden />}</button>
          </li>)}</ol>
        </div>
        <footer className={styles.footer}><span>Retrieved {timestamp(data.fetchedAt)}</span>{data.stocks.length > 5 && <span className={styles.scrollHint}><ChevronDown size={13} aria-hidden />Scroll for all {data.stocks.length}</span>}</footer>
      </>}
    </QueryView>
  </section>
}
