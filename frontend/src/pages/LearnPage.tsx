import { ArrowUpRight, BookOpen, Check, Clock, Flame, MessageCircle, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { ButtonLink } from '../components/ui/Button'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Flashcards } from '../features/learn/Flashcards'
import { GrowthCalculator } from '../features/learn/GrowthCalculator'
import { FAQ } from '../lib/faq'
import { filterTerms, GLOSSARY_SOURCE, LEARNING_SOURCE } from '../lib/learning'
import { currentStreak, loadProgress, resetProgress, EMPTY_PROGRESS } from '../lib/learnProgress'
import { ALL_LESSONS, nextLesson, UNITS } from '../lib/lessons'
import styles from './LearnPage.module.css'

const ask = (prompt: string) => `/advisor?q=${encodeURIComponent(prompt)}`

export function LearnPage() {
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'browse' | 'flashcards'>('browse')
  const [progress, setProgress] = useState(loadProgress)
  const terms = filterTerms(search)
  const done = progress.completed.filter((id) => ALL_LESSONS.some((l) => l.id === id)).length
  const upNext = nextLesson(progress.completed)
  const streak = currentStreak(progress, new Date())

  return <div className={styles.page}>
    <header className={styles.hero}>
      <div className={styles.intro}>
        <BookOpen size={24} aria-hidden />
        <h1>Investing, in your own words.</h1>
        <p>Never invested before? You’re in the right place. Short lessons, a few quick questions, no jargon and no account needed.</p>
        <div className={styles.heroStats}>
          <span><strong>{done}</strong> of {ALL_LESSONS.length} lessons done</span>
          <span><Flame size={16} aria-hidden /><strong>{streak}-day</strong> streak</span>
        </div>
        <div className={styles.meter} role="progressbar" aria-label="Starter path progress" aria-valuemin={0} aria-valuemax={ALL_LESSONS.length} aria-valuenow={done}>
          <span style={{ width: `${(done / ALL_LESSONS.length) * 100}%` }} />
        </div>
        <div className={styles.heroActions}>
          {upNext ? <ButtonLink to={`/learn/${upNext.id}`} variant="primary" arrow>{done === 0 ? 'Start your first lesson' : `Continue: ${upNext.title}`}</ButtonLink>
            : <p className={styles.allDone}><Check size={18} aria-hidden />You finished the starter path. Review any lesson below.</p>}
          <a href="#glossary">Find a term in the glossary</a>
        </div>
      </div>
      <img src="/images/valley-path.webp" width="2172" height="724" alt="" className={styles.landscape} />
    </header>

    <section aria-labelledby="path-title">
      <div className={styles.sectionHead}>
        <div><h2 id="path-title" className="t-h2">Your starter path</h2><p>Four short units. Go in order or jump to what you’re curious about.</p></div>
        {done > 0 && <button type="button" className={styles.linkButton} onClick={() => { resetProgress(); setProgress(EMPTY_PROGRESS) }}>Reset progress</button>}
      </div>
      <ol className={styles.units}>
        {UNITS.map((unit, u) => {
          const unitDone = unit.lessons.filter((l) => progress.completed.includes(l.id)).length
          return <li key={unit.id} className={styles.unit}>
            <div className={styles.unitHead}>
              <span className={styles.unitNumber}>Unit {u + 1}</span>
              <h3>{unit.title}</h3>
              <p>{unit.summary}</p>
              <p className={styles.unitCount}>{unitDone} of {unit.lessons.length} done</p>
            </div>
            <ul className={styles.lessons}>
              {unit.lessons.map((lesson) => {
                const complete = progress.completed.includes(lesson.id)
                const isNext = upNext?.id === lesson.id
                return <li key={lesson.id}>
                  <Link to={`/learn/${lesson.id}`} className={`${styles.lesson} ${isNext ? styles.lessonNext : ''}`}>
                    <span className={`${styles.lessonDot} ${complete ? styles.lessonDotDone : ''}`} aria-hidden>{complete ? <Check size={14} /> : null}</span>
                    <span className={styles.lessonText}>
                      <span className={styles.lessonName}>{lesson.title}</span>
                      <span className={styles.lessonMeta}><Clock size={12} aria-hidden />{lesson.minutes} min{complete ? ' · Completed' : isNext ? ' · Up next' : ''}</span>
                    </span>
                    <ArrowUpRight size={16} aria-hidden className={styles.lessonArrow} />
                  </Link>
                </li>
              })}
            </ul>
          </li>
        })}
      </ol>
    </section>

    <section className={styles.panel} aria-labelledby="faq-title">
      <h2 id="faq-title" className="t-h2">Questions beginners ask</h2>
      <p className={styles.panelIntro}>No question is too basic. These are the ones people ask most.</p>
      <div className={styles.faq}>
        {FAQ.map(({ question, answer }) => <details key={question}>
          <summary>{question}</summary>
          <div><p>{answer}</p><Link to={ask(`${question} Explain it for a beginner, based on my situation if you can.`)}><MessageCircle size={14} aria-hidden />Ask a follow-up</Link></div>
        </details>)}
      </div>
    </section>

    <section className={styles.panel} aria-labelledby="growth-title">
      <h2 id="growth-title" className="t-h2">See what time can do</h2>
      <p className={styles.panelIntro}>Move the sliders to see how small, steady amounts can grow. Try the same amount over 10 years and then 30.</p>
      <GrowthCalculator />
    </section>

    <section id="glossary" className={styles.glossary} aria-labelledby="glossary-title">
      <div className={styles.glossaryHeader}>
        <div><h2 id="glossary-title" className="t-h2">A little less jargon</h2><p>Look up a word, or practice with flashcards.</p></div>
        <SegmentedControl label="Glossary view" options={[{ value: 'browse', label: 'Browse' }, { value: 'flashcards', label: 'Flashcards' }]} value={mode} onChange={setMode} />
      </div>
      {mode === 'browse' ? <>
        <label className={styles.search}><Search size={18} aria-hidden /><span className="sr-only">Search investing terms</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Try “ETF” or “risk”" /></label>
        <p className={styles.count} role="status">{terms.length} {terms.length === 1 ? 'term' : 'terms'}{search.trim() ? ' found' : ' to explore'}</p>
        <div className={styles.terms}>{terms.map(({ term, meaning, example }) => <details key={term}><summary>{term}</summary><div><p>{meaning}</p><p className={styles.example}>{example}</p><Link to={ask(`Explain ${term.toLowerCase()} with a simple example.`)}>Ask for an example</Link></div></details>)}</div>
        {!terms.length && <div className={styles.empty}><p>No matching terms yet. Try a shorter word or ask the advisor.</p><button type="button" onClick={() => setSearch('')}>Clear search</button></div>}
      </> : <Flashcards />}
      <p className={styles.source}>Definitions adapted in plain language. <a href={GLOSSARY_SOURCE} target="_blank" rel="noreferrer">Explore Investor.gov’s glossary</a> or its <a href={LEARNING_SOURCE} target="_blank" rel="noreferrer">introduction to investing</a>.</p>
    </section>
    <p className={styles.source}>Educational information, not financial advice. Investing involves risk, including loss of principal. Progress is saved on this device only.</p>
  </div>
}
