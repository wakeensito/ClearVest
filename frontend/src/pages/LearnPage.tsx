import { BookOpen, Compass, Layers, MessageCircle, Search, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { filterTerms, GLOSSARY_SOURCE, LEARNING_SOURCE } from '../lib/learning'
import styles from './LearnPage.module.css'

const PATHS = [
  { title: 'Understand what you own', icon: Layers, body: 'Start with the holdings list. Notice which investments carry the most weight and how they fit together.', prompt: 'Walk me through my holdings in plain language. Explain any unfamiliar terms.' },
  { title: 'Research with a purpose', icon: Compass, body: 'Look at what an investment owns, its costs and its risks. Past performance is only one part of the picture.', prompt: 'What questions can help me evaluate an investment beyond its past performance?' },
  { title: 'Connect investing to your life', icon: MessageCircle, body: 'Think about when you need the money and the changes in value you could manage. There is no single path for everyone.', prompt: 'Help me think through my time horizon and risk tolerance, without assuming my goals.' },
]

export function LearnPage() {
  const [search, setSearch] = useState('')
  const terms = filterTerms(search)
  return <div className={styles.page}>
    <header className={styles.hero}>
      <div className={styles.intro}><BookOpen size={24} aria-hidden /><h1>Investing, in your own words.</h1><p>New to investing or filling in a few gaps? Start where you are. You don’t need a linked account to explore.</p><a href="#glossary">Find a term in the glossary</a></div>
      <img src="/images/valley-path.webp" width="2172" height="724" alt="" className={styles.landscape} />
    </header>
    <section aria-labelledby="paths-title"><h2 id="paths-title" className="t-h2">Choose a place to start</h2><div className={styles.paths}>{PATHS.map(({title,icon:Icon,body,prompt}) => <article key={title} className={styles.path}><Icon size={22} aria-hidden /><h3>{title}</h3><p>{body}</p><Link to={`/advisor?q=${encodeURIComponent(prompt)}`}>Talk it through<ArrowUpRight size={16} aria-hidden /></Link></article>)}</div><p className={styles.source}>Further reading: <a href={LEARNING_SOURCE} target="_blank" rel="noreferrer">Investor.gov’s introduction to investing</a>. Advisor conversations use a saved profile.</p></section>
    <section id="glossary" className={styles.glossary} aria-labelledby="glossary-title">
      <div className={styles.glossaryHeader}><div><h2 id="glossary-title" className="t-h2">A little less jargon</h2><p>Every question is a reasonable place to start.</p></div><label className={styles.search}><Search size={18} aria-hidden /><span className="sr-only">Search investing terms</span><input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Try “ETF” or “risk”" /></label></div>
      <p className={styles.count} role="status">{terms.length} {terms.length === 1 ? 'term' : 'terms'}{search.trim() ? ' found' : ' to explore'}</p>
      <div className={styles.terms}>{terms.map(({term,meaning,example})=><details key={term}><summary>{term}</summary><div><p>{meaning}</p><p className={styles.example}>{example}</p><Link to={`/advisor?q=${encodeURIComponent(`Explain ${term.toLowerCase()} with a simple example.`)}`}>Ask for an example</Link></div></details>)}</div>
      {!terms.length && <div className={styles.empty}><p>No matching terms yet. Try a shorter word or ask the advisor.</p><button type="button" onClick={()=>setSearch('')}>Clear search</button></div>}
      <p className={styles.source}>Definitions adapted in plain language. <a href={GLOSSARY_SOURCE} target="_blank" rel="noreferrer">Explore Investor.gov’s glossary</a>.</p>
    </section>
    <p className={styles.source}>Educational information, not financial advice. Investing involves risk, including loss of principal.</p>
  </div>
}
