import { ArrowLeft, RotateCcw, Shuffle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { TERMS } from '../../lib/learning'
import styles from './Learn.module.css'

type Term = (typeof TERMS)[number]

function shuffled(list: readonly Term[]): Term[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = copy[i]
    const b = copy[j]
    if (a && b) { copy[i] = b; copy[j] = a }
  }
  return copy
}

/** Quizlet-style review of the glossary: see the term, recall it, then reveal the meaning. */
export function Flashcards() {
  const [deck, setDeck] = useState<Term[]>(() => [...TERMS])
  const [position, setPosition] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [known, setKnown] = useState<ReadonlySet<string>>(new Set())
  const card = deck[position]
  if (!card) return null

  const go = (delta: number) => { setRevealed(false); setPosition((p) => (p + delta + deck.length) % deck.length) }
  const mark = (knowIt: boolean) => {
    setKnown((prev) => { const s = new Set(prev); if (knowIt) s.add(card.term); else s.delete(card.term); return s })
    go(1)
  }

  return <div className={styles.flash}>
    <div className={styles.flashHeader}>
      <p className={styles.count} role="status">Card {position + 1} of {deck.length} · {known.size} marked as known</p>
      <div className={styles.flashTools}>
        <Button size="compact" variant="tertiary" icon={<Shuffle size={14} aria-hidden />} onClick={() => { setDeck(shuffled(TERMS)); setPosition(0); setRevealed(false) }}>Shuffle</Button>
        <Button size="compact" variant="tertiary" icon={<RotateCcw size={14} aria-hidden />} onClick={() => { setKnown(new Set()); setPosition(0); setRevealed(false) }}>Start over</Button>
      </div>
    </div>
    <button type="button" className={`${styles.flashCard} ${revealed ? styles.flashRevealed : ''}`} onClick={() => setRevealed((r) => !r)}
      aria-label={revealed ? `${card.term}: ${card.meaning}. Select to show the term only.` : `${card.term}. Select to reveal the meaning.`}>
      <span className={styles.flashTerm}>{card.term}</span>
      {revealed ? <><span className={styles.flashMeaning}>{card.meaning}</span><span className={styles.flashExample}>{card.example}</span></>
        : <span className={styles.flashHint}>Think of what it means, then tap to check</span>}
    </button>
    <div className={styles.flashActions}>
      <Button onClick={() => go(-1)} icon={<ArrowLeft size={16} aria-hidden />} aria-label="Previous card">Previous</Button>
      {revealed ? <>
        <Button onClick={() => mark(false)}>Still learning</Button>
        <Button variant="primary" onClick={() => mark(true)}>I knew it</Button>
      </> : <Button variant="primary" onClick={() => setRevealed(true)}>Reveal meaning</Button>}
      <Button onClick={() => go(1)} arrow aria-label="Next card">Next</Button>
    </div>
  </div>
}
