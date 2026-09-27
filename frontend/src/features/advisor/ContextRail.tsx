import { ChevronDown, Database, Pencil, SlidersHorizontal, Target } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { hasCode } from '../../api/errors'
import { useHoldings, useMacro, useProfile, useRisk } from '../../api/queries'
import { currency, date } from '../../lib/format'
import styles from './ContextRail.module.css'

const horizonLabels = { short: 'Short term', medium: 'Medium term', long: 'Long term' }
const toleranceLabels = { low: 'Low', medium: 'Medium', high: 'High' }

/** A reviewable summary of the information available to the advisor. */
export function ContextRail() {
  const location = useLocation()
  const profile = useProfile()
  const holdings = useHoldings()
  const risk = useRisk()
  const macro = useMacro()
  const [expanded, setExpanded] = useState(() => window.matchMedia('(min-width: 1024px)').matches)

  return (
    <aside className={styles.rail} aria-label="What the advisor sees">
      <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary className={styles.heading}>
          <span className={styles.contextIcon}><SlidersHorizontal size={20} aria-hidden /></span>
          <span><h2>Your investing context</h2><span className={styles.subtitle}>What informs your answers</span></span>
          <ChevronDown className={styles.chevron} size={18} aria-hidden />
        </summary>
        <div className={styles.body}>
          <section className={styles.section} aria-labelledby="context-profile">
            <div className={styles.sectionHeading}>
              <h3 id="context-profile">Your profile</h3>
              <Link to="/welcome?edit=1" state={{ returnTo: location.pathname + location.search }} className={styles.edit}><Pencil size={13} aria-hidden />Edit<span className="sr-only"> profile</span></Link>
            </div>
            {profile.data ? <>
              <dl className={styles.facts}>
                <div><dt>Age</dt><dd>{profile.data.age}</dd></div>
                <div><dt>Investment horizon</dt><dd>{horizonLabels[profile.data.horizon]}</dd></div>
                <div><dt>Risk tolerance</dt><dd>{toleranceLabels[profile.data.riskTolerance]}</dd></div>
              </dl>
              <h4 className={styles.goalsHeading}><Target size={15} aria-hidden />Your goals</h4>
              {profile.data.goals.length > 0 ? <ul className={styles.goals}>
                {profile.data.goals.map((goal, index) => <li key={`${goal}-${index}`}>{goal}</li>)}
              </ul> : <p className={styles.note}>Add your goals in your profile.</p>}
            </> : <p className={styles.note}>{profile.isPending ? 'Loading your profile…' : hasCode(profile.error, 'NOT_FOUND') ? 'No profile yet. Add one for more personal context.' : 'Your profile is unavailable.'}</p>}
          </section>

          <section className={styles.section} aria-labelledby="context-portfolio">
            <div className={styles.sectionHeading}>
              <h3 id="context-portfolio">Portfolio</h3>
              {holdings.data && <span className={styles.note}>{holdings.data.holdings.length} {holdings.data.holdings.length === 1 ? 'holding' : 'holdings'}</span>}
            </div>
            {holdings.data ? <>
              <p className={`${styles.value} num`}>{currency(holdings.data.totalValue)}</p>
              {holdings.data.stale && <p className={styles.note}>Cached holdings</p>}
            </> : <p className={styles.note}>{holdings.isPending ? 'Loading your portfolio…' : hasCode(holdings.error, 'NOT_LINKED') ? 'No account linked yet.' : 'Portfolio data is unavailable.'}</p>}
            <div className={styles.risk}>
              <div className={styles.riskHeading}>
                <h4>Risk score</h4>
                {risk.data && <p><span>{risk.data.label}</span><strong className="num">{risk.data.score}<span className={styles.outOf}> / 100</span></strong></p>}
              </div>
              {risk.data ? <>
                <div className={styles.scale} role="meter" aria-label="Portfolio risk score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={risk.data.score} aria-valuetext={`${risk.data.score} out of 100, ${risk.data.label}`}>
                  <span className={styles.marker} style={{ left: `${Math.min(Math.max(risk.data.score, 0), 100)}%` }} />
                </div>
                <div className={styles.scaleLabels} aria-hidden><span>Lower risk</span><span>Higher risk</span></div>
              </> : <p className={styles.note}>{risk.isPending ? 'Loading risk score…' : 'Risk score is unavailable.'}</p>}
            </div>
          </section>
        </div>
        <footer className={styles.source}>
          <Database size={16} aria-hidden />
          <div><h3>Economic context</h3>
            {macro.data ? <p>FRED<span>As of {date(macro.data.asOf)}</span></p> : <p>{macro.isPending ? 'Loading economic data…' : 'Economic data is unavailable.'}</p>}
          </div>
        </footer>
      </details>
    </aside>
  )
}
