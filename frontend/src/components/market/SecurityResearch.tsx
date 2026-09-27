import { ArrowLeft, ArrowRight } from 'lucide-react'
import { AreaSeries, ColorType, CrosshairMode, createChart, type IChartApi, type ISeriesApi } from 'lightweight-charts'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import type { HistoryRange, HistorySeries } from '../../api/client'
import { toFundState, useFund, useHistory } from '../../api/queries'
import { isExplainOpen, withExplain } from '../../lib/fundExplainer'
import { marketPrice, date, percentFromFraction, quantity } from '../../lib/format'
import { historyPoints } from '../../lib/history'
import { historyRefreshInterval } from '../../lib/historyRefresh'
import { QueryView } from '../QueryView'
import { Badge } from '../ui/Badge'
import { SegmentedControl } from '../ui/SegmentedControl'
import { ContextHelp } from '../education/ContextHelp'
import { CompanyLogo } from './CompanyLogo'
import { FundExplainer, FundIdentity } from './FundExplainer'
import { SymbolSearch } from './SymbolSearch'
import styles from './SecurityResearch.module.css'

export interface SecurityResearchProps {
  initialSymbol?: string
  compact?: boolean
  title?: string
  onSymbolChange?: (symbol: string) => void
  /**
   * The identity line and URL-synced "What is this?" explainer. Off where two panels share one URL
   * (Compare securities), which shows a compact explainer under each side instead.
   */
  explainable?: boolean
}

export function SecurityResearch({ initialSymbol = 'VOO', compact = false, title = 'Security research', onSymbolChange, explainable = true }: SecurityResearchProps) {
  const [symbol, setSymbol] = useState(initialSymbol)
  const [range, setRange] = useState<HistoryRange>('1y')
  const query = useHistory(symbol, range)
  const { id: explainId, open: explainOpen, state: fundState, inputRef, headingRef, show, close, retry, seeFinancials } = useExplainer(symbol, explainable)
  // The search box owns its draft and error; a new symbol (from here or the explainer) resets both.
  const select = (next: string) => { setSymbol(next); onSymbolChange?.(next) }
  return (
    <section className={`${styles.panel} ${compact ? styles.compact : ''}`} aria-label={title}>
      <div className={styles.heading}>
        <div className={styles.securityHeading}>{symbol && <CompanyLogo symbol={symbol} />}<div><h2 className="t-h2">{title}</h2><p className="t-body-sm c-secondary">{symbol ? `${symbol} · Explore price history and risk.` : 'Choose a second stock to compare.'}</p></div></div>
        {query.data?.stale && <Badge tone="stale">Cached data</Badge>}
      </div>
      <div className={styles.toolbar}>
        <SymbolSearch value={symbol} onSelect={select} inputRef={inputRef} className={styles.search} />
        <SegmentedControl label="History range" value={range} onChange={setRange} options={[{ value: '1y', label: '1Y' }, { value: '5y', label: '5Y' }, { value: '10y', label: '10Y' }]} />
      </div>
      {symbol && explainable && <FundIdentity symbol={symbol} state={fundState} open={explainOpen} onToggle={explainOpen ? close : show} controls={explainId} />}
      {symbol && explainOpen && <FundExplainer id={explainId} symbol={symbol} state={fundState} onDone={close} onRetry={retry} onSeeFinancials={seeFinancials} onResearch={select} headingRef={headingRef} />}
      {!symbol ? <div className={styles.empty}>Enter a ticker above to load its chart and key figures.</div> : <QueryView query={query} label={`Loading ${symbol} price history`} noun={`${symbol} price history`}>
        {(data) => {
          const series = data.series.find((item) => item.symbol.toUpperCase() === symbol)
          const refresh = data.refresh?.find(item => item.symbol === symbol)
          const pending = refresh?.status === 'pending'
          const polling = historyRefreshInterval(data, query.dataUpdatedAt) !== false
          return <>
            {refresh?.fetchedAt && <p className="t-caption c-tertiary">Data retrieved {new Date(refresh.fetchedAt).toLocaleString()}</p>}
            {pending && <p role="status" className={styles.empty}>
              {polling ? (series ? 'Updating prices. You can keep exploring the saved chart.' : `Preparing ${symbol} price history. This usually takes a moment.`) : 'Prices are taking longer to update. Check again in a moment.'}
              {!polling && <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>Check again</button>}
            </p>}
            {refresh?.status === 'failed' && <p role="status" className={styles.empty}>Prices could not be updated. Showing the last saved chart. <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>Check again</button></p>}
            {series ? <PriceHistory key={`${symbol}:${range}:${refresh?.fetchedAt ?? 'snapshot'}`} series={series} compact={compact} /> : !pending && <p className={styles.empty}>No price history was returned for {symbol}. Try another ticker.</p>}
          </>
        }}
      </QueryView>}
      <ContextHelp title="How do I read this chart?"><p>The line shows the price of one share over time. Choose 1Y, 5Y or 10Y to change the period. A rising line means the share price increased during that period; it does not tell you what happens next.</p><p>Price return is the percentage change between the first and last available prices. Volatility describes how much prices moved around. Neither tells you whether a company earns a profit.</p></ContextHelp>
      <div className={styles.footer}>
        <span>Prices are in the security’s quote currency. This is not your account’s performance.</span>
        {symbol && <Link to={`/advisor?q=${encodeURIComponent(`Explain ${symbol} and the risks of holding it in a portfolio.`)}`}>Ask about {symbol}</Link>}
      </div>
    </section>
  )
}

/**
 * Explainer open state lives in the URL (`explain=1`) so the phone Back button closes it. Opening
 * pushes a history entry; Done pops it when we pushed it, otherwise it replaces the URL, so a
 * symbol change made in between (a replace) is never undone.
 */
const liveParams = () => new URLSearchParams(window.location.search)

function useExplainer(symbol: string, enabled: boolean) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const fund = useFund(enabled ? symbol : '')
  const id = useId()
  const open = enabled && isExplainOpen(params)
  const inputRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusHeading = useRef(false)
  const focusSearch = useRef(false)
  const wasOpen = useRef(open)
  useEffect(() => {
    if (open && !wasOpen.current && focusHeading.current) headingRef.current?.focus()
    // Done asks for the search; Back or Esc leaves focus on a removed node, so recover it too.
    if (!open && wasOpen.current && (focusSearch.current || document.activeElement === document.body)) inputRef.current?.focus()
    focusHeading.current = false
    focusSearch.current = false
    wasOpen.current = open
  }, [open])
  const state = toFundState(fund)
  const pushed = (location.state as { explainOpened?: boolean } | null)?.explainOpened === true
  return {
    id, open, state, inputRef, headingRef,
    // Read the live URL, not the render's params: a ticker change in the same frame must not drop explain=1.
    show: () => { focusHeading.current = true; setParams(withExplain(liveParams(), true), { state: { explainOpened: true } }) },
    close: () => {
      focusSearch.current = true
      if (pushed) void navigate(-1)
      else setParams(withExplain(liveParams(), false), { replace: true })
    },
    retry: () => void fund.refetch(),
    /** Company financials sit elsewhere on Markets; Portfolio has none, so go to Markets for them. */
    seeFinancials: () => {
      const target = document.querySelector<HTMLElement>(`[data-company-financials="${CSS.escape(symbol)}"]`)
      if (!target) { void navigate(`/markets?symbol=${encodeURIComponent(symbol)}`); return }
      target.scrollIntoView({ block: 'start' })
      target.focus({ preventScroll: true })
    },
  }
}

function PriceHistory({ series, compact }: { series: HistorySeries; compact: boolean }) {
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
      autoSize: true, height: compact ? 200 : 280,
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
  }, [points, table, compact])

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
      <div className={styles.historyFacts}><span>Annualized volatility <strong>{percentFromFraction(series.volatility, { digits: 2 })}</strong></span><span>Available observations <strong>{quantity(points.length)}</strong></span></div>
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
