import { BookOpen, Search, Wallet, Check } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { QuickCheck } from '../components/education/QuickCheck'
import { useResearchProgress } from '../lib/researchProgress'
import styles from './HomePage.module.css'

const milestones = [{ id: 'share', label: 'Understand a share' }, { id: 'profit', label: 'Tell sales from profit' }, { id: 'pe', label: 'Explain a P/E ratio' }] as const
export function HomePage() {
  const [shares, setShares] = useState(1)
  const progress = useResearchProgress()
  return <div className={styles.page}>
    <header className={styles.intro}><h1>Investing starts with understanding.</h1><p>No experience needed. No account to connect. Start with one idea, then explore at your own pace.</p></header>
    <section className={styles.first} aria-labelledby="first-share">
      <div className={styles.lesson}><span className={styles.duration}>Your first idea · About 1 minute</span><h2 id="first-share">A share is a small piece of a business.</h2><p>Imagine a business divided into 100 equal shares. Owning a share means owning part of that business. Your piece can rise or fall in value.</p>
        <label htmlFor="ownership">Try owning {shares} {shares === 1 ? 'share' : 'shares'}</label><input id="ownership" type="range" min="1" max="10" value={shares} onChange={event => setShares(Number(event.target.value))} aria-valuetext={`${shares} shares, ${shares} percent of this example business`} />
        <p className={styles.small}>A made-up business with 100 shares. Real companies can have billions.</p>
      </div>
      <div className={styles.ownership}><div className={styles.shares} aria-hidden>{Array.from({ length: 100 }, (_, index) => <span key={index} data-owned={index < shares} />)}</div><p><strong>{shares}%</strong> of this example business belongs to you.</p></div>
      <div className={styles.check}><QuickCheck milestone="share" question="Does owning a share guarantee a profit?" answers={[{ text: 'No, its value can fall', correct: true, explanation: 'You own part of a business, but its future is uncertain. You could lose money.' }, { text: 'Yes, because I own it', correct: false, explanation: 'Ownership does not guarantee success. A business can struggle and its shares can lose value. Try again.' }]} /></div>
    </section>
    <section className={styles.next} aria-labelledby="next-step"><div><h2 id="next-step">Take your next small step</h2><p>You can learn without buying anything.</p></div><div className={styles.paths}>
      <Link to="/learn"><BookOpen aria-hidden size={24} /><strong>Build the basics</strong><span>Explore simple explanations in Learn.</span></Link>
      <Link to="/markets?symbol=AAPL&guided=1"><Search aria-hidden size={24} /><strong>Explore a real company</strong><span>Learn to read sales, profit and price together.</span></Link>
      <Link to="/portfolio"><Wallet aria-hidden size={24} /><strong>Understand a portfolio</strong><span>See what a collection of investments tells you.</span></Link>
    </div></section>
    <section className={styles.progress} aria-label="Research milestones"><div><h2>Your research milestones</h2><p>{progress.length} of 3 ideas explored. Saved in this browser when storage is available.</p></div><ul>{milestones.map(item => <li key={item.id} data-complete={progress.includes(item.id)}><Check size={16} aria-hidden /><span>{item.label}</span><span className="sr-only">{progress.includes(item.id) ? 'Completed' : 'Not yet completed'}</span></li>)}</ul></section>
  </div>
}
