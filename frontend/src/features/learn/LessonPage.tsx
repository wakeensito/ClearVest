import { ArrowLeft, Check, Flame, MessageCircle, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button, ButtonLink } from '../../components/ui/Button'
import { findLesson, ALL_LESSONS } from '../../lib/lessons'
import { completeLesson, currentStreak, loadProgress, saveProgress } from '../../lib/learnProgress'
import styles from './Learn.module.css'

export function LessonPage() {
  const { lessonId } = useParams()
  const found = findLesson(lessonId)
  // Remount on lesson change so step, answers and score reset.
  return found ? <LessonPlayer key={found.lesson.id} {...found} /> : <MissingLesson />
}

function MissingLesson() {
  return <div className={styles.lessonShell}>
    <h1 className={styles.lessonTitle}>We couldn’t find that lesson.</h1>
    <ButtonLink to="/learn" variant="primary">Back to Learn</ButtonLink>
  </div>
}

function LessonPlayer({ lesson, unit, index }: NonNullable<ReturnType<typeof findLesson>>) {
  const total = lesson.cards.length + lesson.quiz.length
  const [step, setStep] = useState(0)
  const [choice, setChoice] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const [streak, setStreak] = useState<number | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const finished = step >= total
  const next = ALL_LESSONS[index + 1]

  // Move focus to the new step's heading so keyboard and screen-reader users follow along.
  useEffect(() => { headingRef.current?.focus() }, [step])

  const advance = () => {
    // Record completion in the handler (not an effect) the moment the last step is passed.
    if (step + 1 === total) {
      const now = new Date()
      const updated = completeLesson(loadProgress(), lesson.id, now)
      saveProgress(updated)
      setStreak(currentStreak(updated, now))
    }
    setChoice(null)
    setStep(step + 1)
  }
  const card = lesson.cards[step]
  const question = step >= lesson.cards.length ? lesson.quiz[step - lesson.cards.length] : undefined
  const answered = choice !== null
  const advisorLink = `/advisor?q=${encodeURIComponent(lesson.askPrompt)}`

  return <div className={styles.lessonShell}>
    <div className={styles.lessonTop}>
      <Link to="/learn" className={styles.exit} aria-label="Exit lesson and return to Learn"><X size={20} aria-hidden /></Link>
      <div className={styles.progressTrack} role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(step, total)}>
        <span style={{ width: `${(Math.min(step, total) / total) * 100}%` }} />
      </div>
    </div>
    <p className={styles.lessonMeta}>{unit.title} · Lesson {index + 1} of {ALL_LESSONS.length}</p>

    {card && <section className={styles.stage} aria-labelledby="step-heading">
      <p className={styles.stepLabel}>{lesson.title} · {step + 1} of {lesson.cards.length}</p>
      <h1 id="step-heading" ref={headingRef} tabIndex={-1} className={styles.lessonTitle}>{card.heading}</h1>
      <p className={styles.cardBody}>{card.body}</p>
      {card.example && <p className={styles.cardExample}><strong>Example</strong>{card.example}</p>}
      <div className={styles.stageActions}>
        {step > 0 && <Button onClick={() => setStep((s) => s - 1)} icon={<ArrowLeft size={16} aria-hidden />}>Back</Button>}
        <Button variant="primary" onClick={advance}>{step + 1 === lesson.cards.length ? 'Check what you learned' : 'Continue'}</Button>
      </div>
    </section>}

    {question && <section className={styles.stage} aria-labelledby="step-heading">
      <p className={styles.stepLabel}>Quick check · {step - lesson.cards.length + 1} of {lesson.quiz.length}</p>
      <h1 id="step-heading" ref={headingRef} tabIndex={-1} className={styles.lessonTitle}>{question.question}</h1>
      <div className={styles.options} role="group" aria-label="Answer choices">
        {question.options.map((option, i) => {
          const state = !answered ? '' : i === question.answer ? styles.optionRight : i === choice ? styles.optionWrong : styles.optionMuted
          return <button key={option} type="button" className={`${styles.option} ${state}`} disabled={answered}
            aria-pressed={choice === i}
            onClick={() => { setChoice(i); if (i === question.answer) setCorrect((c) => c + 1) }}>
            <span className={styles.optionKey} aria-hidden>{String.fromCharCode(65 + i)}</span>{option}
            {answered && i === question.answer && <Check size={18} aria-label="Correct answer" className={styles.optionIcon} />}
          </button>
        })}
      </div>
      <div aria-live="polite">
        {answered && <div className={`${styles.feedback} ${choice === question.answer ? styles.feedbackRight : styles.feedbackWrong}`}>
          <strong>{choice === question.answer ? 'Nice, that’s right.' : 'Not quite.'}</strong>
          <p>{question.explain}</p>
        </div>}
      </div>
      <div className={styles.stageActions}>
        <Button variant="primary" onClick={advance} disabled={!answered}>{step + 1 === total ? 'Finish lesson' : 'Continue'}</Button>
      </div>
    </section>}

    {finished && <section className={`${styles.stage} ${styles.done}`} aria-labelledby="step-heading">
      <span className={styles.doneBadge} aria-hidden><Check size={28} /></span>
      <h1 id="step-heading" ref={headingRef} tabIndex={-1} className={styles.lessonTitle}>Lesson complete</h1>
      <p className={styles.cardBody}>You got {correct} of {lesson.quiz.length} questions right{correct === lesson.quiz.length ? '. Great work.' : '. Every mistake is part of learning.'}</p>
      {streak !== null && streak > 0 && <p className={styles.streakNote}><Flame size={18} aria-hidden />{streak}-day learning streak</p>}
      <div className={styles.stageActions}>
        {next && <ButtonLink to={`/learn/${next.id}`} variant="primary" arrow>Next: {next.title}</ButtonLink>}
        <ButtonLink to={advisorLink} icon={<MessageCircle size={16} aria-hidden />}>Ask the advisor about this</ButtonLink>
        <ButtonLink to="/learn" variant={next ? 'tertiary' : 'primary'}>{next ? 'Back to Learn' : 'See your progress'}</ButtonLink>
      </div>
    </section>}

    <p className={styles.source}>Educational information, not financial advice. Investing involves risk, including loss of principal.</p>
  </div>
}
