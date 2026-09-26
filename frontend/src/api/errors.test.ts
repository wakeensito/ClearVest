import { describe, expect, it } from 'vitest'
import { toApiError } from './errors'

describe('toApiError', () => {
  it('reads the API error envelope', () => {
    const e = toApiError(409, {
      error: { code: 'NOT_LINKED', message: 'No linked account.', requestId: 'req-1' },
    })
    expect(e.code).toBe('NOT_LINKED')
    expect(e.message).toBe('No linked account.')
    expect(e.requestId).toBe('req-1')
  })

  it("maps API Gateway's bare 429 to THROTTLED", () => {
    expect(toApiError(429, { message: 'Too Many Requests' }).code).toBe('THROTTLED')
  })

  it('falls back on status when the body is not an envelope', () => {
    expect(toApiError(502, 'Bad Gateway').code).toBe('UPSTREAM_UNAVAILABLE')
    expect(toApiError(500, undefined).code).toBe('INTERNAL')
    expect(toApiError(400, null).code).toBe('VALIDATION')
  })

  it('ignores unknown envelope codes', () => {
    expect(toApiError(503, { error: { code: 'SOMETHING_NEW' } }).code).toBe('UPSTREAM_UNAVAILABLE')
  })
})
