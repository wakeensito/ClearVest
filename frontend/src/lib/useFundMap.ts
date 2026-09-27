// Fund facts for every ETF / mutual fund in the account, for the look-through and plan cards
// (DESIGN.md §4.14). Same query key, fetcher, symbol gate and day-long cache as `useFund`, so the
// research explainer and these cards share one request per fund.

import { useQueries } from '@tanstack/react-query'
import { api, type Holding } from '../api/client'
import { normalizeType } from './assetTypes'
import type { FundMap } from './portfolioXray'

/** A demo account has a handful of funds; cap the fan-out so a big account can't burst the API. */
export const FUND_CAP = 8
const DAY = 24 * 60 * 60_000
/** The same gate as `useFund` in api/queries.ts: anything else is never requested. */
const REQUESTABLE = /^[A-Z0-9.^-]{1,12}$/

/** Distinct uppercase fund symbols (long positions only), largest position first. */
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

/** Which funds get requested, and which never will be (past the cap, or not a valid ticker). */
export function planFundRequests(symbols: readonly string[]): { requested: string[]; unchecked: string[] } {
  const valid = symbols.filter((s) => REQUESTABLE.test(s))
  const requested = valid.slice(0, FUND_CAP)
  return { requested, unchecked: symbols.filter((s) => !requested.includes(s)) }
}

export interface FundMapState {
  funds: FundMap
  /** Funds whose facts arrived. */
  loaded: number
  /** Distinct fund symbols in the account, requested or not (matches lookThrough's `fundsTotal`). */
  total: number
  /** Requested and still in flight. */
  pending: string[]
  /** Never requested: past the 8-fund cap or not a valid ticker. */
  unchecked: string[]
  /** Requested and failed. One failed fund never blocks a card. */
  failed: string[]
  /** Refetches the failed fund requests. */
  retry: () => void
}

export function useFundMap(holdings: readonly Holding[] | undefined): FundMapState {
  const symbols = fundSymbols(holdings)
  const { requested, unchecked } = planFundRequests(symbols)
  return useQueries({
    queries: requested.map((symbol) => ({
      queryKey: ['fund', symbol],
      queryFn: () => api.getFund(symbol),
      staleTime: DAY,
      gcTime: DAY,
      retry: 1,
    })),
    combine: (results) => {
      const funds: FundMap = {}
      const pending: string[] = []
      const failed: string[] = []
      results.forEach((r, i) => {
        const symbol = requested[i]
        if (!symbol) return
        if (r.data) funds[symbol] = r.data
        else if (r.isError) failed.push(symbol)
        else pending.push(symbol)
      })
      return {
        funds,
        loaded: Object.keys(funds).length,
        total: symbols.length,
        pending,
        unchecked,
        failed,
        retry: () => { for (const r of results) if (r.isError) void r.refetch() },
      }
    },
  })
}
