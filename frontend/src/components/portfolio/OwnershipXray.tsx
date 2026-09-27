import type { Holdings } from '../../api/client'
import { currency, percentFromFraction, timestamp } from '../../lib/format'
import { expenseRatioLabel } from '../../lib/fundExplainer'
import { fundFees, lookThrough, type Exposure } from '../../lib/lookThrough'
import { useFundMap, type FundMapState } from '../../lib/useFundMap'
import { coverageCaption, feeCopy, FEES_PENDING, ownershipHeadline, topCompaniesLine, viaLine } from '../../lib/xrayCopy'
import { Button } from '../ui/Button'
import { Dots } from '../ui/Dots'
import { SkeletonBlock } from '../ui/Skeleton'
import styles from './OwnershipXray.module.css'

const ROWS = 5
export const NO_XRAY_DATA = 'This account has no stocks or funds to look inside.'
export const FUNDS_UNAVAILABLE = "We couldn't look inside your funds right now."
export const XRAY_WHY = 'Funds are baskets of companies, so the same company can sit in several of your funds.'

/** Directly under the eyebrow in every state with something to show (not the empty one). */
const Why = () => <p className="t-body-sm c-secondary">{XRAY_WHY}</p>

/**
 * "What you really own" (DESIGN.md §4.14): the companies behind the account once each fund is
 * opened up, and what the funds cost. The sentences carry the meaning; bars are decoration.
 */
export function OwnershipXray({ data, hideValues = false }: { data: Holdings; hideValues?: boolean }) {
  const fundMap = useFundMap(data.holdings)
  const checking = fundMap.pending.length > 0
  const waitingForFirstFund = checking && fundMap.loaded === 0

  return (
    <section id="xray" className={styles.card} aria-labelledby="xray-heading">
      <header className={styles.head}>
        <h2 id="xray-heading" className={styles.eyebrow}>What you really own</h2>
        {checking && !waitingForFirstFund && <Dots label="Checking more of your funds" />}
      </header>
      {waitingForFirstFund ? (
        <>
          <Why />
          <SkeletonBlock lines={4} label="Looking inside your funds" />
        </>
      ) : (
        <XrayBody data={data} fundMap={fundMap} hideValues={hideValues} />
      )}
    </section>
  )
}

/** Holdings still loading: the same surface and heading, so the page doesn't jump. */
export function OwnershipXraySkeleton() {
  return (
    <section id="xray" className={styles.card} aria-labelledby="xray-heading">
      <header className={styles.head}><h2 id="xray-heading" className={styles.eyebrow}>What you really own</h2></header>
      <SkeletonBlock lines={4} label="Loading what you own" />
    </section>
  )
}

function XrayBody({ data, fundMap, hideValues }: { data: Holdings; fundMap: FundMapState; hideValues: boolean }) {
  const checking = fundMap.pending.length > 0
  const lt = lookThrough(data.holdings, fundMap.funds)
  const top = lt.companies[0]

  // Every fund lookup failed or came back empty: saying who the money is in would be a guess.
  if (lt.fundsTotal > 0 && lt.fundsLookedThrough === 0 && !checking) {
    return (
      <>
        <Why />
        <div className={styles.unavailable}>
          <p className="t-body c-secondary">{FUNDS_UNAVAILABLE}</p>
          {fundMap.failed.length > 0 && <Button variant="secondary" size="compact" onClick={fundMap.retry}>Retry</Button>}
        </div>
      </>
    )
  }
  if (!lt.hasData || !top) return <p className="t-body c-secondary">{NO_XRAY_DATA}</p>

  const scale = top.share
  const summary = topCompaniesLine(lt)
  const caption = coverageCaption({ checked: lt.fundsLookedThrough, total: lt.fundsTotal, coverage: lt.coverage, asOf: timestamp(data.asOf) })
  const headline = ownershipHeadline(top, { unopened: lt.fundsTotal - lt.fundsLookedThrough, checking })

  return (
    <>
      <Why />
      <p className={styles.headline}>{headline}</p>
      <ol role="list" className={styles.rows}>
        {lt.companies.slice(0, ROWS).map((c) => <CompanyRow key={c.symbol ?? c.name} company={c} scale={scale} />)}
      </ol>
      {summary && <p className={styles.summary}>{summary}</p>}
      <p className={styles.dataLine}>{caption}</p>
      <FeePanel data={data} fundMap={fundMap} hideValues={hideValues} />
    </>
  )
}

function CompanyRow({ company: c, scale }: { company: Exposure; scale: number }) {
  const via = viaLine(c)
  const fundShare = Math.max(c.share - c.direct, 0)
  return (
    <li className={styles.row}>
      <div className={styles.line}>
        <span className={styles.name}>
          {c.name || c.symbol}
          {c.symbol && c.name && <>{' '}<span className={styles.symbol}>{c.symbol}</span></>}
        </span>
        <span className={styles.share}>{percentFromFraction(c.share)}</span>
      </div>
      <div className={styles.track} aria-hidden>
        {c.direct > 0 && <span className={styles.direct} style={{ width: `${(c.direct / scale) * 100}%` }} />}
        {fundShare > 0 && <span className={styles.viaFill} style={{ width: `${(fundShare / scale) * 100}%` }} />}
      </div>
      {via && <p className={styles.via}>{via}</p>}
    </li>
  )
}

function FeePanel({ data, fundMap, hideValues }: { data: Holdings; fundMap: FundMapState; hideValues: boolean }) {
  const fees = fundFees(data.holdings, fundMap.funds)
  if (fundMap.pending.length > 0) {
    // A fund still loading would read as "fee not available" and undercount the total: wait.
    return (
      <div className={styles.fees} role="group" aria-labelledby="xray-fees-heading" data-xray-fees="pending">
        <h3 id="xray-fees-heading" className="t-h3">What it costs</h3>
        <p className={`t-body-sm c-secondary ${styles.pending}`}>{FEES_PENDING} <Dots /></p>
      </div>
    )
  }
  const copy = feeCopy(fees, hideValues, { notChecked: fundMap.unchecked })
  if (!copy) return null
  return (
    <div className={styles.fees} role="group" aria-labelledby="xray-fees-heading" data-xray-fees>
      <h3 id="xray-fees-heading" className="t-h3">What it costs</h3>
      <div className={styles.sentences}>
        <p className={styles.feeLead}>{copy.cost}</p>
        {copy.perTenThousand && <p className="t-body-sm c-secondary">{copy.perTenThousand}</p>}
        {copy.tenYear && <p className="t-body-sm c-secondary">{copy.tenYear}</p>}
        {copy.cheapest && <p className="t-body-sm c-secondary">{copy.cheapest}</p>}
      </div>
      {fees.rows.length > 0 && (
        <table className={styles.feeTable}>
          <caption className="sr-only">Yearly cost of each fund</caption>
          <thead>
            <tr><th scope="col">Fund</th><th scope="col">Expense ratio</th><th scope="col">Per year</th></tr>
          </thead>
          <tbody>
            {fees.rows.map((r) => (
              <tr key={r.symbol}>
                <th scope="row" title={r.name}>{r.symbol}</th>
                <td>{expenseRatioLabel(r.ratio) ?? '—'}</td>
                <td>{hideValues ? 'Hidden' : currency(r.dollars)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {copy.unknown && <p className={styles.dataLine}>{copy.unknown}</p>}
      {copy.notChecked && <p className={styles.dataLine}>{copy.notChecked}</p>}
    </div>
  )
}
