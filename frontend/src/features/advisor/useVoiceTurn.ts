import { useContext, useEffect, useId } from 'react'
import { VoiceContext, type VoiceOptions, type VoiceTurnState } from './voiceContext'
export type { VoiceStatus, VoiceTurnState } from './voiceContext'

/** Both surfaces control one session; context is captured when recording starts. */
export function useVoiceTurn(options: VoiceOptions = {}): VoiceTurnState {
  const voice = useContext(VoiceContext)
  const owner = useId()
  if (!voice) throw new Error('useVoiceTurn must be used inside <VoiceProvider>')
  const { cancelCapture } = voice
  const enabled = options.enabled !== false
  useEffect(() => {
    if (!enabled) cancelCapture(owner)
    // Stop an unsent recording when its surface disappears; submitted turns survive navigation.
    return () => cancelCapture(owner)
  }, [cancelCapture, enabled, owner])
  return { ...voice, toggle: () => { if (enabled) voice.toggle(owner, options) } }
}
