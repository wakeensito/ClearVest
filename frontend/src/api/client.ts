import createClient from 'openapi-fetch'
import { getUserId } from '../lib/userId'
import type { VoiceContentType } from '../lib/voice'
import { ApiError, toApiError } from './errors'
import type { components, paths } from './schema'

// Types come from docs/api/openapi.yaml (`npm run gen:api`); the contract wins over this file.
export type Schemas = components['schemas']
export type Profile = Schemas['Profile']
export type Holdings = Schemas['Holdings']
export type Holding = Schemas['Holding']
export type Risk = Schemas['Risk']
export type Macro = Schemas['Macro']
export type ChatReply = Schemas['ChatReply']
export type HistorySeries = Schemas['HistorySeries']
export type CompanyResearch = Schemas['CompanyResearch']
export type AnnualIncome = Schemas['AnnualIncome']
export type MarketCategory = Schemas['MarketMovers']['category']
export type HistoryRange = components['parameters']['Range']
export type Company = Schemas['Company']
export type Companies = Schemas['Companies']
export type UploadUrl = Schemas['UploadUrl']
export type VoiceTurn = Schemas['VoiceTurn']
export type Speech = Schemas['Speech']

// TODO(contract): switch to generated types once openapi.yaml has /market/fund.
// Hand-written from the agreed contract; `kind` values and fraction units must match the backend.
export type FundKind = 'etf' | 'mutual_fund' | 'stock' | 'other'
export interface FundHolding {
  symbol: string | null
  name: string
  /** Fraction of the fund (0.07 = 7%). */
  weight: number
}
export interface Fund {
  symbol: string
  name: string
  kind: FundKind
  isIndexFund: boolean
  tracks: string | null
  /** Fraction per year (0.0003 = 0.03%). */
  expenseRatio: number | null
  holdingsCount: number | null
  /** Up to 10, largest first; empty for stocks. */
  topHoldings: FundHolding[]
  summary: string
  summarySource: 'model' | 'template'
  /** Who runs the fund ("Vanguard"); null for stocks or when unknown. */
  fundFamily?: string | null
  /** Provider category ("Large Blend"); translated through a static map, never shown alone. */
  category?: string | null
  /** Stocks only ("Technology"). */
  sector?: string | null
  asOf: string
  stale?: boolean
}

/** The Prism mock by default; set VITE_API_BASE_URL to the stack's ApiUrl for the real backend. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4010').replace(/\/+$/, '')

// API Gateway cuts integrations at 30s; stop waiting a little after that.
const TIMEOUT_MS = 35_000

const client = createClient<paths>({
  baseUrl: API_BASE_URL,
  fetch: (request) =>
    globalThis.fetch(request, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)]) }),
})

const user = () => ({ header: { 'X-User-Id': getUserId() } })

type Result<T> = { data?: T; error?: unknown; response: Response }

async function unwrap<T>(call: Promise<Result<T>>): Promise<T> {
  let result: Result<T>
  try {
    result = await call
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === 'TimeoutError'
    throw new ApiError(0, 'NETWORK', timedOut ? 'Request timed out' : 'Network error')
  }
  if (!result.response.ok) throw toApiError(result.response.status, result.error)
  return result.data as T
}

/**
 * GET for a route the generated schema does not know yet. Same user header, timeout and error
 * mapping as the typed client, via `unwrap`.
 */
function getUntyped<T>(path: string, query: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  return unwrap<T>((async () => {
    const response = await globalThis.fetch(url, {
      headers: { 'X-User-Id': getUserId() },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const body: unknown = await response.json().catch(() => undefined)
    return response.ok ? { data: body as T, response } : { error: body, response }
  })())
}

export const api = {
  getProfile: () => unwrap(client.GET('/profile', { params: user() })),
  putProfile: (body: Profile) => unwrap(client.PUT('/profile', { params: user(), body })),

  createLinkToken: () => unwrap(client.POST('/plaid/link-token', { params: user() })),
  exchangePublicToken: (publicToken: string) =>
    unwrap(client.POST('/plaid/exchange', { params: user(), body: { publicToken } })),
  sandboxLink: () => unwrap(client.POST('/plaid/sandbox-link', { params: user() })),

  getHoldings: () => unwrap(client.GET('/portfolio/holdings', { params: user() })),
  getRisk: () => unwrap(client.GET('/portfolio/risk', { params: user() })),

  getCompanyResearch: (symbol: string) =>
    unwrap(client.GET('/market/company-research', { params: { ...user(), query: { symbol } } })),

  searchCompanies: (query: string) =>
    unwrap(client.GET('/market/search', { params: { ...user(), query: { query } } })),

  getMarketNews: (symbols: string[]) =>
    unwrap(client.GET('/market/news', { params: { ...user(), query: symbols.length ? { symbols: symbols.join(',') } : {} } })),

  getMarketMovers: (category: MarketCategory) =>
    unwrap(client.GET('/market/movers', { params: { ...user(), query: { category } } })),

  // TODO(contract): switch to generated types once openapi.yaml has /market/fund.
  getFund: (symbol: string) => getUntyped<Fund>('/market/fund', { symbol }),

  getMacro: () => unwrap(client.GET('/market/macro', { params: user() })),
  getHistory: (symbol: string, range: HistoryRange) =>
    unwrap(client.GET('/market/history', { params: { ...user(), query: { symbols: symbol, range } } })),
  /** 2 to 4 tickers; the API rejects other counts with a 400. Validate with `lib/compare.ts` first. */
  compareCompanies: (symbols: readonly string[]) =>
    unwrap(client.GET('/market/compare-companies', { params: { ...user(), query: { symbols: symbols.join(',') } } })),

  chat: (message: string) => unwrap(client.POST('/advisor/chat', { params: user(), body: { message } })),
  clearChatHistory: () => unwrap(client.DELETE('/advisor/history', { params: user() })),

  // Voice (docs/api/README.md "Voice flow"): upload-url -> PUT to S3 -> turn -> speak.
  createVoiceUploadUrl: (contentType: VoiceContentType) =>
    unwrap(client.POST('/voice/upload-url', { params: user(), body: { contentType } })),
  voiceTurn: (key: string) => unwrap(client.POST('/voice/turn', { params: user(), body: { key } })),
  speak: (text: string) => unwrap(client.POST('/voice/speak', { params: user(), body: { text } })),
  /** PUT straight to S3. The Content-Type must match what upload-url was asked for; it is in the signature. */
  uploadRecording: async (uploadUrl: string, blob: Blob, contentType: VoiceContentType): Promise<void> => {
    let res: Response
    try {
      res = await globalThis.fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (e) {
      const timedOut = e instanceof DOMException && e.name === 'TimeoutError'
      throw new ApiError(0, 'NETWORK', timedOut ? 'Upload timed out' : 'Network error')
    }
    if (!res.ok) throw new ApiError(res.status, 'UPSTREAM_UNAVAILABLE', 'Upload failed')
  },
}
