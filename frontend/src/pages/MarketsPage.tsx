import { ArrowLeftRight, ChartNoAxesCombined } from 'lucide-react'
import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { CompanyComparison } from '../components/market/CompanyComparison'
import { MarketBoard } from '../components/market/MarketBoard'
import { ContextHelp } from '../components/education/ContextHelp'
import { ResearchWorkspace } from '../components/market/ResearchWorkspace'
import { Watchlist } from '../components/market/Watchlist'
import { companyPair } from '../lib/fundExplainer'
import styles from './MarketsPage.module.css'

export function MarketsPage() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'companies' ? 'companies' : 'overview'
  const [selected, setSelected] = useState<string[]>([])
  const guided = params.get('guided') === '1'
  // Collapsed by default; the board (and its two /market/movers calls) mounts only once opened.
  const [activityOpen, setActivityOpen] = useState(false)
  const research = useRef<HTMLDivElement>(null)
  const requested = params.get('symbol')?.trim().toUpperCase() ?? 'VOO'
  const symbol = /^[A-Z0-9.^-]{1,12}$/.test(requested) ? requested : 'VOO'
  // Build from the live URL, not the render's params, so a param set in the same frame (explain=1) survives.
  const switchView = (next: string) => { const updated = new URLSearchParams(window.location.search); updated.set('view', next); setParams(updated) }
  const selectSymbol = (ticker: string) => { const updated = new URLSearchParams(window.location.search); updated.set('symbol', ticker); setParams(updated, { replace: true }); requestAnimationFrame(() => research.current?.querySelector<HTMLElement>('[data-research-heading]')?.focus({ preventScroll: true })) }
  const companiesTab = useRef<HTMLButtonElement>(null)
  const openCompanyComparison = (a: string, b: string) => {
    setSelected(companyPair(a, b)); switchView('companies')
    requestAnimationFrame(() => companiesTab.current?.focus())
  }
  const openResearch = (ticker: string) => {
    selectSymbol(ticker)
    requestAnimationFrame(() => { research.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); research.current?.querySelector('input')?.focus({ preventScroll: true }) })
  }
  return <div className={styles.page}>
    <header className={styles.header}><h1>Markets & research</h1><p>Start with a business. Learn what its numbers can tell you.</p></header>
    <ContextHelp title="New to company research? Start here"><p>Start by asking what a company sells. Then look at its sales and profit. Finally, compare its share price with its earnings. The guided company section below walks through these questions.</p><p>“Most active” means heavily traded. Gainers and losers show price changes, not which companies are best to own.</p><button className={styles.start} onClick={() => openResearch('AAPL')}>Explore Apple as an example</button></ContextHelp>
    <div className={styles.mode}><span>How would you like to explore?</span><button aria-pressed={guided} onClick={() => { const updated = new URLSearchParams(params); if (guided) updated.delete('guided'); else updated.set('guided', '1'); setParams(updated) }}>{guided ? 'Guided view on' : 'Guide me step by step'}</button></div>
    <nav className={styles.tabs} aria-label="Market workspace">
      <button aria-pressed={view === 'overview'} onClick={() => switchView('overview')}><ChartNoAxesCombined size={18} aria-hidden />Market overview</button>
      <button ref={companiesTab} aria-pressed={view === 'companies'} onClick={() => switchView('companies')}><ArrowLeftRight size={18} aria-hidden />Compare companies{selected.length > 0 && <span className={styles.count}>{selected.length}</span>}</button>
    </nav>
    <div hidden={view !== 'companies'} className={styles.comparison}><CompanyComparison selected={selected} onSelectedChange={setSelected} /></div>
    {view === 'overview' && <>
      {!guided && <Watchlist onResearch={openResearch} />}
      <div ref={research} className={styles.research}><ResearchWorkspace guided={guided} symbol={symbol} onSymbolChange={selectSymbol} onCompareCompanies={openCompanyComparison} /></div>
      {!guided && <details className={styles.activity} open={activityOpen} onToggle={event => setActivityOpen(event.currentTarget.open)}>
        <summary>Market activity: most active, gainers and losers</summary>
        {activityOpen && <MarketBoard comparisonSymbols={selected} selected={symbol} onResearch={openResearch} onCompare={(ticker) => { setSelected((current) => current.includes(ticker) ? current : current.length < 4 ? [...current, ticker] : current); switchView('companies') }} />}
      </details>}
    </>}
  </div>
}
