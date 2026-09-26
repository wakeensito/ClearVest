import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { NOT_CAUGHT, isMicDenied, pickRecordingType, voiceErrorCopy, type RecordingType } from '../../lib/voice'
import { useChat } from './chatContext'

export type VoiceStatus = 'idle' | 'recording' | 'uploading' | 'thinking' | 'speaking' | 'paused'

export interface VoiceTurnState {
  /** False when the browser has no MediaRecorder or microphone API; render nothing then. */
  supported: boolean
  status: VoiceStatus
  /** A voice request is in flight (uploading or awaiting the turn). The typed composer waits for it. */
  busy: boolean
  /** The live microphone stream while recording, for the level meter; null otherwise. */
  stream: MediaStream | null
  /** Copy for under the mic (DESIGN.md §11); null when there is nothing to say. */
  error: string | null
  /** Start recording, stop recording, or pause/resume playback, depending on status. No-op while busy. */
  toggle: () => void
  /** End playback early, or skip it if the speech is still loading. No-op otherwise. */
  stop: () => void
}

// Keeps a recording well under the API's 10 MB cap and the STT provider's timeout.
const MAX_SECONDS = 60
const NO_RECORDER = "This browser can't record audio. You can type your question instead."
const NO_PLAYBACK = "Couldn't play the reply. It's in the chat above."

/**
 * One voice turn: record -> upload-url -> PUT to S3 -> /voice/turn -> add both sides to the chat ->
 * /voice/speak -> play. Sequential on purpose: /voice/* is throttled to 2 req/s.
 */
export function useVoiceTurn({ onMicDenied }: { onMicDenied?: () => void } = {}): VoiceTurnState {
  const chat = useChat()
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const player = useRef<HTMLAudioElement | null>(null)
  const finishPlay = useRef<(() => void) | null>(null)
  const limit = useRef<number | null>(null)
  // getUserMedia is pending: no second start until the browser answers.
  const starting = useRef(false)
  // False once unmounted: work that finishes afterwards must not touch state or start requests.
  const alive = useRef(true)
  // Stop was pressed while /voice/speak was still loading: skip the playback when it arrives.
  const skipSpeech = useRef(false)

  const supported =
    typeof window !== 'undefined' && 'MediaRecorder' in window && typeof navigator.mediaDevices?.getUserMedia === 'function'

  const stopPlayback = useCallback(() => {
    skipSpeech.current = true
    player.current?.pause()
    player.current = null
    finishPlay.current?.()
    finishPlay.current = null
  }, [])

  const play = useCallback(
    (url: string) =>
      new Promise<void>((resolve, reject) => {
        const el = new Audio(url)
        player.current = el
        finishPlay.current = resolve
        el.onended = () => resolve()
        el.onerror = () => reject(new Error('playback failed'))
        el.play().catch(reject)
      }),
    [],
  )

  const process = useCallback(
    async (blob: Blob, type: RecordingType) => {
      let reply: string
      try {
        setStatus('uploading')
        const { uploadUrl, key } = await api.createVoiceUploadUrl(type.contentType)
        await api.uploadRecording(uploadUrl, blob, type.contentType)
        setStatus('thinking')
        const turn = await api.voiceTurn(key)
        if (!alive.current) return
        chat.addTurn(turn.transcript, turn.reply, turn.disclaimer)
        reply = turn.reply
      } catch (e) {
        if (!alive.current) return
        setError(voiceErrorCopy(e))
        setStatus('idle')
        return
      }
      // The answer is already on screen; a playback problem is a softer failure.
      skipSpeech.current = false
      try {
        setStatus('speaking')
        const { audioUrl } = await api.speak(reply)
        if (alive.current && !skipSpeech.current) await play(audioUrl)
      } catch {
        if (alive.current && !skipSpeech.current) setError(NO_PLAYBACK)
      } finally {
        player.current = null
        finishPlay.current = null
        if (alive.current) setStatus('idle')
      }
    },
    [chat, play],
  )

  const start = useCallback(async () => {
    if (starting.current || recorder.current) return
    setError(null)
    const type = pickRecordingType((m) => MediaRecorder.isTypeSupported(m))
    if (!type) {
      setError(NO_RECORDER)
      return
    }
    starting.current = true
    let mic: MediaStream
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      starting.current = false
      if (!alive.current) return
      setError(voiceErrorCopy(e))
      if (isMicDenied(e)) onMicDenied?.()
      return
    }
    starting.current = false
    const release = () => mic.getTracks().forEach((t) => t.stop())
    if (!alive.current) {
      release()
      return
    }
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(mic, { mimeType: type.mimeType })
    } catch {
      release()
      setError(NO_RECORDER)
      return
    }
    chunks.current = []
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data)
    }
    rec.onstop = () => {
      release()
      if (limit.current) window.clearTimeout(limit.current)
      recorder.current = null
      if (!alive.current) return
      setStream(null)
      const blob = new Blob(chunks.current, { type: type.contentType })
      if (!blob.size) {
        setError(NOT_CAUGHT)
        setStatus('idle')
        return
      }
      void process(blob, type)
    }
    rec.start()
    recorder.current = rec
    setStream(mic)
    limit.current = window.setTimeout(() => rec.state === 'recording' && rec.stop(), MAX_SECONDS * 1000)
    setStatus('recording')
  }, [onMicDenied, process])

  const toggle = useCallback(() => {
    if (starting.current) return
    if (status === 'recording') recorder.current?.stop()
    else if (status === 'speaking' && player.current) {
      player.current.pause()
      setStatus('paused')
    } else if (status === 'paused' && player.current) {
      setStatus('speaking')
      player.current.play().catch(() => stopPlayback())
    } else if (status === 'idle') void start()
  }, [status, start, stopPlayback])

  const stop = useCallback(() => {
    if (status === 'speaking' || status === 'paused') stopPlayback()
  }, [status, stopPlayback])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (limit.current) window.clearTimeout(limit.current)
      const rec = recorder.current
      recorder.current = null
      if (rec) {
        rec.onstop = null
        rec.ondataavailable = null
        if (rec.state !== 'inactive') rec.stop()
        rec.stream.getTracks().forEach((t) => t.stop())
      }
      stopPlayback()
    }
  }, [stopPlayback])

  const busy = status === 'uploading' || status === 'thinking'

  return useMemo(
    () => ({ supported, status, busy, stream, error, toggle, stop }),
    [supported, status, busy, stream, error, toggle, stop],
  )
}
