import { createContext } from 'react'
import type { ScoutPageContext } from './scoutContext'

export type VoiceStatus = 'idle' | 'requesting' | 'recording' | 'uploading' | 'thinking' | 'loading' | 'speaking' | 'paused'
export interface VoiceOptions {
  context?: ScoutPageContext
  onMicDenied?: () => void
  enabled?: boolean
}
export interface VoiceTurnState {
  supported: boolean
  status: VoiceStatus
  /** Recording/permission and the submitted question reserve the shared conversation. */
  busy: boolean
  stream: MediaStream | null
  error: string | null
  replyId: string | null
  toggle: () => void
  stop: () => void
  readAloud: (text: string, id: string) => void
}
export interface VoiceController extends Omit<VoiceTurnState, 'toggle'> {
  toggle: (owner: string, options: VoiceOptions) => void
  cancelCapture: (owner: string) => void
}
export const VoiceContext = createContext<VoiceController | null>(null)
