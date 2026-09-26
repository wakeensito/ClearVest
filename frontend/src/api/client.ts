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
export type HistoryRange = components['parameters']['Range']
export type UploadUrl = Schemas['UploadUrl']
export type VoiceTurn = Schemas['VoiceTurn']
export type Speech = Schemas['Speech']

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

export const api = {
  getProfile: () => unwrap(client.GET('/profile', { params: user() })),
  putProfile: (body: Profile) => unwrap(client.PUT('/profile', { params: user(), body })),

  createLinkToken: () => unwrap(client.POST('/plaid/link-token', { params: user() })),
  exchangePublicToken: (publicToken: string) =>
    unwrap(client.POST('/plaid/exchange', { params: user(), body: { publicToken } })),
  sandboxLink: () => unwrap(client.POST('/plaid/sandbox-link', { params: user() })),

  getHoldings: () => unwrap(client.GET('/portfolio/holdings', { params: user() })),
  getRisk: () => unwrap(client.GET('/portfolio/risk', { params: user() })),

  getMacro: () => unwrap(client.GET('/market/macro', { params: user() })),
  getHistory: (symbol: string, range: HistoryRange) =>
    unwrap(client.GET('/market/history', { params: { ...user(), query: { symbols: symbol, range } } })),

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
