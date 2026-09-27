import { ExplainThis } from '../../features/advisor/ExplainThis'
import { useSearchParams } from 'react-router'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Link } from 'react-router'
import { useMemo, useState } from 'react'
import type { Holding } from '../../api/client'
import { typeColor, typeLabel } from '../../lib/assetTypes'
import { currency, percentFromFraction, quantity } from '../../lib/format'
import { Badge } from '../ui/Badge'
import styles from './HoldingsTable.module.css'

type Key = 'symbol' | 'type' | 'quantity' | 'price' | 'value' | 'weight'

const COLUMNS: { key: Key; label: string; numeric?: boolean }[] = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'type', label: 'Type' },
  { key: 'quantity', label: 'Quantity', numeric: true },
  { key: 'price', label: 'Price', numeric: true },
  { key: 'value', label: 'Value', numeric: true },
  { key: 'weight', label: 'Weight', numeric: true },
]

/** DESIGN.md §4.5. Sorted by value by default; becomes a list under 768px. */
export function HoldingsTable({ holdings, hideValues = false }: { holdings: Holding[]; hideValues?: boolean }) {
  const [params] = useSearchParams()
  const focusSymbol = params.get('focus') === 'holding' ? params.get('holding') : null
  const [sort, setSort] = useState<{ key: Key; desc: boolean }>({ key: 'value', desc: true })

  const rows = useMemo(() => {
    const dir = sort.desc ? -1 : 1
    return [...holdings].sort((a, b) => {
      const x = a[sort.key]
      const y = b[sort.key]
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir
    })
  }, [holdings, sort])

  const toggle = (key: Key, numeric?: boolean) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: Boolean(numeric) }))

  const maxWeight = Math.max(...holdings.map((h) => Math.abs(h.weight)), 0.0001)

  return (
    <>
      <div className={styles.scroller}>
        <table className={styles.table}>
          <caption className="sr-only">Holdings, sorted by {sort.key} {sort.desc ? 'descending' : 'ascending'}</caption>
          <thead>
            <tr>
              {COLUMNS.map((c) => {
                const active = sort.key === c.key
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={c.numeric ? styles.numeric : undefined}
                    aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}
                  >
                    <button type="button" onClick={() => toggle(c.key, c.numeric)} data-active={active || undefined}>
                      {c.label}
                      {active && (sort.desc ? <ArrowDown size={12} aria-hidden /> : <ArrowUp size={12} aria-hidden />)}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.symbol} data-scout-highlight={h.symbol === focusSymbol || undefined}>
                <th scope="row">
                  <Link to={`/markets?symbol=${encodeURIComponent(h.symbol)}`} className={`t-mono ${styles.ticker}`}>{h.symbol}</Link>
                  <span className={`t-body-sm c-secondary ${styles.name}`}>{h.name}</span>
              {!hideValues && <ExplainThis label="Explain holding" context={{ page: 'portfolio', symbol: h.symbol, metric: 'holding' }} question={`Explain my saved ${h.symbol} holding, including its value and weight in my portfolio.`} />}
                </th>
                <td>
                  <TypeCell holding={h} />
                </td>
                <td className={styles.numeric}>{hideValues ? 'Hidden' : quantity(h.quantity)}</td>
                <td className={styles.numeric}>{currency(h.price)}</td>
                <td className={`${styles.numeric} ${styles.value}`}>{hideValues ? 'Hidden' : currency(h.value)}</td>
                <td className={styles.numeric}>
                  <span className={styles.weight}>
                    {percentFromFraction(h.weight)}
                    <span className={styles.track} aria-hidden>
                      <span style={{ width: `${(Math.abs(h.weight) / maxWeight) * 100}%`, background: typeColor(h.type) }} />
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul role="list" className={styles.list}>
        {rows.map((h) => (
          <li key={h.symbol} data-scout-highlight={h.symbol === focusSymbol || undefined}>
            <div>
              <Link to={`/markets?symbol=${encodeURIComponent(h.symbol)}`} className={`t-mono ${styles.ticker}`}>{h.symbol}</Link>
              <span className={`t-body-sm c-secondary ${styles.name}`}>{h.name}</span>
              {!hideValues && <ExplainThis label="Explain holding" context={{ page: 'portfolio', symbol: h.symbol, metric: 'holding' }} question={`Explain my saved ${h.symbol} holding, including its value and weight in my portfolio.`} />}
            </div>
            <div className={styles.listRight}>
              <span className="t-body-strong num">{hideValues ? 'Hidden' : currency(h.value)}</span>
              <span className="t-body-sm c-tertiary num">{percentFromFraction(h.weight)}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function TypeCell({ holding }: { holding: Holding }) {
  return (
    <span className={styles.type}>
      <span className={styles.dot} style={{ background: typeColor(holding.type) }} aria-hidden />
      <span className="t-body-sm c-secondary">{typeLabel(holding.type)}</span>
      {holding.weight < 0 && <Badge>Short</Badge>}
    </span>
  )
}
