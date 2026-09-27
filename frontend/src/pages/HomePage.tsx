import { ArrowRight, BookOpen, Search, Wallet, Check } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { CompanyClues } from '../components/education/CompanyClues'
import { QuickCheck } from '../components/education/QuickCheck'
import { ButtonLink } from '../components/ui/Button'
import { useResearchProgress } from '../lib/researchProgress'
import { useLearnProgress } from '../lib/useLearnProgress'
import { ALL_LESSONS, nextLesson } from '../lib/lessons'
import styles from './HomePage.module.css'

const milestones = [{ id: 'share', label: 'Understand a share' }, { id: 'profit', label: 'Tell sales from profit' }, { id: 'pe', label: 'Understand how a stock is priced' }] as const
export function HomePage() {
  const [shares, setShares] = useState(1)
  const progress = useResearchProgress()
  const lessons = useLearnProgress()
  const resume = nextLesson(lessons.completed)
  const lessonsDone = lessons.completed.filter(id => ALL_LESSONS.some(lesson => lesson.id === id)).length
  const started = lessonsDone > 0
  const lessonHref = resume ? `/learn/${resume.id}` : '/learn'
  return <div className={styles.page}>
    <header className={styles.intro}>
      <h1>Investing starts with understanding.</h1>
      <p>No experience needed. No account to connect. Start with one idea, then explore at your own pace.</p>
      <div className={styles.introActions}>
        <ButtonLink to={lessonHref} variant="primary" arrow>{!started ? 'Start your first lesson' : resume ? `Resume: ${resume.title}` : 'Review your lessons'}</ButtonLink>
        <a href="#first-share">Or try a 1-minute idea first</a>
      </div>
    </header>
    <section className={styles.first} aria-labelledby="first-share">
      <div className={styles.lesson}><span className={styles.duration}>Your first idea · About 1 minute</span><h2 id="first-share">A share is a small piece of a business.</h2><p>Imagine a business divided into 100 equal shares. Owning a share means owning part of that business. Your piece can rise or fall in value.</p>
        <label htmlFor="ownership">Try owning {shares} {shares === 1 ? 'share' : 'shares'}</label><input id="ownership" type="range" min="1" max="10" value={shares} onChange={event => setShares(Number(event.target.value))} aria-valuetext={`${shares} shares, ${shares} percent of this example business`} />
        <p className={styles.small}>A made-up business with 100 shares. Real companies can have billions.</p>
      </div>
      <div className={styles.ownership}><div className={styles.shares} aria-hidden>{Array.from({ length: 100 }, (_, index) => <span key={index} data-owned={index < shares} />)}</div><p><strong>{shares}%</strong> of this example business belongs to you.</p></div>
      <div className={styles.check}>
        <QuickCheck milestone="share" question="Does owning a share guarantee a profit?" answers={[{ text: 'No, its value can fall', correct: true, explanation: 'You own part of a business, but its future is uncertain. You could lose money.' }, { text: 'Yes, because I own it', correct: false, explanation: 'Ownership does not guarantee success. A business can struggle and its shares can lose value. Try again.' }]} />
        {progress.includes('share') && <CompanyClues lesson={resume ? { id: resume.id, title: resume.title, started } : undefined} />}
      </div>
    </section>
    <section className={styles.next} aria-labelledby="next-step"><div><h2 id="next-step">Take your next small step</h2><p>You can learn without buying anything.</p></div><div className={styles.paths}>
      <Link to={started && resume ? `/learn/${resume.id}` : '/learn'}><BookOpen aria-hidden size={24} /><strong>{started && resume ? 'Continue learning' : 'Build the basics'}</strong><span>{started ? `${lessonsDone} of ${ALL_LESSONS.length} lessons complete. ${resume ? `Next: ${resume.title}.` : 'Revisit your starter path.'}` : 'Start with a short lesson and a quick check.'}</span><em className={styles.cta} aria-hidden>{started ? 'Continue' : 'Start learning'}<ArrowRight size={16} /></em></Link>
      <Link to="/markets?symbol=AAPL&guided=1"><Search aria-hidden size={24} /><strong>Explore a real company</strong><span>Learn to read sales, profit and price together.</span><em className={styles.cta} aria-hidden>Explore<ArrowRight size={16} /></em></Link>
      <Link to="/portfolio#xray"><Wallet aria-hidden size={24} /><strong>See what you really own</strong><span>Your funds may hold the same companies twice.</span><em className={styles.cta} aria-hidden>Open portfolio<ArrowRight size={16} /></em></Link>
    </div></section>
    <section className={styles.progress} aria-labelledby="progress-title">
      <div><h2 id="progress-title">Your progress</h2><p>Lessons and research skills in one place. Saved in this browser when storage is available.</p></div>
      <div className={styles.progressGrid}>
        <div className={styles.progressBlock}>
          <h3>Starter lessons</h3>
          <p className={styles.progressCount}><strong>{lessonsDone}</strong> of {ALL_LESSONS.length} lessons done</p>
          <div className={styles.meter} role="progressbar" aria-label="Starter lessons completed" aria-valuemin={0} aria-valuemax={ALL_LESSONS.length} aria-valuenow={lessonsDone}><span style={{ width: `${(lessonsDone / ALL_LESSONS.length) * 100}%` }} /></div>
          <Link to="/learn" className={styles.progressLink}>{started ? 'See your starter path' : `See all ${ALL_LESSONS.length} lessons`}</Link>
        </div>
        <div className={styles.progressBlock}>
          <h3>Research skills</h3>
          <p className={styles.progressCount}><strong>{progress.length}</strong> of 3 ideas explored.</p>
          <ul>{milestones.map(item => <li key={item.id} data-complete={progress.includes(item.id)}><Check size={16} aria-hidden /><span>{item.label}</span><span className="sr-only">{progress.includes(item.id) ? 'Completed' : 'Not yet completed'}</span></li>)}</ul>
        </div>
      </div>
    </section>
  </div>
}
