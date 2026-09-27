import { ArrowLeft, Check, MessageCircle, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useHoldings } from '../../api/queries'
import { Button, ButtonLink } from '../../components/ui/Button'
import { currencyWhole, date, percentFromFraction } from '../../lib/format'
import { heldFund } from '../../lib/fundPlay'
import { LEARNING_SOURCE } from '../../lib/learning'
import { findLesson, ALL_LESSONS, type FundPlay } from '../../lib/lessons'
import { completeLesson, loadProgress, saveProgress } from '../../lib/learnProgress'
import { FundStrip } from './FundStrip'
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
  // A "play" lesson swaps the quiz for the fund's decisions; everything else (cards, progress) is the same.
  const play = lesson.play
  const questions = play?.decisions ?? lesson.quiz
  const total = lesson.cards.length + questions.length
  const [step, setStep] = useState(0)
  const [choice, setChoice] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
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
    }
    setChoice(null)
    setStep(step + 1)
  }
  const replay = () => { setChoice(null); setCorrect(0); setStep(0) }
  const card = lesson.cards[step]
  const question = step >= lesson.cards.length ? questions[step - lesson.cards.length] : undefined
  const decision = play && question ? play.decisions[step - lesson.cards.length] : undefined
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
      {play && <FundStrip play={play} />}
      <div className={styles.stageActions}>
        {step > 0 && <Button onClick={() => setStep((s) => s - 1)} icon={<ArrowLeft size={16} aria-hidden />}>Back</Button>}
        <Button variant="primary" onClick={advance}>{step + 1 !== lesson.cards.length ? 'Continue' : play ? 'Make your first call' : 'Check what you learned'}</Button>
      </div>
    </section>}

    {question && <section className={styles.stage} aria-labelledby="step-heading">
      <p className={styles.stepLabel}>{decision ? 'Decision' : 'Quick check'} · {step - lesson.cards.length + 1} of {questions.length}</p>
      <h1 id="step-heading" ref={headingRef} tabIndex={-1} className={styles.lessonTitle}>{question.question}</h1>
      {decision && <p className={styles.situation}>{decision.situation}</p>}
      {play && <FundStrip play={play} focus={decision?.focus} />}
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
          <strong>{decision ? (choice === question.answer ? 'That’s the fund’s call.' : 'The fund’s call is different.') : choice === question.answer ? 'Nice, that’s right.' : 'Not quite.'}</strong>
          <p>{question.explain}</p>
          {decision && <p className={styles.payoff}>{decision.payoff}</p>}
        </div>}
      </div>
      <div className={styles.stageActions}>
        <Button variant="primary" onClick={advance} disabled={!answered}>{step + 1 === total ? 'Finish lesson' : 'Continue'}</Button>
      </div>
    </section>}

    {finished && <section className={`${styles.stage} ${styles.done}`} aria-labelledby="step-heading">
      <span className={styles.doneBadge} aria-hidden><Check size={28} /></span>
      <h1 id="step-heading" ref={headingRef} tabIndex={-1} className={styles.lessonTitle}>Lesson complete</h1>
      {play
        ? <p className={styles.cardBody}>You made {correct} of {questions.length} fund calls{correct === questions.length ? '. You ran it exactly like the index does.' : '. The fund would have made every call the same way, every time.'}</p>
        : <p className={styles.cardBody}>You got {correct} of {questions.length} questions right{correct === questions.length ? '. Great work.' : '. Every mistake is part of learning.'}</p>}
      {play ? <FundPayoff play={play} /> : <p className={styles.source}>Every idea counts. Come back whenever you’re ready.</p>}
      <div className={styles.stageActions}>
        {play && <Button onClick={replay} icon={<RotateCcw size={16} aria-hidden />}>Play again</Button>}
        {next && <ButtonLink to={`/learn/${next.id}`} variant="primary" arrow>Next: {next.title}</ButtonLink>}
        {lesson.id === 'stocks-and-bonds' && <ButtonLink to="/markets?symbol=AAPL&guided=1">Try reading a real company</ButtonLink>}
        <ButtonLink to={advisorLink} icon={<MessageCircle size={16} aria-hidden />}>Ask the advisor about this</ButtonLink>
        <ButtonLink to="/learn" variant={next ? 'tertiary' : 'primary'}>{next ? 'Back to Learn' : 'See your progress'}</ButtonLink>
      </div>
    </section>}

    <details className={styles.lessonSources}><summary>Learning sources</summary><p><a href={LEARNING_SOURCE} target="_blank" rel="noreferrer">Investor.gov introduction to investing</a></p>{['employer-plans', 'roth-vs-traditional'].includes(lesson.id) && <p><a href="https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500" target="_blank" rel="noreferrer">IRS contribution limits for 2026</a></p>}</details>
    <p className={styles.source}>Educational information, not financial advice. Investing involves risk, including loss of principal.</p>
  </div>
}

/**
 * Ties the fund back to the user. The generic line shows at once; it becomes personal only when the
 * holdings query resolves and includes the fund. Loading, errors, no account: the generic line stays.
 * Mounted only on the score screen, so the lesson itself never calls the API.
 */
function FundPayoff({ play }: { play: FundPlay }) {
  const { data } = useHoldings()
  const held = heldFund(play, data?.holdings)
  const company = play.holdings.find((h) => h.symbol === play.spotlight)?.name ?? play.spotlight
  const weight = percentFromFraction(held?.weight ?? play.holdings.find((h) => h.symbol === play.spotlight)?.weight)
  return <div className={styles.cardExample}>
    <strong>What this means for you</strong>
    {held
      ? <span>You hold {currencyWhole(held.held)} of {play.fund}. About {currencyWhole(held.inside)} of that is {company}, whether you chose it or not.</span>
      : <span>If you own {play.fund}, about {weight} of that money is {company}, whether you chose it or not.</span>}
    <span className={styles.asOf}>Weights as of {date(play.asOf)}, from the fund’s published top ten.</span>
  </div>
}
