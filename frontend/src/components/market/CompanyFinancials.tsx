import { ExplainThis } from '../../features/advisor/ExplainThis'
import { ScoutTarget } from '../../features/advisor/ScoutTarget'
import { useScoutContext } from '../../features/advisor/scoutContext'
import { useId, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import type { AnnualIncome, CompanyResearch } from '../../api/client'
import { useCompanyResearch } from '../../api/queries'
import { dividendSentence, dividendYieldLabel, financialAmount, historicalPE, marketCapSentence, peVersusUsual, revenueChange, usablePE } from '../../lib/researchEducation'
import { date, MISSING, multiple, percentFromFraction, timestamp } from '../../lib/format'
import { QuickCheck } from '../education/QuickCheck'
import { QueryView } from '../QueryView'
import { CompanyLogo } from './CompanyLogo'
import styles from './CompanyFinancials.module.css'

const steps = ['The business', 'Sales & profit', 'Price & value', 'Payouts']
const headings = ['What does this business do?', 'Is the business earning money?', 'What price are investors paying?', 'Does it pay you to wait?']
const last = steps.length - 1
/** `initialStep` opens a later step directly (deep links, render tests). */
export function CompanyFinancials({ symbol, initialStep = 0 }: { symbol: string; initialStep?: number }) {
  const query = useCompanyResearch(symbol)
  return <section className={styles.panel} aria-label={`${symbol} company financials`} data-company-financials={symbol} tabIndex={-1}>
    <QueryView query={query} label={`Loading ${symbol} company financials`} noun={`${symbol} company financials`}>
      {data => <FinancialStory key={symbol} data={data} initialStep={initialStep} retry={() => void query.refetch()} retrying={query.isFetching} />}
    </QueryView>
  </section>
}

function FinancialStory({ data, initialStep, retry, retrying }: { data: CompanyResearch; initialStep: number; retry: () => void; retrying: boolean }) {
  const context = useScoutContext()
  const linkedStep = context.symbol === data.symbol ? context.metric === 'valuation' ? 2 : context.metric === 'revenue' || context.metric === 'profit' ? 1 : undefined : undefined
  const [step, setStep] = useState(linkedStep ?? Math.min(Math.max(0, Math.trunc(initialStep) || 0), last))
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const { profile, income, valuation } = data
  const description = profile?.description
  const excerpt = description && description.length > 320 ? `${description.slice(0, 320).replace(/\s+\S*$/, '')}…` : description
  const latest = income[0]
  const change = revenueChange(income)
  const pe = usablePE(valuation?.pe, valuation?.eps)
  const history = historicalPE(data.history)
  const comparison = history && peVersusUsual(pe, history.median, history.count)
  const worth = profile && !profile.isFund ? marketCapSentence(profile.marketCap, profile.currency) : null
  const dividendYield = valuation?.dividendYield
  const earnings = profile && !profile.isFund && profile.nextEarningsDate ? date(profile.nextEarningsDate) : null
  const next = () => { setStep(value => value + 1); requestAnimationFrame(() => heading.current?.focus()) }
  return <>
    <header className={styles.header}><CompanyLogo symbol={data.symbol} /><div><h2>Understand {profile?.name ?? data.symbol}</h2><p>{data.symbol}{profile?.sector ? ` · ${profile.sector}` : ''} · A guided look at the business</p>{worth && <p data-market-cap>{worth}</p>}{earnings && earnings !== MISSING && <p className={styles.earnings} data-next-earnings>Next earnings report (when it shares its results): {earnings}</p>}</div></header>
    <nav className={styles.steps} aria-label="Company research steps">{steps.map((label, index) => <button key={label} onClick={() => setStep(index)} aria-pressed={step === index}><span>{index + 1}</span>{label}</button>)}</nav>
    {data.unavailable.length > 0 && <p className={styles.notice} role="status">Some company information could not load. You can explore the available figures. <button onClick={retry} disabled={retrying}>{retrying ? 'Retrying…' : 'Retry missing data'}</button></p>}
    {data.sources.some(source => source.stale) && <p className={styles.notice}>Showing some previously saved figures while the provider is unavailable. Check the dates below.</p>}
    <ScoutTarget name="company" selected={context.symbol === data.symbol}><div className={styles.story}>
      <h3 ref={heading} tabIndex={-1}>{headings[step]}</h3>
      {profile?.isFund ? <div className={styles.fund}><p><strong>{profile.name} is a fund.</strong> A fund holds a collection of investments. It does not have company sales or earnings in the same way as a single business.</p><p>Start with what it owns, its fees and how widely it spreads its investments. A fund’s P/E can describe its holdings, so it should not be read as one company’s earnings.</p><Link to="/learn/funds">Explore funds in Learn</Link><p>To practice reading company statements, search for a company such as Apple (AAPL) or Microsoft (MSFT).</p></div> : <>
        {step === 0 && <>
          <p className={styles.lede}>Before looking at a share price, find out how the company earns its money.</p>
          {profile?.description ? <div className={styles.about}><p>{excerpt}</p>{profile.industry && <p className={styles.small}>Industry: {profile.industry}</p>}{excerpt !== description && <details><summary>Read the full company description</summary><p>{description}</p></details>}</div> : <p className={styles.empty}>A company description is not available for {data.symbol}. You can still check its figures in the next step.</p>}
          <div className={styles.prompt}><strong>Ask yourself</strong><p>What does it sell, and who pays for it? Knowing a brand is a starting point; it does not tell you whether its shares are a good investment.</p></div>
        </>}
        {step === 1 && <>
          <p className={styles.lede}>Sales tell you how much business came in. Profit tells you what was left after expenses. Both help tell the story.</p>
          {latest ? <>
            <p className={styles.period}>Financial year {latest.year} · Ended {date(latest.date)} · {latest.currency ?? 'Reporting currency unavailable'}</p>
            <dl className={styles.figures}>
              <div><dt>Revenue <span>Sales before expenses</span></dt><dd>{financialAmount(latest.revenue, latest.currency, true)}</dd><dd className={styles.explanation}>{change === null ? 'A comparable prior year is not available.' : `${percentFromFraction(change, { signed: true })} compared with the previous financial year.`}</dd></div>
              <div><dt>Net income <span>Profit or loss after expenses</span></dt><dd>{financialAmount(latest.netIncome, latest.currency, true)}</dd><dd className={styles.explanation}>{latest.netIncome == null ? 'The provider did not supply this figure.' : latest.netIncome < 0 ? 'A negative number means the company reported a loss.' : 'This is accounting profit, not the cash in its bank account.'}</dd></div>
              <div><dt>Diluted EPS <span>Profit per share</span></dt><dd>{financialAmount(latest.epsDiluted, latest.currency)}</dd><dd className={styles.explanation}>Includes potential extra shares. This is not a payment promised to shareholders.</dd></div>
            </dl>
            <IncomeChart rows={income} />
            <details className={styles.details}><summary>Open the income statement</summary><p className={styles.small}>A financial year may end in a different month from the calendar year. Figures below are full amounts in each column’s currency; EPS is per share. Missing figures are not zero. Scroll sideways for earlier years.</p><div className={styles.tableWrap} tabIndex={0} role="region" aria-label={`${data.symbol} income statement, scroll for earlier years`}><table><caption>{data.symbol} annual income statements</caption><thead><tr><th scope="col">What to look at</th>{income.map(row => <th key={row.year} scope="col">{row.year}<small>{row.currency ?? 'Currency unknown'}<br />{date(row.date)}</small></th>)}</tr></thead><tbody>{statementRows.map(metric => <tr key={metric.key}><th scope="row">{metric.label}<small>{metric.meaning}</small></th>{income.map(row => <td key={row.year}>{financialAmount(row[metric.key], row.currency)}</td>)}</tr>)}</tbody></table></div></details>
          </> : <p className={styles.empty}>Annual income statements are not available for {data.symbol}. Some securities are funds or have limited data coverage. Try another company; missing figures do not mean zero sales or profit.</p>}
          <QuickCheck milestone="profit" question="A made-up shop sells $100 and has $80 in total expenses. What is its profit?" answers={[{ text: '$20', correct: true, explanation: '$100 in sales minus $80 in expenses leaves $20 in profit. Revenue and profit tell different stories.' }, { text: '$100', correct: false, explanation: '$100 is revenue. Subtract the $80 in expenses to find profit. Try again.' }]} />
        </>}
        {step === 2 && <>
          <p className={styles.lede}>A good business can still have an expensive share price. P/E connects the price of one share to the earnings behind it.</p>
          <div className={styles.valuation}><div><span>Price / earnings (P/E)</span><strong>{pe === null ? 'Not meaningful or unavailable' : multiple(pe)}</strong><span>Provider ratio · Trailing 12 months</span></div><p>{pe === null ? 'P/E is not useful when earnings are zero or negative. We also leave it blank when the provider has no usable figure.' : `At ${multiple(pe)}, investors pay about ${pe.toLocaleString('en-US', { maximumFractionDigits: 1 })} units of share price for each unit of annual earnings per share. This is not a promised return or payback period.`}</p></div>
          <details className={styles.details}><summary>How is P/E calculated?</summary><p>Share price ÷ earnings per share = P/E. For example, a $60 share with $3 in annual earnings per share has a P/E of 20. These are made-up numbers.</p><p>“Trailing 12 months” means the most recent year of reported earnings. A forecast P/E uses estimates instead, so the two may differ.</p></details>
          <div className={styles.prompt}><strong>What is a typical P/E?</strong><p>There is no single right number. Compare similar businesses, their growth, risks and their own history. A lower P/E can reflect concerns about the company, rather than a bargain.</p>{history ? <p><strong>{multiple(history.median)}</strong> is the middle value of {history.count} available positive annual P/E observations for {data.symbol}. This is the company’s historical context, not an industry average or a target price. Annual observations and today’s trailing ratio use different dates.</p> : <p>We need at least three positive annual observations to show a historical middle value. There is not enough available data here.</p>}{comparison && <p data-pe-comparison>{comparison}</p>}</div>
          {data.history.length > 0 && <details className={styles.details}><summary>See the historical P/E observations</summary><ul className={styles.history}>{data.history.map(row => <li key={row.year}><span>Financial year {row.year} · {date(row.date)}</span><strong>{usablePE(row.pe) === null ? 'Not meaningful / unavailable' : multiple(row.pe)}</strong></li>)}</ul><p className={styles.small}>Zero, negative and missing ratios are excluded from the historical middle value.</p></details>}
          <QuickCheck milestone="pe" question="Does a lower P/E always mean a better investment?" answers={[{ text: 'No, I need more context', correct: true, explanation: 'Growth, risks, debt and the type of business matter too. One ratio cannot give the whole answer.' }, { text: 'Yes, lower is always better', correct: false, explanation: 'A low P/E might reflect a business facing problems. Compare similar companies and ask why the ratio differs. Try again.' }]} />
          <Link to={`/markets?view=companies&symbol=${encodeURIComponent(data.symbol)}`}>Compare company ratios side by side</Link>
        </>}
        {step === 3 && <>
          <p className={styles.lede}>Some companies share part of their profit with shareholders as cash. This payment is called a dividend.</p>
          {dividendYield != null ? <div className={styles.valuation} data-dividend><div><span>Dividend yield</span><strong>{dividendYieldLabel(dividendYield)}</strong><span>Provider ratio · Trailing 12 months</span></div><p>{dividendSentence(dividendYield)}</p></div> : <p className={styles.empty} data-dividend>{dividendSentence(null)}</p>}
          <div className={styles.prompt}><strong>Ask yourself</strong><p>A dividend is not promised. Companies can raise, cut or stop it. A yield can also look high because the share price fell, so check why before counting on the cash.</p></div>
        </>}
        {step < last && <button className={styles.next} onClick={next}>Next: {steps[step + 1]}</button>}
      </>}
      <ExplainThis label={step === 0 ? 'Explain this business' : step === 1 ? 'Explain these figures' : step === 2 ? 'Explain this ratio' : 'Explain these payouts'} context={{ page: context.page, symbol: data.symbol, metric: step === 0 ? 'business' : step === 1 ? 'revenue' : 'valuation' }} question={`Explain ${data.symbol} ${step === 0 ? 'business' : step === 1 ? 'latest reported revenue and net profit' : step === 2 ? 'price-to-earnings ratio' : 'reported dividend yield'} in plain language using its available source facts. State any missing figures.`} />
    </div></ScoutTarget>
    <details className={styles.sources}><summary>Sources & dates</summary><p>Financial data from FMP. These are reported figures, not forecasts. Retrieved dates below are not the dates a company reported its results.</p><ul>{data.sources.map(source => <li key={source.section}>{({ profile: 'Company description', income: 'Income statements', valuation: 'Current ratios', history: 'Historical ratios' })[source.section]}: {timestamp(source.fetchedAt)}{source.stale ? ' · Saved data (provider unavailable)' : ''}</li>)}</ul><p>Learn more: <a href="https://www.sec.gov/about/reports-publications/investorpubsbegfinstmtguide" target="_blank" rel="noreferrer">SEC guide to financial statements</a> and <a href="https://www.finra.org/investors/investing/investment-products/stocks/evaluating-stocks" target="_blank" rel="noreferrer">FINRA guide to evaluating stocks</a>.</p></details>
    <p id={id} className={styles.small}>Start with one question. You do not need to understand every number today.</p>
  </>
}

const statementRows: { key: 'revenue' | 'costOfRevenue' | 'grossProfit' | 'operatingIncome' | 'netIncome' | 'epsDiluted'; label: string; meaning: string }[] = [
  { key: 'revenue', label: 'Revenue', meaning: 'Sales before expenses' },
  { key: 'costOfRevenue', label: 'Cost of revenue', meaning: 'Direct costs of goods or services sold' },
  { key: 'grossProfit', label: 'Gross profit', meaning: 'Revenue minus those direct costs' },
  { key: 'operatingIncome', label: 'Operating income', meaning: 'Profit from business operations' },
  { key: 'netIncome', label: 'Net income', meaning: 'Profit or loss after expenses' },
  { key: 'epsDiluted', label: 'Diluted EPS', meaning: 'Earnings for each share, including potential extra shares' },
]

function IncomeChart({ rows }: { rows: AnnualIncome[] }) {
  const currency = rows[0]?.currency
  const usable = rows.filter(row => currency && row.currency === currency).slice().reverse()
  if (usable.length < 2) return null
  const values = usable.flatMap(row => [row.revenue, row.netIncome]).filter((value): value is number => value != null && Number.isFinite(value))
  if (!values.length) return null
  const max = Math.max(...values.map(Math.abs), 1)
  const signed = values.some(value => value < 0)
  return <figure className={styles.chart}><figcaption>Look at the trend <span>Revenue (blue) and net income (teal), {currency}. Same scale; bars start at zero.</span></figcaption><div className={styles.columns}>{usable.map(row => <div className={styles.year} key={row.year}><div className={styles.bars} style={{ '--zero': signed ? '50%' : '0%' } as CSSProperties}>{(['revenue', 'netIncome'] as const).map(key => { const value = row[key]; const height = value == null ? 0 : Math.abs(value) / max * (signed ? 50 : 100); return <div className={styles.track} key={key}><span aria-hidden data-type={key} style={{ height: `${height}%`, bottom: `${(signed ? 50 : 0) - (value != null && value < 0 ? height : 0)}%` }} /><span className="sr-only">{key === 'revenue' ? 'Revenue' : 'Net income'} {financialAmount(value, currency)}.</span></div> })}</div><strong>{row.year}</strong><small>{financialAmount(row.revenue, currency, true)}<br />{financialAmount(row.netIncome, currency, true)}</small></div>)}</div><p className={styles.small}>B means billion, M means million, K means thousand. {usable.length < rows.length && 'Years in other or unknown currencies are excluded from this chart.'} Past results do not promise future growth.</p></figure>
}
