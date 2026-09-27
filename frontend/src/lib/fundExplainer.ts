// Pure rules behind the "What is this?" explainer (DESIGN.md §4.13). `weight` and `expenseRatio`
// arrive as fractions: 0.07 is 7% of the fund, 0.0003 is a 0.03% yearly fee.

import type { Fund, FundHolding, FundKind } from '../api/client'

/** A fund query reduced to what the views need, so they stay pure (and server-renderable in tests). */
export type FundState = { status: 'pending' } | { status: 'error' } | { status: 'success'; fund: Fund }

const KINDS: readonly FundKind[] = ['etf', 'mutual_fund', 'stock', 'other']

/** Unknown kinds from a newer backend read as "other" rather than breaking the line. */
export function normalizeKind(kind: string): FundKind {
  return (KINDS as readonly string[]).includes(kind) ? (kind as FundKind) : 'other'
}

/** "Index fund (ETF)", "Company stock", ... The identity line's plain-language type. */
export function kindLabel(kind: string, isIndexFund: boolean): string {
  switch (normalizeKind(kind)) {
    case 'etf': return isIndexFund ? 'Index fund (ETF)' : 'ETF'
    case 'mutual_fund': return isIndexFund ? 'Index fund (mutual fund)' : 'Mutual fund'
    case 'stock': return 'Company stock'
    default: return 'Investment'
  }
}

/** Funds get the holdings and fee steps; stocks and "other" get the summary only. */
export const isFund = (kind: string) => {
  const k = normalizeKind(kind)
  return k === 'etf' || k === 'mutual_fund'
}

const usable = (weight: number) => Number.isFinite(weight) && weight > 0

/** A weight as cents of every dollar: 0.071 → "7¢", 0.004 → "<1¢". */
export function centsLabel(weight: number): string {
  const cents = Math.round((usable(weight) ? weight : 0) * 100)
  return cents < 1 ? '<1¢' : `${cents}¢`
}

/** "Apple Inc" → "Apple". Share classes stay ("Alphabet Inc Class A") so two classes don't look like duplicates. */
export function shortName(name: string): string {
  const trimmed = name.trim()
  const short = trimmed.replace(/[,\s]+(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|sa|ag|nv)\.?$/i, '')
  return short || trimmed
}

export interface StripSlice extends FundHolding {
  /** Fraction of the $1 strip this slice fills (0–1), after cleaning and scaling. */
  share: number
}

/**
 * The dollar strip: usable holdings largest first, at most 10, plus "everything else". Weights that
 * sum past 1 (provider rounding or bad data) are scaled down so the strip never overflows $1.
 */
export function dollarStrip(holdings: readonly FundHolding[]): { slices: StripSlice[]; remainder: number } {
  const clean = holdings.filter(h => usable(h.weight)).sort((a, b) => b.weight - a.weight).slice(0, 10)
  const total = clean.reduce((sum, h) => sum + h.weight, 0)
  const scale = total > 1 ? 1 / total : 1
  const slices = clean.map(h => ({ ...h, share: h.weight * scale }))
  return { slices, remainder: Math.max(0, 1 - total * scale) }
}

/**
 * "Of every $1: 8¢ NVIDIA · 7¢ Apple · 6¢ Microsoft", then a tail: "+ 501 more" when the holdings
 * count is known, "+ many more" when it isn't but the top three leave money over, otherwise nothing.
 */
export function everyDollar(holdings: readonly FundHolding[], holdingsCount: number | null | undefined, named = 3) {
  const { slices } = dollarStrip(holdings)
  const top = slices.slice(0, named)
  const leftover = 1 - top.reduce((sum, h) => sum + h.share, 0)
  const known = holdingsCount != null && Number.isFinite(holdingsCount)
  const more = known && holdingsCount > top.length ? `+ ${(Math.round(holdingsCount) - top.length).toLocaleString('en-US')} more`
    : !known && top.length > 0 && leftover >= 0.005 ? '+ many more' : null
  return { top: top.map(h => ({ name: shortName(h.name), cents: centsLabel(h.share) })), more }
}

/** The first sentence of the API summary, keeping the explainer to two lines ("U.S. companies" stays whole). */
const ABBREVIATION = /(?:\b[A-Z]\.){1,3}$|\b(?:Inc|Corp|Co|Ltd|St|vs|etc)\.$/
export function firstSentence(text: string): string {
  const trimmed = text.trim()
  for (const end of trimmed.matchAll(/[.!?](?=\s+[A-Z(“"])/g)) {
    const head = trimmed.slice(0, end.index + 1)
    if (!ABBREVIATION.test(head)) return head
  }
  return trimmed
}

const usableRatio = (ratio: number | null | undefined): ratio is number => ratio != null && Number.isFinite(ratio) && ratio >= 0

/** Yearly fee on $10,000: 0.0003 → "$3", 0.00003 → "under $1", null → null. */
export function feePerTenThousand(ratio: number | null | undefined): string | null {
  if (!usableRatio(ratio)) return null
  const dollars = ratio * 10_000
  if (dollars < 0.5) return 'under $1'
  return `$${Math.round(dollars).toLocaleString('en-US')}`
}

export const FEE_UNAVAILABLE = "Fee information isn't available."

/** The step 3 sentence, with the amount capitalized when it leads. */
export function feeSentence(ratio: number | null | undefined): string {
  const fee = feePerTenThousand(ratio)
  if (fee === null) return FEE_UNAVAILABLE
  return fee === 'under $1' ? 'Under $1 a year on every $10,000 invested' : `About ${fee} a year on every $10,000 invested`
}

/** 0.0003 → "0.03%", 0.00003 → "0.003%", 0.0125 → "1.25%". Trailing zeros dropped. */
export function expenseRatioLabel(ratio: number | null | undefined): string | null {
  if (!usableRatio(ratio)) return null
  return `${(ratio * 100).toLocaleString('en-US', { maximumFractionDigits: 3 })}%`
}

/** One sentence that places this fund in the comparison table. */
export function kindSentence(symbol: string, kind: string, isIndexFund: boolean): string {
  const k = normalizeKind(kind)
  if (k === 'etf') return isIndexFund ? `${symbol} is both: an index fund that trades as an ETF.` : `${symbol} is an ETF. Its managers choose what it holds rather than copying an index.`
  if (k === 'mutual_fund') return isIndexFund ? `${symbol} is both: an index fund sold as a mutual fund.` : `${symbol} is a mutual fund. Its managers choose what it holds rather than copying an index.`
  return `${symbol} is not a fund, so the columns below describe other ways to invest.`
}

/** The explainer is open when `explain=1`; every other parameter (symbol, guided, view) is kept. */
export const EXPLAIN_PARAM = 'explain'
export const isExplainOpen = (params: URLSearchParams) => params.get(EXPLAIN_PARAM) === '1'
export function withExplain(params: URLSearchParams, open: boolean): URLSearchParams {
  const next = new URLSearchParams(params)
  if (open) next.set(EXPLAIN_PARAM, '1')
  else next.delete(EXPLAIN_PARAM)
  return next
}

// ---------- "Keep learning" topics ----------

const key = (text: string) => text.toLowerCase().replace(/-cap\b/g, '').replace(/[^a-z]+/g, ' ').trim()

/** Provider fund categories in plain words. Unknown categories are skipped, never shown raw. */
const CATEGORIES: Record<string, string> = {
  'large blend': 'big U.S. companies, a mix of fast-growing and steady ones',
  'large growth': 'big U.S. companies expected to grow fast',
  'large value': 'big, established U.S. companies that look inexpensive',
  'mid blend': 'medium-sized U.S. companies, a mix of fast-growing and steady ones',
  'mid growth': 'medium-sized U.S. companies expected to grow fast',
  'mid value': 'medium-sized, established U.S. companies that look inexpensive',
  'small blend': 'small U.S. companies, a mix of fast-growing and steady ones',
  'small growth': 'small U.S. companies expected to grow fast',
  'small value': 'small, established U.S. companies that look inexpensive',
  'foreign large blend': 'big companies outside the U.S.',
  'intermediate core bond': 'loans to governments and companies (bonds)',
  technology: 'technology companies only',
}

/** "Large Blend" → "big U.S. companies, …"; "Mid-Cap Growth" and "Mid Growth" both match. */
export const plainCategory = (category: string | null | undefined): string | null =>
  category ? CATEGORIES[key(category)] ?? null : null

/** Stock sectors (provider names) as "works in …" phrases. */
const SECTORS: Record<string, string> = {
  technology: 'technology',
  healthcare: 'health care',
  'health care': 'health care',
  'financial services': 'banking and finance',
  financials: 'banking and finance',
  'consumer cyclical': 'shopping, cars and travel',
  'consumer defensive': 'everyday goods like food and soap',
  'communication services': 'phones, internet and media',
  industrials: 'factories, machines and transport',
  energy: 'oil and gas',
  utilities: 'electricity and water',
  'real estate': 'buildings and property',
  'basic materials': 'raw materials like metals and chemicals',
}

export const plainSector = (sector: string | null | undefined): string | null =>
  sector ? SECTORS[key(sector)] ?? null : null

export type TopicId = 'who' | 'where' | 'why' | 'how' | 'compare'
export interface Topic {
  id: TopicId
  /** The chip: a question a beginner would ask. */
  label: string
  /** One short sentence (two at most). */
  answer: string
}

/**
 * The "Keep learning" chips, in the order they flow. A topic appears only when its facts exist:
 * no fund family, no "Who runs it?"; an unknown category or sector, no "Where is the money?".
 */
export function learnTopics(fund: Pick<Fund, 'symbol' | 'kind' | 'isIndexFund' | 'fundFamily' | 'category' | 'sector'>): Topic[] {
  const kind = normalizeKind(fund.kind)
  const topics: Topic[] = []
  const fundLike = kind === 'etf' || kind === 'mutual_fund'
  const index = fundLike && fund.isIndexFund
  const family = fund.fundFamily?.trim()
  if (fundLike && family) {
    topics.push({ id: 'who', label: 'Who runs it?', answer: index
      ? `${family} runs it. For an index fund, they don’t pick stocks; they copy a list (the index).`
      : `${family} runs it. Its managers choose what the fund buys and sells.` })
  }
  const place = fundLike ? plainCategory(fund.category) : kind === 'stock' ? plainSector(fund.sector) : null
  if (place) {
    topics.push(fundLike
      ? { id: 'where', label: 'Where is the money?', answer: `Your money goes into ${place}.` }
      : { id: 'where', label: 'Where is the money?', answer: `All of it is in one company that works in ${place}.` })
  }
  const why = index
    ? 'You own a small slice of hundreds of companies at once, so one bad company can’t sink you, and fees stay low.'
    : fundLike ? 'A manager spreads your money across many investments for you, usually for a higher fee than an index fund.'
      : kind === 'stock' ? 'You’re betting on one business; it can grow a lot or fall a lot.' : null
  if (why) topics.push({ id: 'why', label: 'Why own it?', answer: why })
  const how = kind === 'etf' ? 'Through any brokerage app, like a stock, any time the market is open.'
    : kind === 'mutual_fund' ? 'Usually through the fund company; your order fills once a day after the market closes.'
      : kind === 'stock' ? 'Through any brokerage app, one share (or part of one) at a time, while the market is open.' : null
  if (how) topics.push({ id: 'how', label: 'How do I buy it?', answer: how })
  if (fundLike) topics.push({ id: 'compare', label: 'ETF or mutual fund?', answer: kindSentence(fund.symbol, fund.kind, fund.isIndexFund) })
  return topics
}

// ---------- Compare securities: "What's the real difference?" ----------

/** "hundreds of", "thousands of", or "many" when the count is unknown or small. */
export function basketSize(holdingsCount: number | null | undefined): string {
  if (holdingsCount == null || !Number.isFinite(holdingsCount)) return 'many'
  if (holdingsCount >= 1000) return 'thousands of'
  if (holdingsCount >= 200) return 'hundreds of'
  return 'many'
}

const holdingKey = (h: FundHolding) => h.symbol?.trim().toUpperCase() || key(shortName(h.name))

/** How many of the smaller top-holdings list also appear in the other, matched by symbol or name. */
export function holdingsOverlap(a: readonly FundHolding[], b: readonly FundHolding[]): { shared: number; of: number } {
  const left = new Set(dollarStrip(a).slices.map(holdingKey))
  const right = new Set(dollarStrip(b).slices.map(holdingKey))
  const shared = [...left].filter(k => right.has(k)).length
  return { shared, of: Math.min(left.size, right.size) }
}

const kindWord = (kind: FundKind) => (kind === 'etf' ? 'ETF' : 'mutual fund')
const feeWord = (ratio: number | null | undefined) => {
  const fee = feePerTenThousand(ratio)
  return fee === null ? null : fee === 'under $1' ? fee : `about ${fee}`
}

/** A holding in the fund that is this stock, by symbol, or by name when the fund omits symbols. */
function findStock(fund: Fund, stock: Fund): StripSlice | null {
  const symbol = stock.symbol.toUpperCase()
  const name = key(shortName(stock.name))
  return dollarStrip(fund.topHoldings).slices.find(h => h.symbol ? h.symbol.toUpperCase() === symbol : key(shortName(h.name)) === name) ?? null
}

/**
 * Two or three plain sentences comparing the two sides of Compare securities, built only from API
 * facts. `compareCompanies` asks the view to link to Compare companies. Null when there is nothing
 * honest to say (same symbol, or an "other" kind).
 */
export function realDifference(a: Fund, b: Fund): { sentences: string[]; compareCompanies: boolean } | null {
  if (a.symbol.toUpperCase() === b.symbol.toUpperCase()) return null
  const ka = normalizeKind(a.kind), kb = normalizeKind(b.kind)
  const fa = ka === 'etf' || ka === 'mutual_fund', fb = kb === 'etf' || kb === 'mutual_fund'
  if (fa && fb) {
    const sentences: string[] = []
    const { shared, of } = holdingsOverlap(a.topHoldings, b.topHoldings)
    const sameIndex = !!a.tracks && !!b.tracks && key(a.tracks) === key(b.tracks)
    if (of > 0 && shared >= Math.ceil(of * 0.8)) sentences.push(`${a.symbol} and ${b.symbol} hold the same top companies${sameIndex ? ': they follow the same index' : ''}.`)
    else if (of > 0 && shared > 0) sentences.push(`${a.symbol} and ${b.symbol} share ${shared} of their top ${of} companies.`)
    else if (of > 0) sentences.push(`${a.symbol} and ${b.symbol} own different top companies.`)
    else if (sameIndex) sentences.push(`${a.symbol} and ${b.symbol} follow the same index.`)
    const buy = ka !== kb ? `how you buy them (${kindWord(ka)} vs ${kindWord(kb)})` : null
    const feeA = feeWord(a.expenseRatio), feeB = feeWord(b.expenseRatio)
    const fee = feeA && feeB ? (feeA === feeB ? null : `the fee: ${feeA} vs ${feeB} a year on $10,000`) : null
    if (buy && fee) sentences.push(`The differences are ${buy} and ${fee}.`)
    else if (buy) sentences.push(`The main difference is ${buy}.`)
    else if (fee) sentences.push(`The main difference is ${fee}.`)
    else if (feeA && feeA === feeB) sentences.push(`They cost the same: ${feeA} a year on $10,000.`)
    return sentences.length ? { sentences, compareCompanies: false } : null
  }
  if ((fa && kb === 'stock') || (fb && ka === 'stock')) {
    const [fund, stock] = fa ? [a, b] : [b, a]
    const held = findStock(fund, stock)
    const basket = `${fund.symbol} is a basket of ${basketSize(fund.holdingsCount)} companies`
    return { compareCompanies: false, sentences: [held
      ? `${basket}; ${stock.symbol} is one of them (${centsLabel(held.share) === '<1¢' ? 'less than 1¢' : `about ${centsLabel(held.share)}`} of every $1 in ${fund.symbol}).`
      : `${basket}; ${stock.symbol} is a single company.`] }
  }
  if (ka === 'stock' && kb === 'stock') {
    return { compareCompanies: true, sentences: [`${a.symbol} and ${b.symbol} are both single companies; compare their sales, profit and prices side by side.`] }
  }
  return null
}

/** Prefilled, never auto-submitted (DESIGN.md §6.2). */
export const advisorHref = (symbol: string) =>
  `/advisor?q=${encodeURIComponent(`What is ${symbol}, and what should a beginner know about owning it?`)}`
