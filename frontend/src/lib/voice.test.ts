import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/errors'
import { pickRecordingType, voiceErrorCopy } from './voice'

describe('pickRecordingType', () => {
  it('prefers opus-in-webm and strips the codec for the API', () => {
    const picked = pickRecordingType((m) => m.startsWith('audio/webm'))
    expect(picked).toEqual({ mimeType: 'audio/webm;codecs=opus', contentType: 'audio/webm' })
  })

  it('falls back to mp4 on browsers without webm (Safari)', () => {
    const picked = pickRecordingType((m) => m === 'audio/mp4')
    expect(picked).toEqual({ mimeType: 'audio/mp4', contentType: 'audio/mp4' })
  })

  it('returns null when nothing the API accepts is supported', () => {
    expect(pickRecordingType(() => false)).toBeNull()
  })
})

describe('voiceErrorCopy', () => {
  it('explains a denied microphone and points to typing', () => {
    const denied = new DOMException('Permission denied', 'NotAllowedError')
    expect(voiceErrorCopy(denied)).toMatch(/Microphone access is off/)
  })

  it('uses the "didn\'t catch that" copy for an empty transcript', () => {
    const empty = new ApiError(400, 'VALIDATION', "I didn't catch that. Try recording again.")
    expect(voiceErrorCopy(empty)).toBe("Didn't catch that. Try again a little closer to the mic.")
  })

  it('defers to the shared error copy otherwise', () => {
    expect(voiceErrorCopy(new ApiError(429, 'THROTTLED', 'Too many'))).toMatch(/sending requests quickly/)
    expect(voiceErrorCopy(new ApiError(0, 'NETWORK', 'Network error'))).toMatch(/Can't reach ClearVest/)
  })
})
