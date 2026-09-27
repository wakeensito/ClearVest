import { ArrowUpRight, BookOpen, Check, Clock, MessageCircle, Play, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ButtonLink } from '../components/ui/Button'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Flashcards } from '../features/learn/Flashcards'
import { GrowthCalculator } from '../features/learn/GrowthCalculator'
import { examplesFor } from '../lib/curatedFunds'
import { FAQ } from '../lib/faq'
import { filterTerms, GLOSSARY_SOURCE, LEARNING_SOURCE } from '../lib/learning'
import { resetProgress } from '../lib/learnProgress'
import { useLearnProgress } from '../lib/useLearnProgress'
import { ALL_LESSONS, nextLesson, PLAY_LESSON, UNITS } from '../lib/lessons'
import styles from './LearnPage.module.css'

const ask = (prompt: string) => `/advisor?q=${encodeURIComponent(prompt)}`

export function LearnPage() {
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'browse' | 'flashcards'>('browse')
  const progress = useLearnProgress()
  const [confirmReset, setConfirmReset] = useState(false)
  const [showAllTerms, setShowAllTerms] = useState(false)
  const terms = filterTerms(search)
  const done = progress.completed.filter((id) => ALL_LESSONS.some((l) => l.id === id)).length
  const upNext = nextLesson(progress.completed)
  const played = PLAY_LESSON ? progress.completed.includes(PLAY_LESSON.id) : false
  const visibleTerms = search.trim() || showAllTerms ? terms : terms.slice(0, 6)

  return <div className={styles.page}>
    <header className={styles.hero}>
      <div className={styles.intro}>
        <BookOpen size={24} aria-hidden />
        <h1>Investing, in your own words.</h1>
        <p>Never invested before? You’re in the right place. Short lessons, a few quick questions, no jargon and no account needed.</p>
        <div className={styles.heroStats}>
          <span><strong>{done}</strong> of {ALL_LESSONS.length} lessons done</span>
          <span>Your pace. No deadlines.</span>
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

    {PLAY_LESSON && <section className={styles.play} aria-labelledby="play-title">
      <span className={styles.playIcon} aria-hidden><Play size={22} /></span>
      <div className={styles.playText}>
        <h2 id="play-title">{PLAY_LESSON.title}</h2>
        <p>Run a real index fund. Make the three calls a fund manager makes, and see whether the index agrees.</p>
        <span className={styles.playMeta}><Clock size={12} aria-hidden />{PLAY_LESSON.minutes} min{played && <span className={styles.playDone}> · Played</span>}</span>
      </div>
      <ButtonLink to={`/learn/${PLAY_LESSON.id}`} arrow>{played ? 'Play it again' : 'Play'}</ButtonLink>
    </section>}

    <section aria-labelledby="path-title">
      <div className={styles.sectionHead}>
        <div><h2 id="path-title" className="t-h2">Your starter path</h2><p>Four short units. Go in order or jump to what you’re curious about.</p></div>
        {done > 0 && <button type="button" className={styles.linkButton} onClick={() => setConfirmReset(true)}>Reset progress</button>}
      </div>
      <ol className={styles.units}>
        {UNITS.map((unit, u) => {
          const unitDone = unit.lessons.filter((l) => progress.completed.includes(l.id)).length
          return <li key={unit.id} className={styles.unit}>
            <details open={unit.lessons.some(l => l.id === upNext?.id)}><summary className={styles.unitHead}>
              <span className={styles.unitNumber}>Unit {u + 1}</span>
              <h3>{unit.title}</h3>
              <p>{unit.summary}</p>
              <p className={styles.unitCount}>{unitDone} of {unit.lessons.length} done</p>
            </summary>
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
            </ul></details>
          </li>
        })}
      </ol>
    </section>

    <section className={styles.panel} aria-labelledby="faq-title">
      <h2 id="faq-title" className="t-h2">Questions beginners ask</h2>
      <p className={styles.panelIntro}>No question is too basic. These are the ones people ask most.</p>
      <div className={styles.faq}>
        {FAQ.slice(0, 4).map(({ question, answer, source }) => <details key={question}>
          <summary>{question}</summary>
          <div><p>{answer}</p>{source && <p><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></p>}<Link to={ask(`${question} Explain it for a beginner, based on my situation if you can.`)}><MessageCircle size={14} aria-hidden />Ask a follow-up</Link></div>
        </details>)}
      </div>
      <details className={styles.more}><summary>More beginner questions</summary><div className={styles.faq}>
        {FAQ.slice(4).map(({ question, answer, source }) => <details key={question}><summary>{question}</summary><div><p>{answer}</p>{source && <p><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></p>}<Link to={ask(`${question} Explain it for a beginner.`)}><MessageCircle size={14} aria-hidden />Ask a follow-up</Link></div></details>)}
      </div></details>
    </section>

    <section className={styles.panel} aria-labelledby="growth-title">
      <h2 id="growth-title" className="t-h2">See what time can do</h2>
      <p className={styles.panelIntro}>Explore a made-up saving and investing example when you’re ready. You choose the amount and time.</p>
      <details className={styles.more}><summary>Try the growth illustration</summary><GrowthCalculator /></details>
    </section>

    <section id="glossary" className={styles.glossary} aria-labelledby="glossary-title">
      <div className={styles.glossaryHeader}>
        <div><h2 id="glossary-title" className="t-h2">A little less jargon</h2><p>Look up a word, or practice with flashcards.</p></div>
        <SegmentedControl label="Glossary view" options={[{ value: 'browse', label: 'Browse' }, { value: 'flashcards', label: 'Flashcards' }]} value={mode} onChange={setMode} />
      </div>
      {mode === 'browse' ? <>
        <label className={styles.search}><Search size={18} aria-hidden /><span className="sr-only">Search investing terms</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Try “ETF” or “risk”" /></label>
        <p className={styles.count} role="status">{terms.length} {terms.length === 1 ? 'term' : 'terms'}{search.trim() ? ' found' : ' to explore'}</p>
        <div className={styles.terms}>{visibleTerms.map(({ term, meaning, example }) => <details key={term}><summary>{term}</summary><div><p>{meaning}</p><p className={styles.example}>{example}</p><TermExamples term={term} /><Link to={ask(`Explain ${term.toLowerCase()} with a simple example.`)}>Ask for an example</Link></div></details>)}</div>
        {!search.trim() && terms.length > 6 && <button type="button" className={styles.linkButton} onClick={() => setShowAllTerms(value => !value)}>{showAllTerms ? 'Show fewer terms' : `Explore all ${terms.length} terms`}</button>}
        {!terms.length && <div className={styles.empty}><p>No matching terms yet. Try a shorter word or ask the advisor.</p><button type="button" onClick={() => setSearch('')}>Clear search</button></div>}
      </> : <Flashcards />}
      <p className={styles.source}>Definitions adapted in plain language. <a href={GLOSSARY_SOURCE} target="_blank" rel="noreferrer">Explore Investor.gov’s glossary</a> or its <a href={LEARNING_SOURCE} target="_blank" rel="noreferrer">introduction to investing</a>.</p>
    </section>
    <p className={styles.source}>Educational information, not financial advice. Investing involves risk, including loss of principal. Progress stays in this browser when storage is available. If storage is blocked, it lasts until you reload.</p>
    <ConfirmDialog open={confirmReset} title="Reset lesson progress?" confirmLabel="Reset lessons" onClose={() => setConfirmReset(false)} onConfirm={() => { resetProgress(); setConfirmReset(false) }}>Your completed lessons will be cleared on this browser. Your research milestones will stay.</ConfirmDialog>
  </div>
}

/** Real funds for a fund-type term ("VOO · Vanguard"), each opening its research page. */
function TermExamples({ term }: { term: string }) {
  const examples = examplesFor(term)
  if (!examples.length) return null
  return <div className={styles.termExamples}>
    <span className="t-caption c-tertiary">Real examples</span>
    <ul>{examples.map(fund => <li key={fund.symbol}><Link to={`/markets?symbol=${encodeURIComponent(fund.symbol)}`}><span className="t-mono">{fund.symbol}</span> · {fund.family ?? fund.name}</Link></li>)}</ul>
  </div>
}
