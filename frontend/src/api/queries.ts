import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Profile, type HistoryRange, type MarketCategory } from './client'
import { isApiError } from './errors'

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
    ])
}

export const useHistory = (symbol: string, range: HistoryRange) => useQuery({
  enabled: /^[A-Z0-9.^-]{1,12}$/.test(symbol),
  queryKey: ['history', symbol, range],
  queryFn: () => api.getHistory(symbol, range),
  staleTime: 15 * 60_000,
})

export const useCompanies = (symbols: string[]) => useQuery({
  queryKey: ['companies', ...symbols],
  queryFn: () => api.compareCompanies(symbols),
  enabled: symbols.length >= 2,
  staleTime: 15 * 60_000,
})

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

export const useCompanySearch = (query: string) => useQuery({
  queryKey: ['company-search', query.toLowerCase()],
  queryFn: () => api.searchCompanies(query),
  enabled: query.trim().length > 0,
  staleTime: 15 * 60_000,
})
