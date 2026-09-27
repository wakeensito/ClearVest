import { ArrowRight, ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import type { Holding } from '../../api/client'
import { useProfile, useTemplates } from '../../api/queries'
import { typeColor } from '../../lib/assetTypes'
import { percentFromFraction } from '../../lib/format'
import { actualMix, drift, MIX_LABEL, MIX_ORDER, suggestTemplate, templateMix, type Mix, type MixClass, type Template } from '../../lib/targetMix'
import { useFundMap } from '../../lib/useFundMap'
import { advisorMixHref, fundsCheckedCaption } from '../../lib/xrayCopy'
import { Badge } from '../ui/Badge'
import { Skeleton, SkeletonBlock } from '../ui/Skeleton'
import styles from './PlanVsActual.module.css'

/** Plan classes borrow the asset-category colors (DESIGN.md §2): stocks = equity, bonds = fixed income. */
const CLASS_TYPE: Record<MixClass, string> = { stocks: 'equity', bonds: 'fixed income', cash: 'cash', other: 'other' }
const classColor = (c: MixClass) => typeColor(CLASS_TYPE[c])

export const SUGGESTED = 'Suggested for you'
export const PICK_A_PLAN = 'Pick a plan'
export const SUGGESTED_WHY = 'Picked from your answers (age, time horizon, risk comfort). A starting point, not advice.'

/**
 * "Your plan vs. today" (DESIGN.md §4.14): the account's stocks/bonds/cash mix beside a model
 * portfolio. The drift sentence carries the meaning; the bars are `aria-hidden`.
 */
export function PlanVsActual({ holdings }: { holdings: Holding[] }) {
  const fundMap = useFundMap(holdings)
  const profile = useProfile()
  const templates = useTemplates()
  const [picked, setPicked] = useState<string | null>(null)
  const selectId = useId()

  const actual = actualMix(holdings, fundMap.funds)
  if (MIX_ORDER.every((c) => actual[c] === 0)) return null
  if (profile.isPending || templates.isPending) return <SkeletonBlock lines={4} label="Loading your plan comparison" />

  const hasProfile = Boolean(profile.data)
  const suggested = suggestTemplate(profile.data ?? null)
  const list: Template[] = templates.data ?? []
  const currentId = picked ?? suggested
  const template = list.find((t) => t.id === currentId) ?? list.find((t) => t.id === suggested) ?? list[0]
  const target = template ? templateMix(template) : null
  const result = template && target ? drift(actual, target, template.name) : null
  const badge = !hasProfile && picked === null ? PICK_A_PLAN : hasProfile && template?.id === suggested ? SUGGESTED : null
  const caption = fundsCheckedCaption({ loaded: fundMap.loaded, total: fundMap.total, pending: fundMap.pending.length > 0 })

  return (
    <div className={styles.plan} data-plan-vs-actual>
      {template && (
        <div className={styles.picker}>
          <div className={styles.pickerHead}>
            <label htmlFor={selectId} className={styles.label}>Compare with</label>
            {badge && <Badge tone={badge === SUGGESTED ? 'sandbox' : 'neutral'}>{badge}</Badge>}
          </div>
          <div className={styles.selectWrap}>
            <select id={selectId} className={styles.select} value={template.id} onChange={(e) => setPicked(e.target.value)}>
              {list.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden className={styles.chevron} />
          </div>
          {hasProfile ? (
            template.id === suggested && <p className="t-body-sm c-secondary">{SUGGESTED_WHY}</p>
          ) : (
            <p className="t-body-sm c-secondary">
              Answer three questions in your{' '}
              <Link to="/welcome?edit=1" state={{ returnTo: '/portfolio' }}>investment profile</Link>
              {' '}to get a suggested plan.
            </p>
          )}
        </div>
      )}

      <div className={styles.bars} aria-hidden>
        <MixBar label="Today" mix={actual} />
        {target && template ? <MixBar label={template.name} mix={target} /> : templates.isError ? null : <Skeleton height={12} />}
      </div>

      <MixLegend actual={actual} target={target} />

      {result && template && (
        <div className={styles.read}>
          <p className={styles.lead}>{result.sentence}</p>
          <p className="t-body-sm c-tertiary">{template.description}</p>
          <Link className={styles.ask} to={advisorMixHref(result.sentence)}>
            Ask the advisor why this matters <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      )}
      {caption && <p className={styles.dataLine}>{caption}</p>}
    </div>
  )
}

function MixBar({ label, mix }: { label: string; mix: Mix }) {
  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{label}</span>
      <span className={styles.bar}>
        {MIX_ORDER.filter((c) => mix[c] > 0).map((c) => (
          <span key={c} style={{ flexGrow: mix[c], background: classColor(c) }} />
        ))}
      </span>
    </div>
  )
}

function MixLegend({ actual, target }: { actual: Mix; target: Mix | null }) {
  const shown = MIX_ORDER.filter((c) => actual[c] > 0 || (target?.[c] ?? 0) > 0)
  return (
    <table className={styles.legend}>
      <caption className="sr-only">Your mix{target ? ' and the plan' : ''} by share of money</caption>
      <thead>
        <tr>
          <th scope="col"><span className="sr-only">Kind of investment</span></th>
          <th scope="col">Today</th>
          {target && <th scope="col">Plan</th>}
        </tr>
      </thead>
      <tbody>
        {shown.map((c) => (
          <tr key={c}>
            <th scope="row"><span className={styles.swatch} style={{ background: classColor(c) }} aria-hidden />{MIX_LABEL[c]}</th>
            <td>{percentFromFraction(actual[c])}</td>
            {target && <td>{percentFromFraction(target[c])}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
