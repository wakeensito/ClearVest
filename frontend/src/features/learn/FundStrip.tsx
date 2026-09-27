import type { FundPlay } from '../../lib/lessons'
import { date, percentFromFraction } from '../../lib/format'
import styles from './Learn.module.css'

/** The fund's ten biggest holdings as a table with bars, so "Apple is twice Amazon" is visible at a glance. */
export function FundStrip({ play, focus }: { play: FundPlay; focus?: string }) {
  const max = Math.max(...play.holdings.map((h) => h.weight))
  const rest = Math.max(0, 1 - play.topShare)
  return <div className={styles.fund}>
    <table className={styles.fundTable}>
      <caption className={styles.fundCaption}>What {play.fund} holds, ten biggest first. Weights as of {date(play.asOf)}.</caption>
      <thead className="sr-only"><tr><th scope="col">Company</th><th scope="col">Share of the fund</th></tr></thead>
      <tbody>
        {play.holdings.map((h) => <tr key={h.symbol} className={h.symbol === focus ? styles.fundFocus : undefined} aria-current={h.symbol === focus ? 'true' : undefined}>
          <th scope="row"><span className={styles.fundSymbol}>{h.symbol}</span><span className={styles.fundName}>{h.name}</span></th>
          <td><span className={styles.fundBar} aria-hidden><span style={{ width: `${(h.weight / max) * 100}%` }} /></span><span className={styles.fundWeight}>{percentFromFraction(h.weight)}</span></td>
        </tr>)}
      </tbody>
    </table>
    <p className={styles.fundRest}>These ten are {percentFromFraction(play.topShare)} of the fund. Roughly 490 other companies share the other {percentFromFraction(rest)}.</p>
  </div>
}
