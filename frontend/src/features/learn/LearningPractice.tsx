import { useId, useState } from 'react'
import type { Lesson } from '../../lib/lessons'
import { savePractice } from '../../lib/practiceProgress'
import { usePracticeProgress } from '../../lib/usePracticeProgress'
import styles from './LearningPractice.module.css'

/** Practice is separate from lesson completion. Written explanations stay in memory only. */
export function LearningPractice({ lesson }: { lesson: Lesson }) {
  const id = useId()
  const progress = usePracticeProgress().find(item => item.lessonId === lesson.id)
  const [questionIndex, setQuestionIndex] = useState(() => lesson.quiz.findIndex((_, index) => progress?.answers[index] === undefined) < 0 ? 0 : lesson.quiz.findIndex((_, index) => progress?.answers[index] === undefined))
  const [choice, setChoice] = useState<number | null>(null)
  const [explanation, setExplanation] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [reflection, setReflection] = useState<'explained' | 'revisit'>()
  const question = lesson.quiz[questionIndex]!
  const correct = choice === question.answer
  const nextQuestion = () => { setQuestionIndex(index => (index + 1) % lesson.quiz.length); setChoice(null) }

  return <div className={styles.practice}>
    <fieldset className={styles.question}>
      <legend>{question.question}</legend>
      <p className={styles.note}>Try it before opening the lesson. Your first answer to each question is saved for review.</p>
      <div className={styles.options}>{question.options.map((option, index) => <button key={option} type="button" disabled={choice !== null} aria-pressed={choice === index}
        onClick={() => { setChoice(index); savePractice(lesson.id, { question: questionIndex, correct: index === question.answer }) }}>{option}</button>)}</div>
    </fieldset>
    <div role="status">{choice !== null && <div className={styles.feedback}>
      <strong>{correct ? 'You’ve got the idea.' : 'Let’s look at that again.'}</strong><p>{question.explain}</p>
      {lesson.quiz.length > 1 && <button type="button" className={styles.textButton} onClick={nextQuestion}>Try another question</button>}
    </div>}</div>
    {choice !== null && <section className={styles.reflection} aria-labelledby={`${id}-title`}>
      <h4 id={`${id}-title`}>Explain it in your own words</h4>
      <label htmlFor={`${id}-explanation`}>How would you explain “{lesson.title}” to a friend? Include an example and one limitation.</label>
      <textarea id={`${id}-explanation`} rows={3} maxLength={800} value={explanation} placeholder="The way I understand it…"
        onChange={event => { setExplanation(event.target.value); setReviewing(false); setReflection(undefined) }} />
      <p className={styles.note}>Your writing stays here and is not sent or saved. Only your quiz result and self-review choice are saved in this browser.</p>
      <button type="button" className={styles.action} disabled={!explanation.trim()} onClick={() => setReviewing(true)}>Compare with the key ideas</button>
      {reviewing && <div className={styles.review}>
        <p>Check your explanation against these ideas from the lesson:</p>
        <ul>{lesson.cards.map(card => <li key={card.heading}>{card.body}</li>)}</ul>
        <p className={styles.note}>This is your self-review, not an AI grade. Different wording is fine.</p>
        <div className={styles.reviewActions} role="group" aria-label="Review your explanation">
          <button type="button" aria-pressed={reflection === 'explained'} onClick={() => { setReflection('explained'); savePractice(lesson.id, { reflection: 'explained' }) }}>I explained the key ideas</button>
          <button type="button" aria-pressed={reflection === 'revisit'} onClick={() => { setReflection('revisit'); savePractice(lesson.id, { reflection: 'revisit' }) }}>I’d like more practice</button>
        </div>
        <p role="status">{reflection === 'explained' ? 'Self-review saved. Try explaining it again another day.' : reflection === 'revisit' ? 'Saved for review. The full lesson can help fill in the gaps.' : ''}</p>
      </div>}
    </section>}
  </div>
}
