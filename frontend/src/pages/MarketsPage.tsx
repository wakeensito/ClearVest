import { useSearchParams } from 'react-router'
import { SecurityResearch } from '../components/market/ResearchPanel'
import { MacroCard } from '../components/portfolio/MacroCard'
import { Card } from '../components/ui/Card'
import styles from './PortfolioPage.module.css'

export function MarketsPage() {
  const [params] = useSearchParams()
  const requested = params.get('symbol')?.trim().toUpperCase() ?? 'VOO'
  const symbol = /^[A-Z0-9.^-]{1,12}$/.test(requested) ? requested : 'VOO'
  return <div className={styles.page}>
    <header className={styles.pageHeader}><div><h1 className="t-h1">Markets & research</h1><p className="t-body c-secondary">Understand an investment before making a decision.</p></div></header>
    <div className={styles.grid}>
      <SecurityResearch key={symbol} initialSymbol={symbol} />
      <aside className={styles.rail} aria-label="Research context"><MacroCard /><Card title="Reading the chart"><p className="t-body-sm c-secondary">The chart shows available closing prices, with the available dates listed below. Price return describes the security over that history. It does not measure your personal investment returns. Data may be adjusted or sampled, and dividend treatment varies by source.</p><p className="t-body-sm c-secondary" style={{ marginTop: 12 }}>Move across the chart to inspect a close, or choose “View as table” for the full set of observations.</p></Card></aside>
    </div>
  </div>
}
