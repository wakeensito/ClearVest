import { lazy, Suspense, useId, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Link } from 'react-router'
import { suggestedLesson } from '../../lib/lessonSuggestions'
import type { ChatMessage } from './chatContext'
import styles from './ReplyLearning.module.css'

const LearningPractice = lazy(() => import('../learn/LearningPractice').then(module => ({ default: module.LearningPractice })).catch(() => ({ default: PracticeUnavailable })))
function PracticeUnavailable() { return <p>Practice couldn’t load. Open the linked lesson, or reload this page to try again.</p> }

export function ReplyLearning({ message, onOpenLesson }: { message: ChatMessage; onOpenLesson?: () => void }) {
  const lesson = suggestedLesson(message)
  const [open, setOpen] = useState(false)
  const id = useId()
  if (!lesson) return null
  return <section className={styles.learning} aria-labelledby={id}>
    <h3 id={id}><BookOpen size={16} aria-hidden />Keep learning</h3>
    <p className={styles.intro}>Turn this idea into something you can explain.</p>
    <Link className={styles.lesson} to={`/learn/${lesson.id}?from=scout`} onClick={onOpenLesson}>{lesson.title}<span>{lesson.minutes} min lesson</span></Link>
    <details onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>Try a quick check</summary>
      {open && <Suspense fallback={<p role="status">Loading your quick check…</p>}><LearningPractice key={lesson.id} lesson={lesson} /></Suspense>}
    </details>
  </section>
}
