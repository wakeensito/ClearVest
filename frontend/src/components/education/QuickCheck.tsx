import { useId, useState } from 'react'
import { markResearchProgress, type ResearchMilestone } from '../../lib/researchProgress'
import styles from './QuickCheck.module.css'

export function QuickCheck({ question, answers, milestone }: { question: string; answers: { text: string; explanation: string; correct: boolean }[]; milestone: ResearchMilestone }) {
  const [selected, setSelected] = useState<number | null>(null)
  const id = useId()
  return <section className={styles.check} aria-labelledby={id}>
    <h3 id={id}>Try it: {question}</h3>
    <div className={styles.options}>{answers.map((answer, index) => <button key={answer.text} aria-pressed={selected === index} onClick={() => { setSelected(index); if (answer.correct) markResearchProgress(milestone) }}>{answer.text}</button>)}</div>
    <div className={styles.feedback} role="status">{selected !== null && <p><strong>{answers[selected]!.correct ? 'You’ve got it. ' : 'Let’s work through it. '}</strong>{answers[selected]!.explanation}{answers[selected]!.correct && <span className={styles.saved}> Research milestone completed.</span>}</p>}</div>
  </section>
}
