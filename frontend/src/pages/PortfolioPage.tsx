import { ArrowRight, Search, SlidersHorizontal, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { WelcomeBanner } from '../components/WelcomeBanner'
import { read, write } from '../lib/storage'
import type { Holdings } from '../api/client'
import { hasCode } from '../api/errors'
import { useHoldings } from '../api/queries'
import { LinkAccountCard } from '../components/LinkAccountCard'
import { SecurityResearch } from '../components/market/ResearchPanel'
import { AllocationBar } from '../components/portfolio/AllocationBar'
import { HoldingsTable } from '../components/portfolio/HoldingsTable'
import { MacroCard } from '../components/portfolio/MacroCard'
import { RiskCard } from '../components/portfolio/RiskCard'
import { QueryView } from '../components/QueryView'
import { StaleBadge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { ButtonLink } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { normalizeType } from '../lib/assetTypes'
import { currencyParts, percentFromFraction, timestamp } from '../lib/format'
import styles from './PortfolioPage.module.css'

export function PortfolioPage() {
  const holdings = useHoldings()
  const notLinked = hasCode(holdings.error, 'NOT_LINKED')
  const [filter, setFilter] = useState('')
  const [hidden, setHidden] = useState(() => read('cv-hide-balances') === 'true')
  return (
    <div className={styles.page}>
      <WelcomeBanner />
      <header className={styles.pageHeader}>
        <h2 className="t-h2">Your portfolio</h2>
        <div className={styles.headerActions}><button type="button" className={styles.privacy} aria-pressed={hidden} onClick={() => { setHidden(!hidden); write('cv-hide-balances', String(!hidden)) }}>{hidden ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}{hidden ? 'Show portfolio values' : 'Hide portfolio values'}</button>
        <ButtonLink to="/welcome?edit=1" state={{ returnTo: '/portfolio' }} variant="secondary" icon={<SlidersHorizontal size={16} aria-hidden />}>Investment profile</ButtonLink></div>
      </header>
      <section className={styles.summary} aria-label="Account summary">
        {notLinked ? <LinkAccountCard /> : <QueryView query={holdings} label="Loading portfolio" noun="Your portfolio" skeleton={<HeroSkeleton />}>
          {(data) => <Hero data={data} hidden={hidden} />}
        </QueryView>}
      </section>
      <div className={styles.grid}>
        <div className={styles.main}>
          <SecurityResearch />
          {!notLinked && <section className={styles.holdings} aria-labelledby="holdings-heading">
            <div className={styles.holdingsHeader}>
              <div><h2 id="holdings-heading" className="t-h2">Holdings</h2><p className="t-body-sm c-secondary">Select a symbol to research it.</p></div>
              <label className={styles.filter}><Search size={16} aria-hidden /><span className="sr-only">Filter holdings</span><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a holding" /></label>
            </div>
            <QueryView query={holdings} label="Loading holdings" noun="Your holdings">
              {(data) => {
                const rows = data.holdings.filter((h) => `${h.symbol} ${h.name}`.toLowerCase().includes(filter.trim().toLowerCase()))
                return rows.length ? <HoldingsTable holdings={rows} hideValues={hidden} /> : <p className={styles.empty}>{data.holdings.length ? 'No holdings match your search. Try a name or symbol.' : 'This account has no holdings yet. Your investments will appear here.'}</p>
              }}
            </QueryView>
          </section>}
        </div>
        <aside className={styles.rail} aria-label="Portfolio context">
          {!notLinked && <Card title="Portfolio mix">
            <QueryView query={holdings} label="Loading allocation" noun="Your allocation">{(data) => <><p className={styles.allocationIntro}>How your money is allocated across asset types.</p><AllocationBar holdings={data.holdings} hideValues={hidden} /></>}</QueryView>
          </Card>}
          {!notLinked && <RiskCard hideDetails={hidden} />}
          <AskCard holdings={holdings.data} />
          <MacroCard />
        </aside>
      </div>
    </div>
  )
}

const DEFENSIVE = new Set(['fixed income', 'cash'])
function Hero({ data, hidden }: { data: Holdings; hidden: boolean }) {
  const { whole, cents } = currencyParts(data.totalValue)
  const largest = data.holdings.reduce<Holdings['holdings'][number] | undefined>((max, h) => (!max || h.value > max.value ? h : max), undefined)
  const types = new Set(data.holdings.map((h) => normalizeType(h.type))).size
  const defensive = data.holdings.filter((h) => DEFENSIVE.has(normalizeType(h.type))).reduce((sum, h) => sum + h.weight, 0)
  return (
    <>
      <div className={styles.heroInner}>
        <div className={styles.heroMain}>
          <div className={styles.heroHead}><p className="t-body-sm c-secondary">Total account value</p>{data.stale && <StaleBadge asOf={data.asOf} />}</div>
          <p className={`t-display-xl ${styles.value}`} data-private-value aria-label={hidden ? 'Account value hidden' : undefined}>{hidden ? '••••' : <>{whole}<span className={styles.cents}>{cents}</span></>}</p>
          <p className="t-body-sm c-secondary">Linked investment holdings</p>
        </div>
        <dl className={styles.figures}>
          <div><dt>Holdings</dt><dd>{data.holdings.length}</dd><dd className={styles.detail}>Across {types} asset {types === 1 ? 'type' : 'types'}</dd></div>
          <div><dt>Largest holding</dt><dd>{largest?.symbol ?? '—'}</dd><dd className={styles.detail}>{largest ? `${percentFromFraction(largest.weight)} of portfolio` : 'No positions yet'}</dd></div>
          <div><dt>Bonds and cash</dt><dd>{data.holdings.length ? percentFromFraction(defensive) : '—'}</dd><dd className={styles.detail}>Share of total value</dd></div>
        </dl>
      </div>
      <div className={styles.summaryFoot}><span>As of {timestamp(data.asOf)}</span><span>Source: Plaid sandbox</span></div>
    </>
  )
}
function HeroSkeleton() {
  return <div className={styles.heroMain} role="status" aria-label="Loading portfolio"><Skeleton width={100} height={14} /><Skeleton width={260} height={56} /><Skeleton width={220} height={12} /></div>
}
function AskCard({ holdings }: { holdings?: Holdings }) {
  const largest = holdings?.holdings.reduce<Holdings['holdings'][number] | undefined>((max, h) => !max || h.value > max.value ? h : max, undefined)
  const prompts = [largest ? `How does ${largest.symbol} affect my portfolio?` : 'How diversified is my portfolio?', 'Does my mix fit my time horizon?', 'What should I understand about my risk?']
  return <section className={styles.askCard}>
    <h2 className="t-h2">Put your holdings in context</h2>
    <p className="t-body-sm c-secondary">Start with a question about your investments.</p>
    <ul role="list" className={styles.asks}>{prompts.map((q) => <li key={q}><Link to={`/advisor?q=${encodeURIComponent(q)}`} className={styles.ask}><span>{q}</span><ArrowRight size={16} aria-hidden /></Link></li>)}</ul>
    <p className="t-caption c-tertiary">Educational information, not financial advice.</p>
  </section>
}
