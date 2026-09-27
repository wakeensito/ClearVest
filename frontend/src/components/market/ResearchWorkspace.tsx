import { ArrowLeftRight, Minimize2 } from 'lucide-react'
import { useScoutContext } from '../../features/advisor/scoutContext'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { toFundState, useFund } from '../../api/queries'
import { compareWith, withCompare } from '../../lib/fundExplainer'
import { focusReturnTarget } from '../../lib/focusReturn'
import { Button } from '../ui/Button'
import { CompanyFinancials } from './CompanyFinancials'
import { CompactFundExplainer, RealDifference } from './FundExplainer'
import { MarketNews } from './MarketNews'
import { SecurityResearch } from './ResearchPanel'
import { SymbolSearch } from './SymbolSearch'
import styles from './ResearchWorkspace.module.css'

export function ResearchWorkspace({ symbol, onSymbolChange, onCompareCompanies, guided = false }: { symbol: string; onSymbolChange: (symbol: string) => void; onCompareCompanies?: (a: string, b: string) => void; guided?: boolean }) {
  const [params, setParams] = useSearchParams()
  const context = useScoutContext()
  const changeRange = (range: string) => { const next = new URLSearchParams(params); next.set('range', range); setParams(next, { replace: true }) }
  const dialog = useRef<HTMLDialogElement>(null)
  const focusHeading = useRef<HTMLHeadingElement>(null)
  const compareButton = useRef<HTMLButtonElement>(null)
  const [showChart, setShowChart] = useState(params.get('focus') === 'price')
  const [comparing, setComparing] = useState(false)
  const [left, setLeft] = useState(symbol)
  const [right, setRight] = useState('')
  // Re-keys the second panel only when a compare opens, not when its own search picks a symbol
  // (a remount then would drop focus from that search).
  const [rightSeed, setRightSeed] = useState(0)
  // Same query keys as the research panels, so these reuse their cache.
  const leftFund = toFundState(useFund(comparing ? left : ''))
  const rightFund = toFundState(useFund(comparing ? right : ''))
  // The guided box offers "Compare with …" too, so it needs the researched fund's facts.
  const guidedFund = toFundState(useFund(guided ? symbol : ''))
  const navigate = useNavigate()
  const location = useLocation()
  const urlCompare = compareWith(params)
  // Opened from the search or a ?compare= link (so the URL owns it), not from "Compare securities".
  const viaUrl = useRef(false)
  const replaceOnClose = useRef(false)
  // What had focus when the search opened the dialog; null means "Compare securities".
  const returnFocus = useRef<Element | null>(null)
  const pushed = (location.state as { compareOpened?: boolean } | null)?.compareOpened === true
  const show = (other: string) => {
    setLeft(symbol); setRight(other); setRightSeed(seed => seed + 1); setComparing(true)
    if (!dialog.current?.open) dialog.current?.showModal()
    requestAnimationFrame(() => focusHeading.current?.focus())
  }
  const open = () => { viaUrl.current = false; returnFocus.current = null; show('') }
  /**
   * "Compare with VOO" from a search row: push `compare=` and let the effect below open the dialog.
   * The URL goes first on purpose: opening the modal in the same frame as a router navigation left
   * that navigation's transition uncommitted, so Back could not close the dialog.
   */
  const openCompare = (other: string) => {
    viaUrl.current = true
    // Closing returns focus here (the search box after Shift+Enter), not to "Compare securities".
    returnFocus.current = document.activeElement
    // Read the live URL, not this render's params: a symbol change in the same frame must survive.
    setParams(withCompare(new URLSearchParams(window.location.search), other), { state: { compareOpened: true } })
  }
  // A ?compare= deep link, or Back/Forward across one, opens or closes the dialog.
  useEffect(() => {
    if (urlCompare && !dialog.current?.open) { viaUrl.current = true; show(urlCompare) }
    else if (!urlCompare && viaUrl.current && dialog.current?.open) dialog.current.close()
    // `show` reads `symbol` at open time; re-running on every symbol change would reopen a closed dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCompare])
  useEffect(() => {
    if (!comparing) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [comparing])
  const close = () => dialog.current?.close()
  const onClose = () => {
    setComparing(false)
    focusReturnTarget(returnFocus.current, compareButton.current)?.focus()
    returnFocus.current = null
    const fromUrl = viaUrl.current
    viaUrl.current = false
    const live = new URLSearchParams(window.location.search)
    if (!fromUrl || !compareWith(live)) return
    // Pop the entry we pushed (Back then does what it did before); otherwise drop the param in place.
    if (pushed && !replaceOnClose.current) void navigate(-1)
    else setParams(withCompare(live, null), { replace: true })
    replaceOnClose.current = false
  }
  return <>
    <section className={styles.workspace} aria-label="Security research workspace">
      <header className={styles.heading}><div><h2 data-research-heading tabIndex={-1}>Security research</h2><p>A security is an investment, such as a stock or a fund. Explore one, or compare two.</p></div><button ref={compareButton} className={styles.compareButton} onClick={open}><ArrowLeftRight size={17} aria-hidden />Compare securities</button></header>
      {guided ? <div className={styles.guided}><p>Start with the business. Choose another company whenever you’re ready.</p><SymbolSearch value={symbol} onSelect={onSymbolChange} current={symbol} currentFund={guidedFund} onCompare={openCompare} /><CompanyFinancials key={`${symbol}:${context.metric ?? ""}`} symbol={symbol} /><details open={showChart} onToggle={event => setShowChart(event.currentTarget.open)}><summary>Explore the share price chart</summary>{showChart && <SecurityResearch key={`${symbol}:${context.range}:${context.priceDate ?? ""}`} initialSymbol={symbol} title="Price history" initialRange={context.range} onRangeChange={changeRange} onSymbolChange={onSymbolChange} onCompare={openCompare} />}</details></div> : <div className={styles.single}><SecurityResearch key={`${symbol}:${context.range}:${context.priceDate ?? ""}`} initialSymbol={symbol} title="Price history" initialRange={context.range} onRangeChange={changeRange} onSymbolChange={onSymbolChange} onCompare={openCompare} /></div>}
    </section>
    {!guided && <CompanyFinancials key={`${symbol}:${context.metric ?? ""}`} symbol={symbol} />}
    <MarketNews symbols={[symbol]} enabled={!comparing} />
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="research-comparison-title" onClose={onClose}>
      {comparing && <div className={styles.focusWorkspace}>
        <header className={styles.focusHeader}><div><h2 id="research-comparison-title" ref={focusHeading} tabIndex={-1}>Compare securities</h2><p>Two independent charts. Explore the same period on each for a clearer comparison.</p></div><Button variant="secondary" icon={<Minimize2 size={16} aria-hidden />} onClick={close}>Exit comparison</Button></header>
        {/* Close through the dialog first, so its onClose restores focus before the view changes. */}
        <RealDifference left={leftFund} right={rightFund} onCompareCompanies={(a, b) => { replaceOnClose.current = true; close(); onCompareCompanies?.(a, b) }} />
        <div className={styles.pair}>
          <div className={styles.first}><SecurityResearch initialSymbol={symbol} title="First security" onSymbolChange={setLeft} explainable={false} /><CompactFundExplainer symbol={left} state={leftFund} /><CompanyFinancials key={left} symbol={left} /></div>
          <div className={styles.second}><SecurityResearch key={rightSeed} initialSymbol={right} title="Second security" onSymbolChange={setRight} explainable={false} />{right && <CompactFundExplainer symbol={right} state={rightFund} />}{right && <CompanyFinancials key={right} symbol={right} />}</div>
        </div>
        <p className={styles.context}>Each chart has its own price scale and range. Returns describe each security’s available price history; dividends and data adjustments vary by source.</p>
        <MarketNews symbols={[left, right]} />
      </div>}
    </dialog>
  </>
}
