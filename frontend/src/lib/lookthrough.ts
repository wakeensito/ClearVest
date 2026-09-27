// What the user really owns once each fund is opened up: the fund's published top-ten weights times
// the dollars held in it, summed with the same companies held directly. Top ten only, so every
// number here is a floor and the copy says "at least". Pure; no React, no fetch.
import type { Fund } from '../api/client'
import { PLAY_LESSON } from './lessons'

export interface FundHoldingWeight { symbol: string; name: string; weight: number }
export interface FundSnapshot {
  symbol: string
  name: string
  /** ISO date the weights were published or pulled. */
  asOf: string
  holdings: readonly FundHoldingWeight[]
}
/** Fund symbol -> what's inside it. */
export type FundData = Readonly<Record<string, FundSnapshot>>

export interface PortfolioHolding { symbol: string; name: string; type: string; value: number }

export interface Exposure {
  /** The company's main ticker; other share classes (GOOG into GOOGL) are folded in. */
  symbol: string
  name: string
  /** Dollars of the company held as its own shares. */
  direct: number
  /** Dollars of the company that sit inside each fund, biggest first. */
  viaFunds: readonly { fund: string; dollars: number }[]
  total: number
  /** `total` over the whole portfolio, including holdings we could not open up. */
  share: number
}

export interface Lookthrough {
  /** Every holding's dollars, opened up or not, so `share` never overstates. */
  total: number
  /** Biggest exposure first. */
  companies: readonly Exposure[]
  /** Fund symbols that were opened up (had weights). */
  funds: readonly string[]
  /** Oldest `asOf` among the funds counted; null when none were. */
  asOf: string | null
}

/** Plaid security types that hold other companies. Anything else is a company or is skipped. */
const FUND_TYPES: ReadonlySet<string> = new Set(['etf', 'mutual fund'])
const STOCK_TYPES: ReadonlySet<string> = new Set(['equity'])
/** Two rows fit a phone; below this share the biggest company is not worth a headline. */
export const CONCENTRATION_FLOOR = 0.1
export const MAX_FUNDS = 5
const SUFFIX_RE = /[\s,]+(inc|incorporated|corp|corporation|co|company|ltd|plc|holdings?)\.?$/i
const CLASS_RE = /\s*\(?class [a-c]( shares?)?\)?$/i
/** Share classes of one company roll up into the first-listed ticker, so concentration is per company. */
const SHARE_CLASSES: Readonly<Record<string, string>> = { GOOG: 'GOOGL', 'BRK-B': 'BRK-A', 'BRK.B': 'BRK.A', FOX: 'FOXA', NWS: 'NWSA' }

/**
 * Bundled fallback for the funds in the sample account. VOO's weights are the lesson's own, so they
 * never disagree with the strip. QQQ and VGT were pulled the same way, 2026-09-26, rounded to one
 * decimal: yfinance `Ticker(s).funds_data.top_holdings`.
 */
export const FUND_SNAPSHOTS: FundData = {
  ...(PLAY_LESSON?.play ? { [PLAY_LESSON.play.fund]: { symbol: PLAY_LESSON.play.fund, name: PLAY_LESSON.play.fundName, asOf: PLAY_LESSON.play.asOf, holdings: PLAY_LESSON.play.holdings } } : {}),
  QQQ: {
    symbol: 'QQQ', name: 'Invesco QQQ Trust', asOf: '2026-09-26',
    holdings: [
      { symbol: 'NVDA', name: 'NVIDIA', weight: 0.085 },
      { symbol: 'AAPL', name: 'Apple', weight: 0.074 },
      { symbol: 'MSFT', name: 'Microsoft', weight: 0.06 },
      { symbol: 'MU', name: 'Micron Technology', weight: 0.048 },
      { symbol: 'AMZN', name: 'Amazon', weight: 0.044 },
      { symbol: 'AMD', name: 'Advanced Micro Devices', weight: 0.034 },
      { symbol: 'GOOGL', name: 'Alphabet (Class A)', weight: 0.031 },
      { symbol: 'TSLA', name: 'Tesla', weight: 0.029 },
      { symbol: 'GOOG', name: 'Alphabet (Class C)', weight: 0.029 },
      { symbol: 'AVGO', name: 'Broadcom', weight: 0.028 },
    ],
  },
  VGT: {
    symbol: 'VGT', name: 'Vanguard Information Technology ETF', asOf: '2026-09-26',
    holdings: [
      { symbol: 'NVDA', name: 'NVIDIA', weight: 0.177 },
      { symbol: 'AAPL', name: 'Apple', weight: 0.158 },
      { symbol: 'MSFT', name: 'Microsoft', weight: 0.115 },
      { symbol: 'AVGO', name: 'Broadcom', weight: 0.045 },
      { symbol: 'MU', name: 'Micron Technology', weight: 0.042 },
      { symbol: 'AMD', name: 'Advanced Micro Devices', weight: 0.03 },
      { symbol: 'CSCO', name: 'Cisco', weight: 0.017 },
      { symbol: 'PLTR', name: 'Palantir', weight: 0.016 },
      { symbol: 'INTC', name: 'Intel', weight: 0.015 },
      { symbol: 'LRCX', name: 'Lam Research', weight: 0.015 },
    ],
  },
}

const dollars = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

/** "Apple Inc." and "Apple" are one company; keep the shorter, suffix-free spelling. */
function shortName(name: string): string {
  const trimmed = name.trim().replace(CLASS_RE, '').replace(SUFFIX_RE, '')
  return trimmed || name.trim()
}

const company = (symbol: string) => SHARE_CLASSES[symbol] ?? symbol

/**
 * Which funds to look inside, biggest position first, capped so an odd portfolio cannot fan out into
 * a call per row. A symbol counts as a fund when Plaid says so or when a snapshot exists for it.
 */
export function heldFunds(holdings: readonly PortfolioHolding[] | undefined, cap = MAX_FUNDS): string[] {
  const byFund = new Map<string, number>()
  for (const h of holdings ?? []) {
    if (!FUND_TYPES.has(h.type) && !(h.symbol in FUND_SNAPSHOTS)) continue
    byFund.set(h.symbol, (byFund.get(h.symbol) ?? 0) + dollars(h.value))
  }
  return [...byFund].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, cap).map(([symbol]) => symbol)
}

/** The live route's answer, when it is a fund with weights. Null for stocks, indexes, empty data. */
export function fromLiveFund(fund: Fund | undefined): FundSnapshot | null {
  if (!fund || (fund.kind !== 'etf' && fund.kind !== 'mutual_fund')) return null
  const holdings = fund.topHoldings.flatMap((h) => (h.symbol && Number.isFinite(h.weight) && h.weight > 0 ? [{ symbol: h.symbol, name: h.name, weight: h.weight }] : []))
  return holdings.length ? { symbol: fund.symbol, name: fund.name, asOf: fund.asOf, holdings } : null
}

/**
 * Open up every fund in `funds` and add the same companies held directly. Funds without an entry in
 * `funds`, bonds, cash and unknown types still count toward `total` but add no company rows: the
 * result is a floor, never an overstatement.
 */
export function lookthrough(holdings: readonly PortfolioHolding[], funds: FundData): Lookthrough {
  const rows = new Map<string, { name: string; direct: number; via: Map<string, number> }>()
  const row = (symbol: string, name: string) => {
    const existing = rows.get(symbol)
    if (existing) {
      const short = shortName(name)
      if (short.length < existing.name.length) existing.name = short
      return existing
    }
    const created = { name: shortName(name), direct: 0, via: new Map<string, number>() }
    rows.set(symbol, created)
    return created
  }
  let total = 0
  const used = new Map<string, string>()
  for (const h of holdings) {
    const value = dollars(h.value)
    total += value
    if (value === 0) continue
    const fund = funds[h.symbol]
    if (fund) {
      used.set(h.symbol, fund.asOf)
      for (const inside of fund.holdings) {
        const r = row(company(inside.symbol), inside.name)
        r.via.set(fund.symbol, (r.via.get(fund.symbol) ?? 0) + value * inside.weight)
      }
    } else if (STOCK_TYPES.has(h.type)) {
      row(company(h.symbol), h.name).direct += value
    }
  }
  const companies = [...rows].map(([symbol, r]) => {
    const viaFunds = [...r.via].map(([fund, d]) => ({ fund, dollars: d })).sort((a, b) => b.dollars - a.dollars)
    const sum = r.direct + viaFunds.reduce((acc, v) => acc + v.dollars, 0)
    return { symbol, name: r.name, direct: r.direct, viaFunds, total: sum, share: total > 0 ? sum / total : 0 }
  }).sort((a, b) => b.total - a.total)
  const dates = [...used.values()].sort()
  return { total, companies, funds: [...used.keys()], asOf: dates[0] ?? null }
}

/** The rows worth a headline: the top two, only when the biggest clears the floor. */
export function spotlight(result: Lookthrough): Exposure[] {
  const [first] = result.companies
  if (!first || first.share <= CONCENTRATION_FLOOR) return []
  return result.companies.slice(0, 2).filter((c) => c.total > 0)
}

/** Whole percent, rounded down so "at least" stays true. */
export function floorShare(companies: readonly Exposure[]): number {
  return Math.floor(companies.reduce((acc, c) => acc + c.share, 0) * 100) / 100
}
