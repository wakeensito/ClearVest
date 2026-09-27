// Portfolio look-through + fund fees (DESIGN.md — "What you really own" card and the ticker
// what-if). Pure math only: no React, no fetching. `weight` fields arrive as fractions (0..1);
// the UI formats percents at the edge (frontend/src/lib/format.ts).

import type { Fund, Holding } from '../api/client'
import { normalizeType } from './assetTypes'
import { shortName } from './fundExplainer'

export type FundMap = Record<string, Fund | undefined>

export interface Via {
  fund: string
  share: number
}

export interface Exposure {
  symbol: string | null
  name: string
  share: number
  direct: number
  via: Via[]
}

export interface LookThrough {
  companies: Exposure[]
  topShare(n: number): number
  coverage: number
  fundsTotal: number
  fundsLookedThrough: number
  hasData: boolean
}

export interface FeeRow {
  symbol: string
  name: string
  ratio: number
  dollars: number
}

export interface FundFees {
  rows: FeeRow[]
  unknown: string[]
  fundValue: number
  perYear: number
  blendedRatio: number | null
  cheapestRatio: number | null
  ifAllCheapest: number | null
  tenYear: number
}

const NAME_PREFIX = 'name:'

/** "Apple Inc" and "Apple Inc." both fold to the same key. */
function nameNormalize(name: string): string {
  return shortName(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Company identity: uppercase symbol when present, else a normalized name key. */
export function companyKey(symbol: string | null | undefined, name: string): string {
  const sym = symbol?.trim().toUpperCase()
  return sym ? sym : `${NAME_PREFIX}${nameNormalize(name)}`
}

/** Only long positions count anywhere in this module; shorts are skipped. */
const isLong = (h: Holding) => h.value > 0 && h.weight > 0
const isUsableWeight = (weight: number) => Number.isFinite(weight) && weight > 0

interface Acc {
  key: string
  directName: string | null
  fallbackName: string | null
  direct: number
  via: Map<string, number>
}

export function lookThrough(holdings: readonly Holding[], funds: FundMap): LookThrough {
  const accs = new Map<string, Acc>()
  // Maps a normalized company name to the canonical key already in use for it, so a symbol-less
  // fund row ("Apple Inc", symbol: null) can find and merge into the direct AAPL row.
  const nameIndex = new Map<string, string>()

  const getOrCreate = (key: string): Acc => {
    let acc = accs.get(key)
    if (!acc) {
      acc = { key, directName: null, fallbackName: null, direct: 0, via: new Map() }
      accs.set(key, acc)
    }
    return acc
  }

  const resolveBySymbol = (symbol: string, name: string): Acc => {
    const key = symbol.trim().toUpperCase()
    const acc = getOrCreate(key)
    const nk = nameNormalize(name)
    if (!nameIndex.has(nk)) nameIndex.set(nk, key)
    return acc
  }

  const resolveByRow = (symbol: string | null, name: string): Acc => {
    if (symbol) return resolveBySymbol(symbol, name)
    const nk = nameNormalize(name)
    const key = nameIndex.get(nk) ?? companyKey(null, name)
    const acc = getOrCreate(key)
    if (!nameIndex.has(nk)) nameIndex.set(nk, key)
    return acc
  }

  // Pass 1: direct exposure (equity + cryptocurrency, each its own "company" row).
  for (const h of holdings) {
    if (!isLong(h)) continue
    const type = normalizeType(h.type)
    if (type !== 'equity' && type !== 'cryptocurrency') continue
    const acc = resolveBySymbol(h.symbol, h.name)
    acc.direct += h.weight
    if (acc.directName === null) acc.directName = shortName(h.name)
  }

  // Pass 2: look through etf / mutual fund holdings.
  let fundsTotal = 0
  let fundsLookedThrough = 0
  let coverageNumerator = 0
  let coverageDenominator = 0

  for (const h of holdings) {
    if (!isLong(h)) continue
    const type = normalizeType(h.type)
    if (type !== 'etf' && type !== 'mutual fund') continue
    fundsTotal += 1
    coverageDenominator += h.weight

    const fund = funds[h.symbol.trim().toUpperCase()]
    if (!fund || fund.topHoldings.length === 0) continue
    fundsLookedThrough += 1

    let fundWeightSum = 0
    for (const row of fund.topHoldings) {
      if (!isUsableWeight(row.weight)) continue
      fundWeightSum += row.weight
      const rowShare = h.weight * row.weight
      const acc = resolveByRow(row.symbol, row.name)
      if (acc.fallbackName === null) acc.fallbackName = shortName(row.name)
      acc.via.set(h.symbol, (acc.via.get(h.symbol) ?? 0) + rowShare)
    }
    coverageNumerator += h.weight * fundWeightSum
  }

  const companies: Exposure[] = [...accs.values()]
    .map((acc): Exposure => {
      const via = [...acc.via.entries()]
        .map(([fund, share]) => ({ fund, share }))
        .sort((a, b) => b.share - a.share)
      const share = acc.direct + via.reduce((sum, v) => sum + v.share, 0)
      return {
        symbol: acc.key.startsWith(NAME_PREFIX) ? null : acc.key,
        name: acc.directName ?? acc.fallbackName ?? '',
        share,
        direct: acc.direct,
        via,
      }
    })
    .filter(e => e.share > 0)
    .sort((a, b) => b.share - a.share)
    .slice(0, 10)

  const coverage = coverageDenominator > 0 ? coverageNumerator / coverageDenominator : 0
  const hasDirectEquity = holdings.some(h => isLong(h) && normalizeType(h.type) === 'equity')
  const hasData = hasDirectEquity || fundsLookedThrough > 0

  return {
    companies,
    topShare: (n: number) => companies.slice(0, n).reduce((sum, c) => sum + c.share, 0),
    coverage,
    fundsTotal,
    fundsLookedThrough,
    hasData,
  }
}

export function fundFees(holdings: readonly Holding[], funds: FundMap): FundFees {
  const rows: FeeRow[] = []
  const unknown: string[] = []
  let fundValue = 0
  let perYear = 0

  for (const h of holdings) {
    if (!isLong(h)) continue
    const type = normalizeType(h.type)
    if (type !== 'etf' && type !== 'mutual fund') continue

    const fund = funds[h.symbol.trim().toUpperCase()]
    const ratio = fund?.expenseRatio
    if (ratio == null) {
      unknown.push(h.symbol)
      continue
    }
    const dollars = h.value * ratio
    rows.push({ symbol: h.symbol, name: shortName(h.name), ratio, dollars })
    fundValue += h.value
    perYear += dollars
  }

  rows.sort((a, b) => b.dollars - a.dollars)

  const blendedRatio = fundValue > 0 ? perYear / fundValue : null
  const cheapestRatio = rows.length > 0 ? Math.min(...rows.map(r => r.ratio)) : null
  const ifAllCheapest = cheapestRatio != null ? fundValue * cheapestRatio : null
  const tenYear = perYear * 10

  return { rows, unknown, fundValue, perYear, blendedRatio, cheapestRatio, ifAllCheapest, tenYear }
}
