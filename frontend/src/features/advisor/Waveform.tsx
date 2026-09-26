import { useEffect, useRef } from 'react'
import styles from './VoiceButton.module.css'

const BARS = 24
const GAP = 2

/**
 * Live input level while recording, so the speaker can see they are being heard. Draws from an
 * AnalyserNode on the mic stream; nothing is stored. Decorative: the status text carries the meaning.
 */
export function Waveform({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || typeof AudioContext === 'undefined') return
    const g = canvas.getContext('2d')
    if (!g) return

    const dpr = window.devicePixelRatio || 1
    const cssWidth = canvas.clientWidth || 96
    const cssHeight = canvas.clientHeight || 20
    canvas.width = Math.round(cssWidth * dpr)
    canvas.height = Math.round(cssHeight * dpr)
    g.scale(dpr, dpr)

    const audio = new AudioContext()
    const source = audio.createMediaStreamSource(stream)
    const analyser = audio.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.7
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    // Voice lives in the lower bins; the top half of the spectrum is mostly silence at 48 kHz.
    const usable = Math.floor(data.length / 2)
    const perBar = Math.max(1, Math.floor(usable / BARS))
    const barWidth = (cssWidth - GAP * (BARS - 1)) / BARS
    const color = getComputedStyle(canvas).color

    let frame = 0
    const draw = () => {
      analyser.getByteFrequencyData(data)
      g.clearRect(0, 0, cssWidth, cssHeight)
      g.fillStyle = color
      for (let i = 0; i < BARS; i++) {
        let sum = 0
        for (let j = 0; j < perBar; j++) sum += data[i * perBar + j] ?? 0
        const level = sum / perBar / 255
        const h = Math.max(2, level * cssHeight)
        g.fillRect(i * (barWidth + GAP), (cssHeight - h) / 2, barWidth, h)
      }
      frame = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(frame)
      source.disconnect()
      void audio.close()
    }
  }, [stream])

  return <canvas ref={ref} className={styles.wave} aria-hidden />
}
