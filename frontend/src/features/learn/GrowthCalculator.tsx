import { useId, useState } from 'react'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { currencyWhole } from '../../lib/format'
import { growth } from '../../lib/learnProgress'
import styles from './Learn.module.css'

const RATES = [
  { value: '0', label: '0%' },
  { value: '0.04', label: '4%' },
  { value: '0.06', label: '6%' },
  { value: '0.08', label: '8%' },
] as const
type Rate = (typeof RATES)[number]['value']

/** A hypothetical illustration of compound growth. Not a projection of any real investment. */
export function GrowthCalculator() {
  const [monthly, setMonthly] = useState(100)
  const [years, setYears] = useState(30)
  const [rate, setRate] = useState<Rate>('0.06')
  const monthlyId = useId()
  const yearsId = useId()
  const { contributed, value } = growth(monthly, years, Number(rate))
  const earned = Math.max(0, value - contributed)
  const contributedShare = value > 0 ? (contributed / value) * 100 : 100

  return <div className={styles.calc}>
    <div className={styles.calcInputs}>
      <label htmlFor={monthlyId} className={styles.calcLabel}>
        <span>Each month</span>
        <strong>{currencyWhole(monthly)}</strong>
      </label>
      <input id={monthlyId} type="range" min={25} max={1000} step={25} value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} />
      <label htmlFor={yearsId} className={styles.calcLabel}>
        <span>For how long</span>
        <strong>{years} {years === 1 ? 'year' : 'years'}</strong>
      </label>
      <input id={yearsId} type="range" min={1} max={40} step={1} value={years} onChange={(e) => setYears(Number(e.target.value))} />
      <div className={styles.calcLabel}><span>Hypothetical yearly growth</span></div>
      <SegmentedControl label="Hypothetical yearly growth rate" options={[...RATES]} value={rate} onChange={setRate} />
    </div>
    <div className={styles.calcResult} aria-live="polite">
      <p className={styles.calcCaption}>Illustrated value after {years} {years === 1 ? 'year' : 'years'}</p>
      <p className={styles.calcTotal}>{currencyWhole(value)}</p>
      <div className={styles.calcBar} aria-hidden>
        <span className={styles.calcBarYou} style={{ width: `${contributedShare}%` }} />
        <span className={styles.calcBarGrowth} style={{ width: `${100 - contributedShare}%` }} />
      </div>
      <dl className={styles.calcLegend}>
        <div><dt><i className={styles.calcSwatchYou} />You put in</dt><dd>{currencyWhole(contributed)}</dd></div>
        <div><dt><i className={styles.calcSwatchGrowth} />Growth</dt><dd>{currencyWhole(earned)}</dd></div>
      </dl>
      <p className={styles.source}>Illustration only. Assumes the same growth every year, compounded monthly. Real returns change year to year, can be negative, and are not guaranteed. Fees, taxes and inflation are not included.</p>
    </div>
  </div>
}
