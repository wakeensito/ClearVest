import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import { Link } from 'react-router'
import type { Fund } from '../../api/client'
import { date } from '../../lib/format'
import { HIGH_RISK, advisorHref, dollarStrip, everyDollar, expenseRatioLabel, feeSentence, firstSentence, isFund, isPlainIndexFund, kindLabel, learnTopics, normalizeKind, realDifference, type FundState, type Topic, type TopicId } from '../../lib/fundExplainer'
import { ExplainText } from '../education/Term'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
import styles from './FundExplainer.module.css'

/**
 * "VOO · Index fund (ETF)" under the ticker search (DESIGN.md §4.13). Quiet skeleton while loading;
 * nothing at all on error, so a fund-data failure never pushes or blocks the chart.
 */
export function FundIdentity({ symbol, state, open, onToggle, controls, canExplain = true }: {
  symbol: string
  state: FundState
  open: boolean
  onToggle: () => void
  /** id of the explainer region the button opens. */
  controls: string
  canExplain?: boolean
}) {
  if (state.status === 'error') return null
  if (state.status === 'pending') {
    return <div className={styles.identity} aria-hidden data-fund-identity="loading"><Skeleton width="11em" height={14} /><Skeleton width="15em" height={12} /></div>
  }
  return <div className={styles.identity} data-fund-identity="ready">
    <IdentityText symbol={symbol} fund={state.fund} />
    {canExplain && <button type="button" className={styles.what} aria-expanded={open} aria-controls={controls} onClick={onToggle}>What is this?</button>}
  </div>
}

/** "high risk" on a leveraged fund reads in the loss color; the words carry the meaning too. */
function KindLabel({ fund }: { fund: Fund }) {
  const label = kindLabel(fund)
  const suffix = ` · ${HIGH_RISK}`
  if (!label.endsWith(suffix)) return <>{label}</>
  return <>{label.slice(0, -suffix.length)} · <strong className={styles.risk}>{HIGH_RISK}</strong></>
}

function IdentityText({ symbol, fund }: { symbol: string; fund: Fund }) {
  return <div className={styles.identityText}>
    <p className={styles.kind}><span className={styles.ticker}>{symbol}</span> · <KindLabel fund={fund} /></p>
    {fund.tracks && <p className={styles.tracks}>Tracks the {fund.tracks}</p>}
  </div>
}

/** The inline explainer region. It pushes the chart down; it is never an overlay. */
export function FundExplainer({ id, symbol, state, onDone, onRetry, onSeeFinancials, onResearch, headingRef }: {
  id: string
  symbol: string
  state: FundState
  onDone: () => void
  onRetry: () => void
  onSeeFinancials: () => void
  /** Switches the research panel to another ticker (an index points to a fund that copies it). */
  onResearch: (symbol: string) => void
  headingRef?: Ref<HTMLHeadingElement>
}) {
  const headingId = `${id}-heading`
  const escape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    event.preventDefault()
    onDone()
  }
  return <section id={id} className={styles.explainer} aria-labelledby={headingId} onKeyDown={escape} data-fund-explainer={symbol}>
    <header className={styles.bar}>
      <h3 id={headingId} ref={headingRef} tabIndex={-1}>{symbol} explained</h3>
      <Button variant="secondary" onClick={onDone}>Done</Button>
    </header>
    {state.status === 'pending' && <div className={`${styles.body} ${styles.padded}`} role="status" aria-label={`Loading what ${symbol} is`}><Skeleton height={14} /><Skeleton width="80%" height={14} /><Skeleton height={32} /></div>}
    {state.status === 'error' && <div className={`${styles.body} ${styles.padded}`}><p className={styles.sentence}>We couldn’t load an explanation for {symbol} right now. The chart below still works.</p><button type="button" className={styles.link} onClick={onRetry}>Try again</button></div>}
    {state.status === 'success' && <FundLesson key={symbol} fund={state.fund} symbol={symbol} onSeeFinancials={onSeeFinancials} onResearch={onResearch} />}
  </section>
}

/**
 * The lesson (DESIGN.md §4.13): what it is, what's inside and what it costs stay visible, each at
 * most two lines on a phone; everything else waits behind one question chip at a time. `compact`
 * (Compare securities) drops the company-financials jump and the data line.
 */
export function FundLesson({ fund, symbol, onSeeFinancials, onResearch, compact = false }: { fund: Fund; symbol: string; onSeeFinancials?: () => void; onResearch?: (symbol: string) => void; compact?: boolean }) {
  const fundLike = isFund(fund.kind)
  const kind = normalizeKind(fund.kind)
  const stock = kind === 'stock'
  const topics = learnTopics({ ...fund, symbol })
  return <div className={styles.body}>
    <ol className={`${styles.steps} ${fundLike ? '' : styles.single}`}>
      <li>
        <h4><span aria-hidden>1</span>What is it?</h4>
        <p className={styles.sentence}><ExplainText text={firstSentence(fund.summary)} /></p>
        {kind === 'index' && <>
          <p className={styles.sentence}>You can’t buy an index directly; index funds like VOO copy it.</p>
          {onResearch && <button type="button" className={styles.link} onClick={() => onResearch('VOO')}>Research VOO <span aria-hidden>→</span></button>}
        </>}
        {stock && onSeeFinancials && !compact && <button type="button" className={styles.link} onClick={onSeeFinancials}>See what this company earns <span aria-hidden>→</span></button>}
      </li>
      {fundLike && <li>
        <h4><span aria-hidden>2</span>What’s inside?</h4>
        <Inside fund={fund} />
      </li>}
      {fundLike && <li>
        <h4><span aria-hidden>3</span>What does it cost?</h4>
        <Cost ratio={fund.expenseRatio} />
      </li>}
    </ol>
    {topics.length > 0 && <KeepLearning topics={topics} symbol={symbol} />}
    {!compact && <p className={styles.source}>
      Data as of {date(fund.asOf)}{fund.stale ? ' (saved copy)' : ''}{fund.summarySource === 'model' ? ' · Summary written by AI' : ''} · Education, not advice
    </p>}
  </div>
}

/**
 * One answer at a time, at most two sentences. Each ends with the next question, so learning flows
 * forward; the last ("ETF or mutual fund?") ends with the advisor instead.
 */
export function KeepLearning({ topics, symbol, initial = null }: { topics: Topic[]; symbol: string; initial?: TopicId | null }) {
  const [openId, setOpenId] = useState<TopicId | null>(initial)
  const row = useRef<HTMLDivElement>(null)
  const [moreRight, setMoreRight] = useState(false)
  // Fade the right edge while chips are offscreen, so phone users can tell the row scrolls.
  useEffect(() => {
    const el = row.current
    if (!el) return
    const update = () => setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(el)
    return () => { el.removeEventListener('scroll', update); observer?.disconnect() }
  }, [])
  const answerId = useId()
  const index = topics.findIndex(topic => topic.id === openId)
  const topic = topics[index]
  const next = topics[index + 1]
  return <div className={styles.learn}>
    {/* One line: the row scrolls inside itself on phones instead of wrapping into a block. */}
    <div ref={row} className={`${styles.chips} ${moreRight ? styles.fade : ''}`} data-more={moreRight || undefined} role="group" aria-label={`Keep learning about ${symbol}`}>
      {topics.map(item => <button key={item.id} type="button" className={styles.chip} aria-expanded={item.id === openId} aria-controls={answerId} onClick={() => setOpenId(current => current === item.id ? null : item.id)}>{item.label}</button>)}
    </div>
    <div id={answerId} className={styles.answerSlot} aria-live="polite">
      {topic && <div className={styles.answer} data-topic={topic.id}>
        <p className={styles.sentence}><ExplainText text={topic.answer} /></p>
        {topic.id === 'compare' && <Comparison />}
        {next ? <button type="button" className={styles.link} onClick={() => setOpenId(next.id)}>Next: {next.label} <span aria-hidden>→</span></button>
          : <Link className={styles.link} to={advisorHref(symbol)}>Ask the advisor about {symbol} <span aria-hidden>→</span></Link>}
      </div>}
    </div>
  </div>
}

/** Step 2, the signature: one bar is $1, sliced by the fund's largest holdings. */
function Inside({ fund }: { fund: Fund }) {
  const { slices, remainder } = dollarStrip(fund.topHoldings)
  if (!slices.length) return <p className={styles.sentence}>Holdings information isn’t available for this fund right now.</p>
  const { top, more } = everyDollar(fund.topHoldings, isPlainIndexFund(fund))
  return <>
    {/* Decorative: the sentence below carries the same information. */}
    <div className={styles.strip} aria-hidden data-dollar-strip>
      {slices.map((slice, index) => <span key={`${slice.symbol ?? slice.name}-${index}`} className={styles.slice} data-rank={Math.min(index, 3)} style={{ flexGrow: slice.share }} />)}
      {remainder > 0 && <span className={styles.rest} style={{ flexGrow: remainder }}>{remainder >= 0.35 && 'Everything else'}</span>}
    </div>
    <p className={styles.sentence}>
      Of every $1: {top.map((holding, index) => <span key={holding.name + index}>{index > 0 && ' · '}<span className={styles.cents}><i aria-hidden data-rank={index} />{holding.cents}</span> {holding.name}</span>)}{more && ` ${more}`}
    </p>
  </>
}

/** Step 3: the yearly fee in dollars, with the term taught in a small inline caption. */
function Cost({ ratio }: { ratio: number | null }) {
  const label = expenseRatioLabel(ratio)
  return <p className={styles.sentence}>{feeSentence(ratio)}{label && <small className={styles.term}> · expense ratio {label}</small>}</p>
}

/**
 * Compare securities: identity, what it is, the strip and the cost, chips collapsed. Loading is a
 * quiet skeleton; an error renders nothing, so the chart and financials stay in charge.
 */
export function CompactFundExplainer({ symbol, state }: { symbol: string; state: FundState }) {
  if (state.status === 'error' || !symbol) return null
  if (state.status === 'pending') return <div className={`${styles.compact} ${styles.padded}`} aria-hidden data-compact-explainer="loading"><Skeleton width="12em" height={14} /><Skeleton height={32} /></div>
  return <section className={styles.compact} aria-label={`What ${symbol} is`} data-compact-explainer={symbol}>
    <div className={styles.compactHead}><IdentityText symbol={symbol} fund={state.fund} /></div>
    <FundLesson key={symbol} fund={state.fund} symbol={symbol} compact />
  </section>
}

/** "What's the real difference?" above the two comparison columns, once both sides have loaded. */
export function RealDifference({ left, right, onCompareCompanies }: { left: FundState; right: FundState; onCompareCompanies: (a: string, b: string) => void }) {
  if (left.status !== 'success' || right.status !== 'success') return null
  const difference = realDifference(left.fund, right.fund)
  if (!difference) return null
  return <section className={styles.difference} aria-label="What’s the real difference?">
    <h3>What’s the real difference?</h3>
    {difference.sentences.map(sentence => <p key={sentence}>{sentence}</p>)}
    {difference.compareCompanies && <button type="button" className={styles.link} onClick={() => onCompareCompanies(left.fund.symbol, right.fund.symbol)}>Open Compare companies <span aria-hidden>→</span></button>}
  </section>
}

/** Static education: generalities only, no fund names or numbers (DESIGN.md §4.13). */
const ROWS: { label: string; cells: [string, string, string] }[] = [
  { label: 'What it is', cells: ['A fund that copies a list of companies (an index). It can be an ETF or a mutual fund.', 'A fund that trades on a stock exchange, like a share of a company.', 'A fund you buy from, and sell back to, the fund company.'] },
  { label: 'How you buy it', cells: ['Either way: as an ETF or as a mutual fund.', 'Through a brokerage app, by the share.', 'Through a brokerage or the fund company, in dollar amounts.'] },
  { label: 'When the price updates', cells: ['All day if it’s an ETF; once a day if it’s a mutual fund.', 'All day, while the market is open.', 'Once a day, after the market closes.'] },
  { label: 'Typical fees', cells: ['Usually low, because nobody picks the investments.', 'Often low, especially index ETFs.', 'Varies. Index mutual funds are usually low; managed ones cost more.'] },
  { label: 'Minimum to start', cells: ['Depends on whether it’s an ETF or a mutual fund.', 'The price of one share, or less with fractional shares.', 'Often a set dollar amount; some have none.'] },
]
const COLUMNS = ['Index fund', 'ETF', 'Mutual fund'] as const

/**
 * Three option columns with each topic as a full-width row-group header, so the three answers keep
 * a third of the width each at 320px instead of sharing it with a label column.
 */
export function Comparison() {
  return <div className={styles.tableWrap} role="region" aria-label="Comparison table" tabIndex={0}>
    <table className={styles.table}>
      <caption className="sr-only">Index funds, ETFs and mutual funds compared</caption>
      <thead><tr>{COLUMNS.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
      {ROWS.map(row => <tbody key={row.label}>
        <tr><th scope="rowgroup" colSpan={3}>{row.label}</th></tr>
        <tr>{row.cells.map((cell, index) => <td key={COLUMNS[index]}>{cell}</td>)}</tr>
      </tbody>)}
    </table>
  </div>
}
