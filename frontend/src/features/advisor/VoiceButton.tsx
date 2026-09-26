import { LoaderCircle, Mic, Pause, Play, Square } from 'lucide-react'
import type { VoiceStatus, VoiceTurnState } from './useVoiceTurn'
import styles from './VoiceButton.module.css'
import { Waveform } from './Waveform'

const LABEL: Record<VoiceStatus, string> = {
  idle: 'Ask by voice',
  recording: 'Stop recording',
  uploading: 'Sending your recording',
  thinking: 'Reviewing your portfolio',
  speaking: 'Pause playback',
  paused: 'Resume playback',
}

const STATUS: Record<Exclude<VoiceStatus, 'idle'>, string> = {
  recording: 'Listening. Press the button or Space to stop.',
  uploading: 'Sending your recording',
  thinking: 'Reviewing your portfolio',
  speaking: 'Playing the reply.',
  paused: 'Paused.',
}

/** The mic button for the composer. Space toggles it because it is a native button (DESIGN.md §12). */
export function VoiceButton({ voice, disabled }: { voice: VoiceTurnState; disabled?: boolean }) {
  if (!voice.supported) return null
  const icon =
    voice.status === 'recording' ? <Square size={18} aria-hidden fill="currentColor" />
    : voice.busy ? <LoaderCircle size={20} aria-hidden className={styles.spin} />
    : voice.status === 'speaking' ? <Pause size={18} aria-hidden fill="currentColor" />
    : voice.status === 'paused' ? <Play size={18} aria-hidden fill="currentColor" />
    : <Mic size={20} aria-hidden />
  return (
    <button
      type="button"
      className={`${styles.mic} ${styles[voice.status]}`}
      onClick={voice.toggle}
      disabled={disabled || voice.busy}
      aria-label={LABEL[voice.status]}
      aria-pressed={voice.status === 'recording'}
      title={LABEL[voice.status]}
    >
      {icon}
    </button>
  )
}

/** What is happening, under the mic. Announced politely; errors are red and stay until the next attempt. */
export function VoiceStatus({ voice }: { voice: VoiceTurnState }) {
  if (!voice.supported) return null
  const text = voice.error ?? (voice.status === 'idle' ? null : STATUS[voice.status])
  const playing = !voice.error && (voice.status === 'speaking' || voice.status === 'paused')
  return (
    <p className={`t-body-sm ${styles.status} ${voice.error ? styles.error : 'c-secondary'}`} aria-live="polite" role="status">
      {voice.status === 'recording' && !voice.error && voice.stream && <Waveform stream={voice.stream} />}
      {text}
      {playing && (
        <button type="button" className={styles.link} onClick={voice.stop}>
          Stop
        </button>
      )}
    </p>
  )
}
