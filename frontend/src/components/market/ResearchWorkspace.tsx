import { ArrowLeftRight, Minimize2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toFundState, useFund } from '../../api/queries'
import { Button } from '../ui/Button'
import { CompanyNameSearch } from './CompanyNameSearch'
import { CompanyFinancials } from './CompanyFinancials'
import { CompactFundExplainer, RealDifference } from './FundExplainer'
import { MarketNews } from './MarketNews'
import { SecurityResearch } from './ResearchPanel'
import styles from './ResearchWorkspace.module.css'

export function ResearchWorkspace({ symbol, onSymbolChange, guided = false }: { symbol: string; onSymbolChange: (symbol: string) => void; guided?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const focusHeading = useRef<HTMLHeadingElement>(null)
  const compareButton = useRef<HTMLButtonElement>(null)
  const [showChart, setShowChart] = useState(false)
  const [comparing, setComparing] = useState(false)
  const [left, setLeft] = useState(symbol)
  const [right, setRight] = useState('')
  // Same query keys as the research panels, so these reuse their cache.
  const leftFund = toFundState(useFund(comparing ? left : ''))
  const rightFund = toFundState(useFund(comparing ? right : ''))
  const open = () => {
    setLeft(symbol); setComparing(true)
    dialog.current?.showModal()
    requestAnimationFrame(() => focusHeading.current?.focus())
  }
  useEffect(() => {
    if (!comparing) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [comparing])
  const close = () => dialog.current?.close()
  return <>
    <section className={styles.workspace} aria-label="Security research workspace">
      <header className={styles.heading}><div><h2 data-research-heading tabIndex={-1}>Security research</h2><p>A security is an investment, such as a stock or a fund. Explore one, or compare two.</p></div><button ref={compareButton} className={styles.compareButton} onClick={open}><ArrowLeftRight size={17} aria-hidden />Compare securities</button></header>
      {guided ? <div className={styles.guided}><p>Start with the business. Choose another company whenever you’re ready.</p><CompanyNameSearch onSelect={onSymbolChange} /><CompanyFinancials key={symbol} symbol={symbol} /><details onToggle={event => setShowChart(event.currentTarget.open)}><summary>Explore the share price chart</summary>{showChart && <SecurityResearch key={symbol} initialSymbol={symbol} title="Price history" onSymbolChange={onSymbolChange} />}</details></div> : <div className={styles.single}><SecurityResearch key={symbol} initialSymbol={symbol} title="Price history" onSymbolChange={onSymbolChange} /></div>}
    </section>
    {!guided && <CompanyFinancials key={symbol} symbol={symbol} />}
    <MarketNews symbols={[symbol]} enabled={!comparing} />
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="research-comparison-title" onClose={() => { setComparing(false); compareButton.current?.focus() }}>
      {comparing && <div className={styles.focusWorkspace}>
        <header className={styles.focusHeader}><div><h2 id="research-comparison-title" ref={focusHeading} tabIndex={-1}>Compare securities</h2><p>Two independent charts. Explore the same period on each for a clearer comparison.</p></div><Button variant="secondary" icon={<Minimize2 size={16} aria-hidden />} onClick={close}>Exit comparison</Button></header>
        <RealDifference left={leftFund} right={rightFund} />
        <div className={styles.pair}>
          <div className={styles.first}><SecurityResearch initialSymbol={symbol} title="First security" onSymbolChange={setLeft} explainable={false} /><CompactFundExplainer symbol={left} state={leftFund} /><CompanyFinancials key={left} symbol={left} /></div>
          <div className={styles.second}><SecurityResearch initialSymbol={right} title="Second security" onSymbolChange={setRight} explainable={false} />{right && <CompactFundExplainer symbol={right} state={rightFund} />}{right && <CompanyFinancials key={right} symbol={right} />}</div>
        </div>
        <p className={styles.context}>Each chart has its own price scale and range. Returns describe each security’s available price history; dividends and data adjustments vary by source.</p>
        <MarketNews symbols={[left, right]} />
      </div>}
    </dialog>
  </>
}
