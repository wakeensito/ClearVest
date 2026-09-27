import { ArrowRight, X } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { explainPieces, learnLink, type Explainer } from '../../lib/explainTerms'
import styles from './Term.module.css'

const WIDTH = 300
const GAP = 16

/** A jargon word with a dotted underline. Tapping it opens a small plain-language explanation. */
export function Term({ text, explainer }: { text: string; explainer: Explainer }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number }>({ left: 0, width: WIDTH })
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const id = useId()
  const link = learnLink(explainer)

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) button.current?.focus()
  }, [])

  // Measure on open: below the word, or above it when the word sits in the lower part of the screen.
  const toggle = () => {
    if (open) { setOpen(false); return }
    const rect = button.current?.getBoundingClientRect()
    if (rect) {
      const width = Math.min(WIDTH, window.innerWidth - GAP * 2)
      const left = Math.min(Math.max(rect.left, GAP), window.innerWidth - width - GAP)
      setPos(rect.bottom > window.innerHeight * 0.6 ? { left, width, bottom: window.innerHeight - rect.top + 8 } : { left, width, top: rect.bottom + 8 })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    // Move focus into the explanation so keyboard and screen-reader users land on it.
    closeButton.current?.focus({ preventScroll: true })
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!panel.current?.contains(target) && !button.current?.contains(target)) close(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(true) }
    const onScroll = () => close(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, close])

  return <>
    <button ref={button} type="button" className={styles.term} aria-expanded={open} aria-controls={open ? id : undefined}
      aria-label={`${text}: what does this mean?`} onClick={toggle}>{text}</button>
    {open && createPortal(
      <div ref={panel} id={id} role="dialog" aria-label={`${explainer.label} explained`} className={styles.panel}
        style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width }}>
        <div className={styles.head}>
          <strong>{explainer.label}</strong>
          <button ref={closeButton} type="button" className={styles.close} onClick={() => close(true)} aria-label="Close explanation"><X size={16} aria-hidden /></button>
        </div>
        <p>{explainer.meaning}</p>
        <Link to={link.href} className={styles.learn} onClick={() => setOpen(false)}>{link.label}<ArrowRight size={14} aria-hidden /></Link>
      </div>,
      document.body,
    )}
  </>
}

/** A short text (one paragraph) with its investing terms made tappable, each term once. */
export function ExplainText({ text }: { text: string }) {
  return <>{explainPieces(text).map((piece, i) =>
    typeof piece === 'string' ? piece : <Term key={i} text={piece.text} explainer={piece.explainer} />)}</>
}
