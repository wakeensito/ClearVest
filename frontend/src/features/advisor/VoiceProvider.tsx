import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '../../api/client'
import { NOT_CAUGHT, isMicDenied, pickRecordingType, voiceErrorCopy, type RecordingType } from '../../lib/voice'
import { useChat } from './chatContext'
import { VoiceContext, type VoiceController, type VoiceOptions, type VoiceStatus } from './voiceContext'

const NO_RECORDER = "This browser can't record audio. You can type your question instead."
const NO_PLAYBACK = "Couldn't play the reply. You can read it above or press Listen to try again."
const MAX_SECONDS = 60
interface Capture { owner: string; recorder?: MediaRecorder; stream?: MediaStream; timer?: number }

/** Mounted above both chat surfaces so a submitted turn and its playback survive navigation. */
export function VoiceProvider({ children }: { children: ReactNode }) {
  const { addTurn, beginVoiceTurn, endVoiceTurn, busy: chatBusy } = useChat()
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [replyId, setReplyId] = useState<string | null>(null)
  const alive = useRef(true)
  const capture = useRef<Capture | null>(null)
  const player = useRef<HTMLAudioElement | null>(null)
  const finishPlay = useRef<(() => void) | null>(null)
  const speechVersion = useRef(0)
  const lastAudio = useRef<{ text: string; url: string; expires: number } | null>(null)
  const supported = typeof navigator !== 'undefined' && 'MediaRecorder' in window && typeof navigator.mediaDevices?.getUserMedia === 'function'

  const releaseAudio = useCallback(() => {
    player.current?.pause()
    if (player.current) { player.current.onended = null; player.current.onerror = null }
    player.current = null
    finishPlay.current?.()
    finishPlay.current = null
  }, [])

  const cancelCapture = useCallback((owner: string) => {
    const current = capture.current
    if (!current || current.owner !== owner) return
    capture.current = null
    window.clearTimeout(current.timer)
    if (current.recorder) {
      current.recorder.onstop = null
      current.recorder.ondataavailable = null
      if (current.recorder.state !== 'inactive') current.recorder.stop()
    }
    current.stream?.getTracks().forEach(track => track.stop())
    endVoiceTurn()
    if (alive.current) { setStream(null); setStatus('idle') }
  }, [endVoiceTurn])

  const stop = useCallback(() => {
    if (capture.current) cancelCapture(capture.current.owner)
    ++speechVersion.current // Also suppress delayed playback after a submitted turn or TTS request.
    releaseAudio()
    setReplyId(null)
    setStatus(current => current === 'uploading' || current === 'thinking' ? current : 'idle')
  }, [cancelCapture, releaseAudio])

  const speak = useCallback(async (text: string, id: string) => {
    const version = ++speechVersion.current
    releaseAudio()
    setError(null)
    setReplyId(id)
    setStatus('loading')
    try {
      const cached = lastAudio.current
      let url: string
      if (cached?.text === text && cached.expires > Date.now()) url = cached.url
      else {
        const audio = await api.speak(text)
        url = audio.audioUrl
        if (alive.current && version === speechVersion.current) lastAudio.current = { text, url, expires: Date.now() + Math.max(0, audio.expiresIn - 60) * 1000 }
      }
      if (!alive.current || version !== speechVersion.current) return
      await new Promise<void>((resolve, reject) => {
        const audio = new Audio(url)
        player.current = audio
        finishPlay.current = resolve
        audio.onended = () => resolve()
        audio.onerror = () => reject(new Error('Playback failed'))
        setStatus('speaking')
        audio.play().catch(reject)
      })
    } catch {
      if (alive.current && version === speechVersion.current) setError(NO_PLAYBACK)
    } finally {
      if (alive.current && version === speechVersion.current) {
        releaseAudio()
        setStatus('idle')
        setReplyId(null)
      }
    }
  }, [releaseAudio])

  const process = useCallback(async (blob: Blob, type: RecordingType, options: VoiceOptions, speechTicket: number) => {
    let spoken: { text: string; id: string } | undefined
    try {
      setStatus('uploading')
      const { uploadUrl, key } = await api.createVoiceUploadUrl(type.contentType)
      if (!alive.current) return
      await api.uploadRecording(uploadUrl, blob, type.contentType)
      if (!alive.current) return
      setStatus('thinking')
      const turn = await api.voiceTurn(key, options.context)
      if (!alive.current) return
      const id = addTurn(turn.transcript, turn.reply, turn.disclaimer, { safety: turn.safety, sources: turn.sources }, options.context)
      spoken = { text: turn.reply, id }
    } catch (cause) {
      if (alive.current) setError(voiceErrorCopy(cause))
    } finally {
      endVoiceTurn()
      if (alive.current) setStatus('idle')
    }
    if (alive.current && spoken && speechTicket === speechVersion.current) void speak(spoken.text, spoken.id)
  }, [addTurn, endVoiceTurn, speak])

  const start = useCallback(async (owner: string, options: VoiceOptions) => {
    if (!supported) { setError(NO_RECORDER); return }
    const type = pickRecordingType(mime => MediaRecorder.isTypeSupported(mime))
    if (!type) { setError(NO_RECORDER); return }
    if (!beginVoiceTurn()) return
    ++speechVersion.current
    releaseAudio()
    setReplyId(null)
    setError(null)
    setStatus('requesting')
    const current: Capture = { owner }
    capture.current = current
    // Freeze the navigation/tool identifiers before permission prompts or route changes.
    const snapshot = { ...options, context: options.context ? structuredClone(options.context) : undefined }
    let mic: MediaStream
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (cause) {
      if (capture.current !== current || !alive.current) return
      cancelCapture(owner)
      setError(voiceErrorCopy(cause))
      if (isMicDenied(cause)) snapshot.onMicDenied?.()
      return
    }
    if (!alive.current || capture.current !== current) { mic.getTracks().forEach(track => track.stop()); return }
    current.stream = mic
    let recorder: MediaRecorder
    try { recorder = new MediaRecorder(mic, { mimeType: type.mimeType }) }
    catch { cancelCapture(owner); setError(NO_RECORDER); return }
    current.recorder = recorder
    const chunks: Blob[] = []
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.onerror = () => { if (capture.current === current) { cancelCapture(owner); setError(NO_RECORDER) } }
    recorder.onstop = () => {
      if (capture.current !== current) return
      capture.current = null
      window.clearTimeout(current.timer)
      mic.getTracks().forEach(track => track.stop())
      if (!alive.current) return
      setStream(null)
      const blob = new Blob(chunks, { type: type.contentType })
      if (!blob.size) { endVoiceTurn(); setStatus('idle'); setError(NOT_CAUGHT); return }
      void process(blob, type, snapshot, speechVersion.current)
    }
    try { recorder.start() }
    catch { cancelCapture(owner); setError(NO_RECORDER); return }
    current.timer = window.setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, MAX_SECONDS * 1000)
    setStream(mic)
    setStatus('recording')
  }, [beginVoiceTurn, cancelCapture, endVoiceTurn, process, releaseAudio, supported])

  const toggle = useCallback((owner: string, options: VoiceOptions) => {
    if (status === 'recording') capture.current?.recorder?.stop()
    else if (status === 'speaking' && player.current) { player.current.pause(); setStatus('paused') }
    else if (status === 'paused' && player.current) {
      setStatus('speaking')
      player.current.play().catch(() => { stop(); setError(NO_PLAYBACK) })
    } else if (status === 'idle') void start(owner, options)
  }, [start, status, stop])

  const readAloud = useCallback((text: string, id: string) => {
    if (chatBusy) return
    if (id === replyId && (status === 'speaking' || status === 'paused')) toggle('', {})
    else void speak(text, id)
  }, [chatBusy, replyId, speak, status, toggle])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (capture.current) cancelCapture(capture.current.owner)
      releaseAudio()
      lastAudio.current = null
    }
  }, [cancelCapture, releaseAudio])

  const busy = ['requesting', 'recording', 'uploading', 'thinking'].includes(status)
  const value = useMemo<VoiceController>(() => ({ supported, status, busy, stream, error, replyId, toggle, stop, readAloud, cancelCapture }),
    [supported, status, busy, stream, error, replyId, toggle, stop, readAloud, cancelCapture])
  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
}
