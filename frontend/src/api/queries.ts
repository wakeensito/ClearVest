import { QueryClient, useMutation, useQueries, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { api, type Fund, type Profile, type HistoryRange, type MarketCategory } from './client'
import type { FundState } from '../lib/fundExplainer'
import { isApiError } from './errors'
import { symbolsError } from '../lib/compare'
import { historyRefreshInterval } from '../lib/historyRefresh'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // The API is rate-limited and some routes spend real money; don't refetch behind the user's back.
      refetchOnWindowFocus: false,
      // Never retry a 4xx (validation, not linked, no profile); retry a 5xx or network failure once.
      retry: (count, error) => count < 1 && (!isApiError(error) || error.status === 0 || error.status >= 500),
    },
    mutations: { retry: false },
  },
})

export const keys = {
  profile: ['profile'] as const,
  holdings: ['holdings'] as const,
  risk: ['risk'] as const,
  macro: ['macro'] as const,
}

export const useProfile = () => useQuery({ queryKey: keys.profile, queryFn: api.getProfile })
export const useHoldings = () => useQuery({ queryKey: keys.holdings, queryFn: api.getHoldings })
export const useRisk = () => useQuery({ queryKey: keys.risk, queryFn: api.getRisk })
export const useMacro = () => useQuery({ queryKey: keys.macro, queryFn: api.getMacro, staleTime: 15 * 60_000 })

export function useSaveProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (profile: Profile) => api.putProfile(profile),
    onSuccess: (saved) => {
      qc.setQueryData(keys.profile, saved)
      // Risk depends on age and horizon.
      void qc.invalidateQueries({ queryKey: keys.risk })
    },
  })
}

/** Linking refreshes the holdings snapshot server-side, so everything portfolio-shaped is refetched. */
export function useOnLinked() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.holdings }),
      qc.invalidateQueries({ queryKey: keys.risk }),
      qc.invalidateQueries({ queryKey: ['portfolio-exposure'] }),
    ])
}

export const useHistory = (symbol: string, range: HistoryRange) => useQuery({
  enabled: /^[A-Z0-9.^-]{1,12}$/.test(symbol),
  queryKey: ['history', symbol, range],
  queryFn: () => api.getHistory(symbol, range),
  staleTime: query => query.state.data?.refreshing ? 0 : 15 * 60_000,
  refetchInterval: query => query.state.error ? false : historyRefreshInterval(query.state.data),
  refetchIntervalInBackground: false,
})

/** Pass normalized tickers (lib/compare.ts). Disabled outside 2–4 symbols, so an incomplete set never hits the API. */
export const useCompareCompanies = (symbols: readonly string[]) => useQuery({
  queryKey: ['compare', ...symbols],
  queryFn: () => api.compareCompanies(symbols),
  enabled: symbolsError(symbols) === null,
  staleTime: 15 * 60_000,
})

export const useCompanies = useCompareCompanies

export const useMarketMovers = (category: MarketCategory) => useQuery({
  queryKey: ['market-movers', category],
  queryFn: () => api.getMarketMovers(category),
  staleTime: 15 * 60_000,
})

export const useMarketNews = (symbols: string[], enabled = true) => useQuery({
  queryKey: ['market-news', ...[...new Set(symbols)].sort()],
  queryFn: () => api.getMarketNews([...new Set(symbols)].sort()),
  enabled,
  staleTime: 15 * 60_000,
})

export const useCompanyResearch = (symbol: string) => useQuery({
  queryKey: ['company-research', symbol],
  queryFn: () => api.getCompanyResearch(symbol),
  enabled: /^[A-Z0-9.^-]{1,12}$/.test(symbol),
  staleTime: 15 * 60_000,
})

/** Shared by the hook and by SymbolSearch's Enter, which awaits the same cached request. */
export const companySearchQuery = (query: string) => ({
  queryKey: ['company-search', query.toLowerCase()],
  queryFn: () => api.searchCompanies(query),
  staleTime: 15 * 60_000,
})

export const useCompanySearch = (query: string) => useQuery({
  ...companySearchQuery(query),
  enabled: query.trim().length > 0,
})

/** Bundled model portfolios (not user-specific); change essentially never, so cache a full day. */
export const useTemplates = () =>
  useQuery({
    queryKey: ['templates'],
    queryFn: api.getTemplates,
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
  })

/** What a security is (kind, index, fees, top holdings). Fund facts change slowly, so keep them a day. */
const fundQuery = (symbol: string) => ({
  queryKey: ['fund', symbol] as const,
  queryFn: () => api.getFund(symbol),
  enabled: /^[A-Z0-9.^-]{1,12}$/.test(symbol),
  staleTime: 24 * 60 * 60_000,
  gcTime: 24 * 60 * 60_000,
})
export const useFund = (symbol: string) => useQuery(fundQuery(symbol))
/** One fund query per symbol, in the same order, sharing the cache with `useFund`. */
export const useFunds = (symbols: readonly string[]) => useQueries({ queries: symbols.map(fundQuery) })

/** Error wins over stale data so a failed refetch hides the identity line rather than lying. */
export const toFundState = (query: UseQueryResult<Fund>): FundState =>
  query.isError ? { status: 'error' } : query.data ? { status: 'success', fund: query.data } : { status: 'pending' }

/** Fund data is public; exposure is recomputed from the server's caller-owned snapshot. */
export function usePortfolioExposure() {
  const holdings = useHoldings()
  const fundValues = new Map<string, number>()
  for (const holding of holdings.data?.holdings ?? []) {
    if (['etf', 'mutual fund', 'mutual_fund', 'fund'].includes(holding.type) && holding.value > 0 && /^[A-Z0-9.^-]{1,12}$/.test(holding.symbol)) {
      fundValues.set(holding.symbol, (fundValues.get(holding.symbol) ?? 0) + holding.value)
    }
  }
  const funds = [...fundValues].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([symbol]) => symbol)
  const sources = useQueries({ queries: funds.map(symbol => ({ queryKey: ['fund-holdings', symbol], queryFn: () => api.getFundHoldings(symbol), staleTime: 15*60_000, retry: false })) })
  const loadingSources = sources.some(q => q.isFetching)
  const revision = sources.map(q => `${q.dataUpdatedAt}:${q.errorUpdatedAt}`).join(',')
  const exposure = useQuery({ queryKey: ['portfolio-exposure', holdings.dataUpdatedAt, revision], queryFn: api.getPortfolioExposure, enabled: !!holdings.data && !loadingSources, retry: false })
  return { holdings, exposure, loading: holdings.isPending || loadingSources || (!!holdings.data && exposure.isPending),
    refresh: async () => { await holdings.refetch(); await Promise.allSettled(sources.map(q=>q.refetch())); await exposure.refetch() } }
}
