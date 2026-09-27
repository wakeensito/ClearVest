import { LoaderCircle, Mic, Pause, Play, Square, Volume2 } from 'lucide-react'
import type { VoiceStatus, VoiceTurnState } from './useVoiceTurn'
import styles from './VoiceButton.module.css'
import { Waveform } from './Waveform'

const LABEL: Record<VoiceStatus, string> = {
  idle: 'Ask by voice', requesting: 'Waiting for microphone access', recording: 'Stop recording',
  uploading: 'Sending your recording', thinking: 'Scout is thinking', loading: 'Preparing Scout’s voice',
  speaking: 'Pause playback', paused: 'Resume playback',
}
const STATUS: Record<Exclude<VoiceStatus, 'idle'>, string> = {
  requesting: 'Allow microphone access to speak.', recording: 'Listening. Tap the square to send.',
  uploading: 'Sending your recording…', thinking: 'Scout is thinking…', loading: 'Preparing Scout’s voice…',
  speaking: 'Scout is speaking.', paused: 'Voice paused.',
}

export function VoiceButton({ voice, disabled }: { voice: VoiceTurnState; disabled?: boolean }) {
  if (!voice.supported && voice.status === 'idle') return null
  const waiting = ['requesting', 'uploading', 'thinking', 'loading'].includes(voice.status)
  const icon = voice.status === 'recording' ? <Square size={16} aria-hidden fill="currentColor" />
    : waiting ? <LoaderCircle size={20} aria-hidden className={styles.spin} />
    : voice.status === 'speaking' ? <Pause size={18} aria-hidden fill="currentColor" />
    : voice.status === 'paused' ? <Play size={18} aria-hidden fill="currentColor" /> : <Mic size={20} aria-hidden />
  return <button type="button" className={`${styles.mic} ${styles[voice.status] ?? ''}`} onClick={voice.toggle}
    disabled={waiting || (disabled && voice.status === 'idle')} aria-label={LABEL[voice.status]}
    aria-pressed={voice.status === 'recording'} title={LABEL[voice.status]}>{icon}</button>
}

/** Text answers use the same ElevenLabs voice and player as spoken questions. */
export function VoiceReplyButton({ voice, text, id, disabled }: { voice: VoiceTurnState; text: string; id: string; disabled?: boolean }) {
  const active = voice.replyId === id
  const label = active && voice.status === 'speaking' ? 'Pause reply' : active && voice.status === 'paused' ? 'Resume reply' : 'Listen to reply'
  return <button type="button" className={styles.listen} disabled={disabled || (active && voice.status === 'loading')}
    aria-label={label} onClick={() => voice.readAloud(text, id)}>
    {active && voice.status === 'loading' ? <LoaderCircle size={14} className={styles.spin} aria-hidden />
      : active && voice.status === 'speaking' ? <Pause size={14} aria-hidden /> : <Volume2 size={14} aria-hidden />}
    {active && voice.status === 'loading' ? 'Preparing voice…' : label === 'Listen to reply' ? 'Listen' : label}
  </button>
}

export function VoiceStatus({ voice }: { voice: VoiceTurnState }) {
  const text = voice.error ?? (voice.status === 'idle' ? null : STATUS[voice.status])
  const capturing = voice.status === 'recording' || voice.status === 'requesting'
  const playing = ['loading', 'speaking', 'paused'].includes(voice.status)
  return <div className={`${styles.status} ${voice.error ? styles.error : ''}`} aria-live="polite" role="status">
    {voice.status === 'recording' && voice.stream && <Waveform stream={voice.stream} />}
    {text && <span>{text}</span>}
    {(capturing || playing) && <button type="button" className={styles.link} onClick={voice.stop}>{capturing ? 'Cancel recording' : 'Stop audio'}</button>}
  </div>
}
