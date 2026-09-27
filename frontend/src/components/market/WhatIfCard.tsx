import { useId, useState } from 'react'
import { Link } from 'react-router'
import type { Fund, Holding } from '../../api/client'
import { hasCode } from '../../api/errors'
import { useHoldings, useProfile } from '../../api/queries'
import type { FundState } from '../../lib/fundExplainer'
import { currencyWhole } from '../../lib/format'
import type { FundMap } from '../../lib/portfolioXray'
import type { RiskProfile } from '../../lib/risk'
import { fundSymbols, useFundMap } from '../../lib/useFundMap'
import { whatIf, whatIfSentence, type WhatIfResult } from '../../lib/whatIf'
import { wholePercent } from '../../lib/xrayCopy'
import { AMOUNT_MAX, AMOUNT_MIN, biggestCompanyLine, parseAmount, whatIfCaption } from '../../lib/whatIfCopy'
import { SegmentedControl } from '../ui/SegmentedControl'
import styles from './WhatIfCard.module.css'

type Preset = '500' | '1000' | '5000'
const PRESETS: { value: Preset; label: string }[] = [
  { value: '500', label: '$500' },
  { value: '1000', label: '$1,000' },
  { value: '5000', label: '$5,000' },
]
const ADDABLE = new Set<Fund['kind']>(['stock', 'etf', 'mutual_fund', 'crypto'])
const FUND_KINDS = new Set<Fund['kind']>(['etf', 'mutual_fund'])

/** Same three bands as the risk card (§4.6): neutral on purpose, risk is not a loss. */
const BANDS = [{ from: 0, to: 33 }, { from: 34, to: 66 }, { from: 67, to: 100 }]

/**
 * "What would this do to my portfolio?" (DESIGN.md §4.15), under the ticker page's identity row.
 * Renders nothing until everything it needs has arrived, and nothing at all for an empty account,
 * an index, or any failed query: the research card never waits on it. An unlinked account (409)
 * gets one line inviting it to the portfolio page instead, unless `invite` is false (on the
 * portfolio page itself, where that link would point back at the page).
 */
export function WhatIfCard({ symbol, state, invite = true }: { symbol: string; state: FundState; invite?: boolean }) {
  const holdings = useHoldings()
  const profile = useProfile()
  const fundMap = useFundMap(holdings.data?.holdings)
  const fund = state.status === 'success' ? state.fund : null

  if (!fund || !ADDABLE.has(fund.kind)) return null
  if (holdings.isError && hasCode(holdings.error, 'NOT_LINKED')) {
    if (!invite) return null
    return (
      <Link to="/portfolio" className={styles.invite} data-what-if-invite>
        {`Link an account, or try the sample one, to see what adding ${symbol.trim().toUpperCase()} would do to your mix →`}
      </Link>
    )
  }
  if (!holdings.data) return null
  // A 404 means no saved profile: score without it, like the backend. Any other error: nothing.
  if (profile.isPending) return null
  if (profile.isError && !hasCode(profile.error, 'NOT_FOUND')) return null
  // Wait for the account's first fund while any is in flight; once every fund failed or was never
  // checked, render anyway (the "N of M funds checked" caption says how many were counted).
  if (fundMap.pending.length > 0 && fundMap.loaded === 0) return null
  const rows = holdings.data.holdings
  if (!(rows.reduce((sum, h) => sum + Math.max(h.value, 0), 0) > 0)) return null

  const upper = symbol.trim().toUpperCase()
  // A fund being added is looked inside too, so it joins the "N of M" count.
  const addsFund = FUND_KINDS.has(fund.kind) && !(upper in fundMap.funds)
  const held = fundSymbols(rows).includes(upper)
  const coverage = { checked: fundMap.loaded + (addsFund ? 1 : 0), total: fundMap.total + (addsFund && !held ? 1 : 0) }

  return <WhatIfBody symbol={upper} fund={fund} holdings={rows} funds={fundMap.funds} profile={profile.data ?? null} coverage={coverage} />
}

interface BodyProps {
  symbol: string
  fund: Fund
  holdings: readonly Holding[]
  funds: FundMap
  profile: RiskProfile | null
  coverage: { checked: number; total: number }
}

function WhatIfBody({ symbol, fund, holdings, funds, profile, coverage }: BodyProps) {
  const id = useId()
  const [preset, setPreset] = useState<Preset>('1000')
  const [raw, setRaw] = useState('')
  const parsed = parseAmount(raw)
  const custom = parsed.status === 'ok'
  const dollars = custom ? parsed.dollars : Number(preset)
  const result = whatIf({ holdings, funds, symbol, fund, dollars, profile })
  if (!result.addable) return null

  const biggest = biggestCompanyLine(result.largestBefore, result.largestAfter)
  const inputId = `${id}-amount`
  const noteId = `${id}-note`

  return (
    <section className={styles.card} aria-labelledby={`${id}-heading`} data-what-if={symbol}>
      <h3 id={`${id}-heading`} className={styles.eyebrow}>What would this do to my portfolio?</h3>

      <div className={styles.amount}>
        <SegmentedControl<Preset | 'custom'>
          label="Amount to add"
          value={custom ? 'custom' : preset}
          options={PRESETS}
          onChange={(value) => { if (value !== 'custom') { setPreset(value); setRaw('') } }}
        />
        <div className={styles.other}>
          <label htmlFor={inputId} className={styles.otherLabel}>Other amount</label>
          <span className={styles.inputWrap} data-invalid={parsed.status === 'invalid' || undefined}>
            <span className={styles.prefix} aria-hidden>$</span>
            <input
              id={inputId}
              className={styles.input}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="2,500"
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              aria-invalid={parsed.status === 'invalid' || undefined}
              aria-describedby={parsed.status === 'invalid' ? noteId : undefined}
            />
          </span>
        </div>
      </div>
      {parsed.status === 'invalid' && (
        <p id={noteId} className={styles.error}>Enter an amount from {currencyWhole(AMOUNT_MIN)} to {currencyWhole(AMOUNT_MAX)}. Showing {PRESETS.find(p => p.value === preset)?.label}.</p>
      )}

      <p className={styles.lead} aria-live="polite">{whatIfSentence(result, symbol, dollars)}</p>

      <dl className={styles.figures}>
        <RiskFigure result={result} />
        <ExposureFigure result={result} symbol={symbol} />
      </dl>

      {biggest && <p className={styles.note}>{biggest}</p>}
      <p className={styles.dataLine}>{whatIfCaption(coverage)}</p>
    </section>
  )
}

const clampScore = (n: number) => Math.min(Math.max(n, 0), 100)

function RiskFigure({ result }: { result: WhatIfResult }) {
  const before = clampScore(result.riskBefore.score)
  const after = clampScore(result.riskAfter.score)
  const changed = result.riskBefore.label !== result.riskAfter.label
  return (
    <div className={styles.figure}>
      <dt className={styles.figureLabel}>Risk score</dt>
      <dd className={styles.figureValue}>
        <span className={styles.move}>{result.riskBefore.score} → {result.riskAfter.score}</span>
        <span className={styles.band}>{changed ? `${result.riskBefore.label} → ${result.riskAfter.label}` : result.riskAfter.label}</span>
      </dd>
      <dd className={styles.scale} aria-hidden>
        <span className={styles.bands}>
          {BANDS.map((b) => <span key={b.from} />)}
        </span>
        <span className={styles.shift} style={{ left: `${Math.min(before, after)}%`, width: `${Math.abs(after - before)}%` }} />
        <span className={styles.before} style={{ left: `${before}%` }} />
        <span className={styles.after} style={{ left: `${after}%` }} />
      </dd>
    </div>
  )
}

function ExposureFigure({ result, symbol }: { result: WhatIfResult; symbol: string }) {
  const before = Math.min(Math.max(result.exposureBefore, 0), 1)
  const added = Math.min(Math.max(result.exposureAfter - before, 0), 1 - before)
  return (
    <div className={styles.figure}>
      <dt className={styles.figureLabel}>{symbol}'s share of your money</dt>
      <dd className={styles.figureValue}>
        <span className={styles.move}>{result.exposureBefore === 0 ? 'none' : wholePercent(result.exposureBefore)} → {wholePercent(result.exposureAfter)}</span>
      </dd>
      <dd className={styles.track} aria-hidden>
        {before > 0 && <span className={styles.today} style={{ width: `${before * 100}%` }} />}
        {added > 0 && <span className={styles.added} style={{ width: `${added * 100}%` }} />}
      </dd>
    </div>
  )
}
