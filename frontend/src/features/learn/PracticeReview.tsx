import { useState } from 'react'
import { Link } from 'react-router'
import { findLesson } from '../../lib/lessons'
import { resetPractice } from '../../lib/practiceProgress'
import { usePracticeProgress } from '../../lib/usePracticeProgress'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import styles from './PracticeReview.module.css'

export function PracticeReview() {
  const progress = usePracticeProgress()
  const [confirm, setConfirm] = useState(false)
  if (!progress.length) return null
  const results = progress.flatMap(item => Object.values(item.answers))
  return <section className={styles.review} aria-labelledby="practice-review-title">
    <div className={styles.heading}><h2 id="practice-review-title">What you’re learning with Scout</h2><button onClick={() => setConfirm(true)}>Reset practice</button></div>
    <p>{results.filter(Boolean).length} of {results.length} quick checks correct on your first try.</p>
    <p className={styles.note}>Use these results to choose what to revisit. A self-review is your reflection, not a score or proof of mastery. Quick checks do not complete lessons.</p>
    <ul>{progress.map(item => {
      const lesson = findLesson(item.lessonId)!.lesson
      const needsReview = Object.values(item.answers).some(correct => !correct) || item.reflection === 'revisit'
      return <li key={item.lessonId}><Link to={`/learn/${item.lessonId}?from=scout`}>{lesson.title}</Link><span>{needsReview ? 'Worth another look' : 'Keep practicing'}{item.reflection === 'explained' ? ' · You reviewed your explanation' : ''}</span></li>
    })}</ul>
    <p className={styles.note}>Results stay in this browser for this demo user. If storage is blocked, they last until you reload.</p>
    <ConfirmDialog open={confirm} title="Reset practice results?" confirmLabel="Reset practice" onClose={() => setConfirm(false)} onConfirm={() => { resetPractice(); setConfirm(false) }}>Your quick-check results and self-reviews will be cleared. Completed lessons stay as they are.</ConfirmDialog>
  </section>
}
