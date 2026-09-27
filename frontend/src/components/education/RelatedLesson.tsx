import { BookOpen } from 'lucide-react'
import { Link } from 'react-router'
import { relatedLesson } from '../../lib/explainTerms'
import styles from './RelatedLesson.module.css'

/** "Related lesson: …" under text that mentions a term a starter lesson teaches. Renders nothing otherwise. */
export function RelatedLesson({ text, fallback }: { text: string; fallback?: { id: string; title: string } }) {
  const lesson = relatedLesson(text) ?? fallback
  if (!lesson) return null
  return <Link to={`/learn/${lesson.id}`} className={styles.related}>
    <BookOpen size={16} aria-hidden />
    <span><span className={styles.label}>Related lesson</span> {lesson.title}</span>
  </Link>
}
