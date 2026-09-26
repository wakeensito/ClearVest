import { ArrowLeft, ArrowRight, Search } from 'lucide-react'
import { AreaSeries, ColorType, CrosshairMode, createChart, type IChartApi, type ISeriesApi } from 'lightweight-charts'
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import type { HistoryRange, HistorySeries } from '../../api/client'
import { useHistory } from '../../api/queries'
import { marketPrice, date, percentFromFraction } from '../../lib/format'
import { historyPoints } from '../../lib/history'
import { QueryView } from '../QueryView'
import { Badge } from '../ui/Badge'
import { SegmentedControl } from '../ui/SegmentedControl'
import styles from './SecurityResearch.module.css'

export function SecurityResearch({ initialSymbol = 'VOO' }: { initialSymbol?: string }) {
  const [symbol, setSymbol] = useState(initialSymbol)
  const [input, setInput] = useState(initialSymbol)
  const [range, setRange] = useState<HistoryRange>('1y')
  const [error, setError] = useState('')
  const query = useHistory(symbol, range)
  const inputId = useId()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = input.trim().toUpperCase()
    if (!/^[A-Z0-9.^-]{1,12}$/.test(next)) {
      setError('Enter one ticker symbol, such as VOO or BRK-B.')
      return
    }
    setError('')
    setSymbol(next)
    setInput(next)
  }
  return (
    <section className={styles.panel} aria-label="Security research">
      <div className={styles.heading}>
        <div><h2 className="t-h2">Security research</h2><p className="t-body-sm c-secondary">Explore an investment’s price history.</p></div>
        {query.data?.stale && <Badge tone="stale">Cached data</Badge>}
      </div>
      <div className={styles.toolbar}>
        <form onSubmit={submit} className={styles.search}>
          <label htmlFor={inputId} className="sr-only">Research a ticker symbol</label>
          <input id={inputId} value={input} onChange={(event) => setInput(event.target.value)} maxLength={12} spellCheck={false} autoCapitalize="characters" aria-invalid={!!error} aria-describedby={error ? `${inputId}-error` : undefined} />
          <button type="submit" aria-label="Research symbol"><Search size={17} aria-hidden /></button>
        </form>
        <SegmentedControl label="History range" value={range} onChange={setRange} options={[{ value: '1y', label: '1Y' }, { value: '5y', label: '5Y' }, { value: '10y', label: '10Y' }]} />
      </div>
      {error && <p id={`${inputId}-error`} role="alert" className="t-body-sm c-loss">{error}</p>}
      <QueryView query={query} label={`Loading ${symbol} price history`} noun={`${symbol} price history`}>
        {(data) => {
          const series = data.series.find((item) => item.symbol.toUpperCase() === symbol)
          return series ? <PriceHistory key={`${symbol}:${range}:${query.dataUpdatedAt}`} series={series} /> : <p className={styles.empty}>No price history was returned for {symbol}. Try another ticker.</p>
        }}
      </QueryView>
      <div className={styles.footer}>
        <span>Prices are in the security’s quote currency. This is not your account’s performance.</span>
        <Link to={`/advisor?q=${encodeURIComponent(`Explain ${symbol} and the risks of holding it in a portfolio.`)}`}>Ask about {symbol}</Link>
      </div>
    </section>
  )
}

function PriceHistory({ series }: { series: HistorySeries }) {
  const points = useMemo(() => historyPoints(series.points), [series.points])
  const [selected, setSelected] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)
  const area = useRef<ISeriesApi<'Area'> | null>(null)
  const first = points[0]
  const last = points[points.length - 1]
  const displayed = points[selected ?? points.length - 1]
  const summaryId = useId()

  useEffect(() => {
    if (!host.current || table || !points.length) return
    const css = getComputedStyle(document.documentElement)
    const token = (name: string) => css.getPropertyValue(`--cv-${name}`).trim()
    const instance = createChart(host.current, {
      autoSize: true, height: 280,
      layout: { background: { type: ColorType.Solid, color: token('surface') }, textColor: token('text-tertiary'), fontFamily: css.getPropertyValue('--cv-font-sans'), fontSize: 12, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: token('border') } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: token('accent'), labelBackgroundColor: token('text') }, horzLine: { color: token('border-input'), labelBackgroundColor: token('text') } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.16, bottom: 0.1 } },
      timeScale: { borderVisible: false, rightOffset: 2, fixLeftEdge: true, fixRightEdge: true },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: false },
      localization: { priceFormatter: (value: number) => marketPrice(value) },
    })
    const line = instance.addSeries(AreaSeries, {
      lineColor: token('accent'), topColor: token('accent-subtle'), bottomColor: token('surface'), lineWidth: 2,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerRadius: 4,
    })
    line.setData(points)
    instance.timeScale().fitContent()
    instance.subscribeCrosshairMove((event) => {
      if (!event.point || event.time === undefined) { setSelected(null); return }
      const datum = event.seriesData.get(line)
      const index = points.findIndex((point) => point.time === datum?.time)
      setSelected(index < 0 ? null : index)
    })
    chart.current = instance
    area.current = line
    // Canvas text must redraw after a cold-cache webfont finishes loading.
    void document.fonts.load('400 12px SamsungOne').then(() => {
      if (chart.current === instance) instance.applyOptions({ layout: { fontFamily: css.getPropertyValue('--cv-font-sans') } })
    }).catch(() => { /* Keep the system font if a font request fails. */ })
    return () => { chart.current = null; area.current = null; instance.remove() }
  }, [points, table])

  const move = (direction: number) => {
    const index = Math.max(0, Math.min(points.length - 1, (selected ?? points.length - 1) + direction))
    const point = points[index]
    if (!point) return
    setSelected(index)
    if (chart.current && area.current) chart.current.setCrosshairPosition(point.value, point.time, area.current)
  }
  if (!displayed || !first || !last) return <p className={styles.empty}>No usable price observations for {series.symbol}. Try another range.</p>
  return (
    <>
      <div className={styles.quote}>
        <div><span className={styles.symbol}>{series.symbol}</span><span className="t-caption c-tertiary">Closing price</span><p className={styles.price}>{marketPrice(displayed.value)}</p></div>
        <div className={styles.return}><strong className={series.returnPct > 0 ? 'c-gain' : series.returnPct < 0 ? 'c-loss' : 'c-secondary'}>{percentFromFraction(series.returnPct, { signed: true, digits: 2 })}</strong><span className="t-caption c-tertiary">Price return over available history</span></div>
      </div>
      <p className="t-caption c-tertiary" aria-live="polite">{date(displayed.time)}{selected === null ? ' · Latest available close' : ` · ${marketPrice(displayed.value)}`}</p>
      <p id={summaryId} className="sr-only">{series.symbol} price history from {date(first.time)} to {date(last.time)}. Price return {percentFromFraction(series.returnPct, { signed: true, digits: 2 })}. Use left and right arrow keys to inspect observations or view the data table.</p>
      {table ? (
        <div className={styles.tableWrap} tabIndex={0} aria-label="Scrollable price history">
          <table className={styles.table}><caption>{series.symbol} closing prices</caption><thead><tr><th scope="col">Date</th><th scope="col">Close</th></tr></thead><tbody>{points.map((point) => <tr key={point.time}><th scope="row">{date(point.time)}</th><td>{marketPrice(point.value)}</td></tr>)}</tbody></table>
        </div>
      ) : (
        <div ref={host} className={styles.chart} role="group" aria-label={`${series.symbol} interactive price chart`} aria-describedby={summaryId} tabIndex={0} onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1) } }} />
      )}
      <div className={styles.chartTools}>
        <span className="t-caption c-tertiary">{date(first.time)} – {date(last.time)} · Market data</span>
        <div className={styles.chartButtons}>
          {!table && <><button aria-label="Previous observation" onClick={() => move(-1)} disabled={selected === 0}><ArrowLeft size={16} /></button><button aria-label="Next observation" onClick={() => move(1)} disabled={selected === null || selected === points.length - 1}><ArrowRight size={16} /></button></>}
          <button onClick={() => setTable((value) => !value)} aria-pressed={table}>{table ? 'View chart' : 'View as table'}</button>
        </div>
      </div>
    </>
  )
}
