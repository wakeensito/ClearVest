import { ArrowRight, BookOpen, GraduationCap } from 'lucide-react'
import { Link } from 'react-router'
import { ButtonLink } from '../ui/Button'
import { CLUES, GUIDED_RESEARCH, professorLink } from '../../lib/companyClues'
import styles from './CompanyClues.module.css'

export function CompanyClues({ lesson }: { lesson?: { id: string; title: string; started: boolean } }) {
  return <section className={styles.clues} aria-labelledby="clues-title">
    <span className={styles.eyebrow}>The next question everyone asks</span>
    <h3 id="clues-title">So how do investors spot sturdier companies?</h3>
    <p className={styles.lead}>No one can predict which stocks will fall. But investors check a few clues that a business is on solid ground. These four come from a company’s financial statements, and you can learn to read all of them.</p>
    <ol className={styles.grid}>
      {CLUES.map((clue, index) => <li key={clue.term}>
        <span className={styles.number} aria-hidden>{index + 1}</span>
        <strong>{clue.question}</strong>
        <span className={styles.term}>Look at: {clue.term}</span>
        <p>{clue.body}</p>
      </li>)}
    </ol>
    <p className={styles.caution}>Good clues lower the odds of surprises. They never guarantee a price won’t drop, which is why investors also spread their money across many companies.</p>
    <div className={styles.actions}>
      <ButtonLink to={GUIDED_RESEARCH} variant="primary" arrow>Check these clues on Apple</ButtonLink>
      <ButtonLink to={professorLink} icon={<GraduationCap size={16} aria-hidden />}>Ask the professor to explain</ButtonLink>
    </div>
    {lesson && <Link to={`/learn/${lesson.id}`} className={styles.lesson}>
      <BookOpen size={20} aria-hidden />
      <span className={styles.lessonText}>
        <span className={styles.lessonLabel}>{lesson.started ? 'Keep going in Learn' : 'Or build the basics first · 3 minutes'}</span>
        <span className={styles.lessonTitle}>Next: {lesson.title}<ArrowRight size={18} aria-hidden /></span>
      </span>
    </Link>}
  </section>
}
