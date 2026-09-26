import { describeError, hasCode } from '../api/errors'

/** What the API's /voice/upload-url accepts (docs/api/openapi.yaml). */
export type VoiceContentType = 'audio/webm' | 'audio/mp4' | 'audio/mpeg' | 'audio/wav' | 'audio/ogg'

export interface RecordingType {
  /** Passed to MediaRecorder; may carry a codec suffix. */
  mimeType: string
  /** Sent to the API and as the S3 PUT Content-Type; never carries a codec suffix. */
  contentType: VoiceContentType
}

// Best first. Chromium and Firefox record opus-in-webm; Safari records mp4.
const CANDIDATES: readonly RecordingType[] = [
  { mimeType: 'audio/webm;codecs=opus', contentType: 'audio/webm' },
  { mimeType: 'audio/webm', contentType: 'audio/webm' },
  { mimeType: 'audio/mp4', contentType: 'audio/mp4' },
  { mimeType: 'audio/ogg;codecs=opus', contentType: 'audio/ogg' },
  { mimeType: 'audio/ogg', contentType: 'audio/ogg' },
]

/** The first recording format this browser supports that the API also accepts, or null. */
export function pickRecordingType(isSupported: (mimeType: string) => boolean): RecordingType | null {
  return CANDIDATES.find((c) => isSupported(c.mimeType)) ?? null
}

const MIC_DENIED = 'Microphone access is off. You can type your question instead.'
const NOT_CAUGHT = "Didn't catch that. Try again a little closer to the mic."

/** User-facing copy for a failed voice turn (DESIGN.md §11, the two voice rows). */
export function voiceErrorCopy(e: unknown): string {
  if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'NotFoundError' || e.name === 'SecurityError')) {
    return MIC_DENIED
  }
  if (hasCode(e, 'VALIDATION')) return NOT_CAUGHT
  return describeError(e, 'The advisor')
}

export const isMicDenied = (e: unknown): boolean => voiceErrorCopy(e) === MIC_DENIED
