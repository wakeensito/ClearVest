import { ExplainThis } from '../../features/advisor/ExplainThis'
import { ScoutTarget } from '../../features/advisor/ScoutTarget'
import { useRisk } from '../../api/queries'
import { ExplainText } from '../education/Term'
import { RelatedLesson } from '../education/RelatedLesson'
import { findLesson } from '../../lib/lessons'
import { QueryView } from '../QueryView'
import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'
import styles from './RiskCard.module.css'

const DIVERSIFICATION_TITLE = findLesson('diversification')?.lesson.title ?? 'Don’t put all your eggs in one basket'

const BANDS = [
  { label: 'Conservative', from: 0, to: 33 },
  { label: 'Moderate', from: 34, to: 66 },
  { label: 'Aggressive', from: 67, to: 100 },
]

/** DESIGN.md §4.9. Neutral bands on purpose: risk is not a loss, so no green-to-red. */
export function RiskCard({ hideDetails = false }: { hideDetails?: boolean }) {
  const query = useRisk()
  return (
    <Card title="Risk score">
      <QueryView query={query} label="Loading risk score" noun="The risk score" skeleton={<RiskSkeleton />}>
        {(risk) => (
          <ScoutTarget name="risk"><div className={styles.risk}>
            <p className={styles.score}>
              <span className="t-display">{risk.score}</span>
              <span className="t-body c-tertiary num">/100</span>
              <span className={`t-h3 ${styles.label}`}>{risk.label}</span>
            </p>

            <div className={styles.scale} role="img" aria-label={`Risk score ${risk.score} out of 100, ${risk.label}`}>
              <div className={styles.bands}>
                {BANDS.map((b) => (
                  <span key={b.label} data-active={risk.score >= b.from && risk.score <= b.to ? '' : undefined} />
                ))}
              </div>
              <span className={styles.marker} style={{ left: `${Math.min(Math.max(risk.score, 0), 100)}%` }} />
              <div className={`t-caption c-tertiary ${styles.bandLabels}`}>
                {BANDS.map((b) => (
                  <span key={b.label}>{b.label}</span>
                ))}
              </div>
            </div>

            <p className="t-body">{hideDetails ? 'Show portfolio values to read your account-specific risk explanation.' : <ExplainText text={risk.summary} />}</p>

            {!hideDetails && <details className={styles.details}>
            <summary>What shapes this score</summary>
            <dl className={styles.factors}>
              {risk.factors.map((f) => (
                <div key={f.name}>
                  <dt className="t-body-strong">{f.name}</dt>
                  <dd className="t-body-sm c-secondary"><ExplainText text={f.detail} /></dd>
                </div>
              ))}
            </dl>
            </details>}
            <RelatedLesson text={hideDetails ? '' : risk.summary} fallback={{ id: 'diversification', title: DIVERSIFICATION_TITLE }} />
            {!hideDetails && <ExplainThis context={{ page: 'portfolio', metric: 'risk' }} question="Explain my saved portfolio risk score and its main risk driver in plain language." label="Explain this score" />}
          </div></ScoutTarget>
        )}
      </QueryView>
    </Card>
  )
}

function RiskSkeleton() {
  return (
    <div className={styles.risk} aria-label="Loading risk score" role="status">
      <Skeleton width={120} height={42} />
      <Skeleton height={6} />
      <Skeleton />
      <Skeleton width="70%" />
    </div>
  )
}
