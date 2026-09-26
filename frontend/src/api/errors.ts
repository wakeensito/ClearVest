import type { components } from './schema'

type EnvelopeCode = components['schemas']['Error']['error']['code']

/**
 * Every failure the UI can see (DESIGN.md §11). The first five come from the API's error envelope;
 * THROTTLED is API Gateway's 429 (no envelope), NETWORK is a failed or timed-out fetch.
 */
export type ErrorCode = EnvelopeCode | 'THROTTLED' | 'NETWORK'

export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode
  readonly requestId: string | null

  constructor(status: number, code: ErrorCode, message: string, requestId: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

const ENVELOPE_CODES: readonly string[] = ['VALIDATION', 'NOT_FOUND', 'NOT_LINKED', 'UPSTREAM_UNAVAILABLE', 'INTERNAL']

function envelope(body: unknown): { code: string; message: string; requestId: string | null } | null {
  if (typeof body !== 'object' || body === null || !('error' in body)) return null
  const e = (body as { error: unknown }).error
  if (typeof e !== 'object' || e === null) return null
  const { code, message, requestId } = e as Record<string, unknown>
  if (typeof code !== 'string') return null
  return {
    code,
    message: typeof message === 'string' ? message : '',
    requestId: typeof requestId === 'string' ? requestId : null,
  }
}

/** Turns a non-2xx response into an ApiError, whatever shape the body has. */
export function toApiError(status: number, body: unknown): ApiError {
  const env = envelope(body)
  if (env && ENVELOPE_CODES.includes(env.code)) {
    return new ApiError(status, env.code as EnvelopeCode, env.message, env.requestId)
  }
  if (status === 429) return new ApiError(status, 'THROTTLED', 'Too many requests')
  if (status === 404) return new ApiError(status, 'NOT_FOUND', 'Not found')
  if (status === 409) return new ApiError(status, 'NOT_LINKED', 'No linked account')
  if (status === 502 || status === 503 || status === 504) {
    return new ApiError(status, 'UPSTREAM_UNAVAILABLE', 'Upstream unavailable')
  }
  if (status >= 500) return new ApiError(status, 'INTERNAL', 'Internal error')
  return new ApiError(status, 'VALIDATION', env?.message || 'Request rejected')
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError

export const hasCode = (e: unknown, code: ErrorCode): boolean => isApiError(e) && e.code === code

/** User-facing copy for each failure (DESIGN.md §11). `noun` names the data: "Market data". */
export function describeError(e: unknown, noun = 'This data'): string {
  if (!isApiError(e)) return 'Something went wrong on our side.'
  switch (e.code) {
    case 'UPSTREAM_UNAVAILABLE':
      return `${noun} is temporarily unavailable.`
    case 'NETWORK':
      return "Can't reach ClearVest. Check your connection."
    case 'THROTTLED':
      return "You're sending requests quickly. Wait a moment and try again."
    case 'NOT_LINKED':
      return 'Link an account to see this.'
    case 'VALIDATION':
    case 'NOT_FOUND':
      return e.message || 'That request was rejected.'
    default:
      return 'Something went wrong on our side.'
  }
}
