import { useEffect, useId, useState, type CSSProperties } from 'react'
import styles from './Scout.module.css'

export type ScoutState = 'idle' | 'attentive' | 'thinking' | 'ready' | 'unavailable'
// Register each pose to the same head/eye coordinates; the generated grid has uneven gutters.
const POSES = [
  { name: 'peek', x: 0, y: 0, eyes: [214, 447], eyeY: 352 },
  { name: 'listen', x: 607, y: 0, eyes: [216, 445], eyeY: 352 },
  { name: 'think', x: 0, y: 590, eyes: [215, 446], eyeY: 352 },
  { name: 'ready', x: 607, y: 590, eyes: [216, 446], eyeY: 356 },
] as const

/** Shaded poses dissolve while the body rises; independent pupils retain continuous gaze. */
export function Scout({ state = 'idle', engaged = false }: { state?: ScoutState; engaged?: boolean }) {
  const id = useId().replaceAll(':', '')
  const [loaded, setLoaded] = useState(false)
  const [hidden, setHidden] = useState(() => document.hidden)
  const [gaze, setGaze] = useState({ x: 0, y: 0 })
  const [pointing, setPointing] = useState(false)
  const pose = state === 'thinking' ? 'think' : state === 'ready' ? 'ready' : engaged || state === 'attentive' ? 'listen' : 'peek'
  useEffect(() => {
    // SVG image load events can be missed on cached route remounts. Preload the
    // shared atlas through HTMLImageElement, which also handles a warm cache.
    const image = new Image()
    let active = true
    image.src = '/images/scout/scout-body-poses.png'
    void image.decode().then(() => { if (active) setLoaded(true) }).catch(() => { /* The SVG load event remains a fallback. */ })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const update = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return (
    <svg className={styles.scout} data-state={state} data-pose={pose} data-paused={hidden} data-pointing={pointing} data-loaded={loaded}
      viewBox="0 45 627 560" fill="none" aria-hidden="true" focusable="false"
      style={{ '--gaze-x': `${gaze.x}px`, '--gaze-y': `${gaze.y}px` } as CSSProperties}
      onPointerMove={e => {
        if (e.pointerType !== 'mouse') return
        const r = e.currentTarget.getBoundingClientRect()
        setPointing(true)
        setGaze({ x: ((e.clientX - r.left) / r.width - .5) * 25, y: ((e.clientY - r.top) / r.height - .5) * 14 })
      }}
      onPointerLeave={() => { setPointing(false); setGaze({ x: 0, y: 0 }) }}>
      <defs>
        <radialGradient id={`${id}-pupil`} cx=".35" cy=".2" r=".85"><stop stopColor="#243B5D" /><stop offset="1" stopColor="#071326" /></radialGradient>
        <linearGradient id={`${id}-lid`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#F6F7FA" /><stop offset="1" stopColor="#DADEE6" /></linearGradient>
        <clipPath id={`${id}-frame`}><rect x="0" y="42" width="655" height="563" /></clipPath>
        {POSES.flatMap(p => p.eyes.map((x, i) => <clipPath key={`${p.name}-${i}`} id={`${id}-${p.name}-${i}`}><ellipse cx={x} cy={p.eyeY} rx="45" ry="40" /></clipPath>))}
      </defs>
      <g className={styles.body}>
        <g className={styles.reaction}>
          {POSES.map(p => <g key={p.name} className={styles.pose} data-art={p.name} clipPath={`url(#${id}-frame)`}>
            <image onLoad={() => setLoaded(true)} href="/images/scout/scout-body-poses.png" x={-p.x} y={-p.y} width="1254" height="1254" />
            {p.eyes.map((x, i) => <g key={i} clipPath={`url(#${id}-${p.name}-${i})`}>
              <g className={styles.eyeMotion}><g className={styles.pupils}>
                <ellipse cx={x} cy={p.eyeY} rx="27" ry="34" fill={`url(#${id}-pupil)`} />
                <ellipse cx={x + 8} cy={p.eyeY - 17} rx="5" ry="6" fill="#FFFFFF" opacity=".9" />
              </g></g>
              <g className={styles.lid} style={{ transformOrigin: `${x}px ${p.eyeY - 43}px` }}>
                <rect x={x - 48} y={p.eyeY - 44} width="96" height="88" rx="15" fill={`url(#${id}-lid)`} />
                <path d={`M${x - 43} ${p.eyeY + 16} Q${x} ${p.eyeY + 29} ${x + 43} ${p.eyeY + 16}`} stroke="#152743" strokeWidth="4" strokeLinecap="round" />
              </g>
            </g>)}
          </g>)}
        </g>
      </g>
    </svg>
  )
}
