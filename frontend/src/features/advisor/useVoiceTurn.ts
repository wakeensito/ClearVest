import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { isMicDenied, pickRecordingType, voiceErrorCopy, type RecordingType } from '../../lib/voice'
import { useChat } from './chatContext'

export type VoiceStatus = 'idle' | 'recording' | 'uploading' | 'thinking' | 'speaking' | 'paused'

export interface VoiceTurnState {
  /** False when the browser has no MediaRecorder or microphone API; render nothing then. */
  supported: boolean
  status: VoiceStatus
  /** The live microphone stream while recording, for the level meter; null otherwise. */
  stream: MediaStream | null
  /** Copy for under the mic (DESIGN.md §11); null when there is nothing to say. */
  error: string | null
  /** Start recording, stop recording, or pause/resume playback, depending on status. No-op while busy. */
  toggle: () => void
  /** End playback early. No-op unless speaking or paused. */
  stop: () => void
}

// Keeps a recording well under the API's 10 MB cap and ElevenLabs' patience.
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

  const supported =
    typeof window !== 'undefined' && 'MediaRecorder' in window && typeof navigator.mediaDevices?.getUserMedia === 'function'

  const stopPlayback = useCallback(() => {
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
        chat.addTurn(turn.transcript, turn.reply, turn.disclaimer)
        reply = turn.reply
      } catch (e) {
        setError(voiceErrorCopy(e))
        setStatus('idle')
        return
      }
      // The answer is already on screen; a playback problem is a softer failure.
      try {
        setStatus('speaking')
        const { audioUrl } = await api.speak(reply)
        await play(audioUrl)
      } catch {
        if (player.current) setError(NO_PLAYBACK)
      } finally {
        player.current = null
        finishPlay.current = null
        setStatus('idle')
      }
    },
    [chat, play],
  )

  const start = useCallback(async () => {
    setError(null)
    const type = pickRecordingType((m) => MediaRecorder.isTypeSupported(m))
    if (!type) {
      setError(NO_RECORDER)
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      setError(voiceErrorCopy(e))
      if (isMicDenied(e)) onMicDenied?.()
      return
    }
    const rec = new MediaRecorder(stream, { mimeType: type.mimeType })
    chunks.current = []
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data)
    }
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      setStream(null)
      if (limit.current) window.clearTimeout(limit.current)
      recorder.current = null
      const blob = new Blob(chunks.current, { type: type.contentType })
      if (!blob.size) {
        setError(voiceErrorCopy(new DOMException('empty', 'NotFoundError')))
        setStatus('idle')
        return
      }
      void process(blob, type)
    }
    rec.start()
    recorder.current = rec
    setStream(stream)
    limit.current = window.setTimeout(() => rec.state === 'recording' && rec.stop(), MAX_SECONDS * 1000)
    setStatus('recording')
  }, [onMicDenied, process])

  const toggle = useCallback(() => {
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

  useEffect(
    () => () => {
      recorder.current?.stream.getTracks().forEach((t) => t.stop())
      stopPlayback()
    },
    [stopPlayback],
  )

  return useMemo(
    () => ({ supported, status, stream, error, toggle, stop }),
    [supported, status, stream, error, toggle, stop],
  )
}
