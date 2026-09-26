import type { Macro } from '../../api/client'
import { useMacro } from '../../api/queries'
import { date, percent } from '../../lib/format'
import { QueryView } from '../QueryView'
import { StaleBadge } from '../ui/Badge'
import { Card } from '../ui/Card'
import styles from './MacroCard.module.css'

// Every /market/macro figure is already a percentage: format with percent(), never ×100 (DESIGN.md §10).
const ROWS: { key: keyof Macro; label: string }[] = [
  { key: 'fedFunds', label: 'Fed funds rate' },
  { key: 'cpiYoY', label: 'Inflation (CPI, year over year)' },
  { key: 'unemployment', label: 'Unemployment' },
  { key: 'wageGrowth', label: 'Wage growth (year over year)' },
  { key: 'tenYear', label: '10-year Treasury yield' },
]

export function MacroCard() {
  const query = useMacro()
  const data = query.data
  return (
    <Card
      title="Economy"
      aside={data?.stale && <StaleBadge asOf={data.asOf} />}
      footer={data && `As of ${date(data.asOf)} · Source: FRED`}
    >
      <QueryView query={query} label="Loading economic data" noun="Economic data">
        {(macro) => (
          <dl className={styles.rows}>
            {ROWS.map((r) => (
              <div key={r.key}>
                <dt className="t-body-sm c-secondary">{r.label}</dt>
                <dd className="t-body-strong num">{percent(macro[r.key] as number | null)}</dd>
              </div>
            ))}
          </dl>
        )}
      </QueryView>
    </Card>
  )
}
