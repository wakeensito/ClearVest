// Fund facts for every ETF / mutual fund in the account, for the look-through and plan cards
// (DESIGN.md §4.14). Same query key, fetcher and day-long cache as `useFund`, so the research
// explainer and these cards share one request per fund.

import { useQueries } from '@tanstack/react-query'
import { api, type Holding } from '../api/client'
import { normalizeType } from './assetTypes'
import type { FundMap } from './lookThrough'

/** A demo account has a handful of funds; cap the fan-out so a big account can't burst the API. */
export const FUND_CAP = 8
const DAY = 24 * 60 * 60_000

/** Distinct uppercase fund symbols, largest position first. */
export function fundSymbols(holdings: readonly Holding[] | undefined): string[] {
  const values = new Map<string, number>()
  for (const h of holdings ?? []) {
    if (!(h.value > 0)) continue
    const type = normalizeType(h.type)
    if (type !== 'etf' && type !== 'mutual fund') continue
    const symbol = h.symbol.trim().toUpperCase()
    values.set(symbol, (values.get(symbol) ?? 0) + h.value)
  }
  return [...values.entries()].sort((a, b) => b[1] - a[1]).map(([symbol]) => symbol)
}

export interface FundMapState {
  funds: FundMap
  /** Funds whose facts arrived. */
  loaded: number
  /** Every fund in the account, including any beyond the cap (they count as unchecked). */
  total: number
  /** Some fund request is still in flight. */
  pending: boolean
}

/** Errors are simply absent from the map: one failed fund never blocks a card. */
export function useFundMap(holdings: readonly Holding[] | undefined): FundMapState {
  const symbols = fundSymbols(holdings)
  const checked = symbols.slice(0, FUND_CAP)
  return useQueries({
    queries: checked.map((symbol) => ({
      queryKey: ['fund', symbol],
      queryFn: () => api.getFund(symbol),
      staleTime: DAY,
      gcTime: DAY,
      retry: 1,
    })),
    combine: (results) => {
      const funds: FundMap = {}
      results.forEach((r, i) => {
        const symbol = checked[i]
        if (r.data && symbol) funds[symbol] = r.data
      })
      return {
        funds,
        loaded: Object.keys(funds).length,
        total: symbols.length,
        pending: results.some((r) => r.isPending),
      }
    },
  })
}
