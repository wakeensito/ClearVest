import { useQueries, useQuery, type Query, type UseQueryResult } from '@tanstack/react-query'
import { Star, X } from 'lucide-react'
import type { MouseEvent } from 'react'
import { Link } from 'react-router'
import { api, type Schemas } from '../../api/client'
import { MISSING, percentFromFraction } from '../../lib/format'
import { historyRefreshInterval } from '../../lib/historyRefresh'
import { chunk, useWatchlist } from '../../lib/watchlist'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Dots } from '../ui/Dots'
import styles from './Watchlist.module.css'

type History = Schemas['History']

const RANGE = '1y' as const

/** The star toggle beside a security's identity line. */
export function WatchButton({ symbol }: { symbol: string }) {
  const { watched, toggle } = useWatchlist()
  const on = watched(symbol)
  return <Button variant="tertiary" className={styles.watch} aria-pressed={on} onClick={() => toggle(symbol)} icon={<Star size={16} aria-hidden fill={on ? 'currentColor' : 'none'} />}>{on ? 'Watching' : 'Watch'}</Button>
}

/**
 * Watched securities with their 1-year price return. Names come only from what the page already
 * loaded (fund or company research cache), never from per-row fetches.
 */
export function Watchlist({ onResearch }: { onResearch?: (symbol: string) => void }) {
  const { symbols, toggle } = useWatchlist()
  const groups = chunk(symbols)
  // Same key shape as useHistory, so a one-symbol chunk shares the research chart's cache entry.
  const results = useQueries({
    queries: groups.map(group => {
      const joined = group.join(',')
      return {
        queryKey: ['history', joined, RANGE],
        queryFn: () => api.getHistory(joined, RANGE),
        staleTime: (query: Query<History>) => query.state.data?.refreshing ? 0 : 15 * 60_000,
        refetchInterval: (query: Query<History>) => query.state.error ? false : historyRefreshInterval(query.state.data),
        refetchIntervalInBackground: false,
      }
    }),
  })

  if (symbols.length === 0) {
    return <Card title="Your watchlist">
      <p className="t-body-sm c-secondary">Star a security on its page to keep an eye on it here. <Link to="/markets?symbol=VOO">Look at VOO</Link></p>
    </Card>
  }

  return <Card title="Your watchlist" flush footer="Price return over the past year. It is not your account’s performance and does not predict what happens next.">
    <ul className={styles.list} aria-label="Watched securities">
      {groups.flatMap((group, index) => group.map(symbol => <Row key={symbol} symbol={symbol} query={results[index]} onResearch={onResearch} onRemove={() => toggle(symbol)} />))}
    </ul>
  </Card>
}

function Row({ symbol, query, onResearch, onRemove }: { symbol: string; query: UseQueryResult<History> | undefined; onResearch?: (symbol: string) => void; onRemove: () => void }) {
  const name = useCachedName(symbol)
  const open = (event: MouseEvent) => {
    if (!onResearch || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault(); onResearch(symbol)
  }
  return <li className={styles.row}>
    <div className={styles.identity}>
      <Link className={`t-mono ${styles.symbol}`} to={`/markets?symbol=${encodeURIComponent(symbol)}`} onClick={open}>{symbol}</Link>
      <span className={styles.name}>{name ?? MISSING}</span>
    </div>
    <div className={styles.return}><ReturnValue symbol={symbol} query={query} /></div>
    <button type="button" className={styles.remove} aria-label={`Remove ${symbol} from watchlist`} onClick={onRemove}><X size={16} aria-hidden /></button>
  </li>
}

function ReturnValue({ symbol, query }: { symbol: string; query: UseQueryResult<History> | undefined }) {
  const data = query?.data
  const series = data?.series.find(item => item.symbol.toUpperCase() === symbol)
  const pending = data?.refresh?.some(item => item.symbol.toUpperCase() === symbol && item.status === 'pending')
  if (!series && (query?.isPending || pending)) return <Dots label={`Loading ${symbol} 1-year return`} />
  if (!series) return <span className="c-tertiary" aria-label={`${symbol} 1-year return not available`}>{MISSING}</span>
  const value = series.returnPct
  const tone = value > 0 ? 'gain' : value < 0 ? 'loss' : 'neutral'
  const text = percentFromFraction(value, { signed: true, digits: 2 })
  return <><span className="sr-only">1-year return </span><Badge tone={tone}>{text}</Badge></>
}

/** Disabled observers read (and follow) the cache without ever fetching. */
function useCachedName(symbol: string): string | null {
  const fund = useQuery({ queryKey: ['fund', symbol], queryFn: () => api.getFund(symbol), enabled: false })
  const company = useQuery({ queryKey: ['company-research', symbol], queryFn: () => api.getCompanyResearch(symbol), enabled: false })
  return fund.data?.name || company.data?.profile?.name || null
}
