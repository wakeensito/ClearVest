// Tap-to-explain jargon: finds investing terms in running text (advisor replies, risk explanations)
// and links each to a plain-language meaning and the lesson that teaches it. Glossary meanings come
// from learning.ts so there is one source of truth; a few research terms that the glossary doesn't
// cover are defined here.
import { TERMS } from './learning'
import { ALL_LESSONS } from './lessons'

export interface Explainer {
  /** Canonical name shown in the popover. */
  label: string
  meaning: string
  /** Lesson id in lessons.ts, or an app path for terms taught outside Learn. */
  learn: { lessonId: string } | { href: string; label: string }
}

const GUIDED_RESEARCH = { href: '/markets?symbol=AAPL&guided=1', label: 'Try guided research on Apple' }

const glossary = (term: string): string => TERMS.find((t) => t.term === term)?.meaning ?? ''

const ENTRIES: readonly (Explainer & { phrases: readonly string[] })[] = [
  { label: 'ETF', meaning: glossary('ETF'), learn: { lessonId: 'funds' }, phrases: ['exchange-traded funds', 'exchange-traded fund', 'ETFs', 'ETF'] },
  { label: 'Index fund', meaning: glossary('Index fund'), learn: { lessonId: 'funds' }, phrases: ['index funds', 'index fund'] },
  { label: 'Mutual fund', meaning: glossary('Mutual fund'), learn: { lessonId: 'funds' }, phrases: ['mutual funds', 'mutual fund'] },
  { label: 'Expense ratio', meaning: glossary('Expense ratio'), learn: { lessonId: 'funds' }, phrases: ['expense ratios', 'expense ratio'] },
  { label: 'Market index', meaning: glossary('Market index'), learn: { lessonId: 'funds' }, phrases: ['market index'] },
  { label: 'S&P 500', meaning: 'A market index that follows about 500 large US companies. Many index funds copy it.', learn: { lessonId: 'funds' }, phrases: ['S&P 500'] },
  { label: 'Diversification', meaning: glossary('Diversification'), learn: { lessonId: 'diversification' }, phrases: ['diversification', 'diversified', 'diversify'] },
  { label: 'Asset allocation', meaning: glossary('Asset allocation'), learn: { lessonId: 'diversification' }, phrases: ['asset allocation'] },
  { label: 'Rebalancing', meaning: glossary('Rebalancing'), learn: { lessonId: 'diversification' }, phrases: ['rebalancing', 'rebalance'] },
  { label: 'Concentration', meaning: 'When a large share of your money sits in one investment or one area, so its ups and downs move your whole portfolio.', learn: { lessonId: 'diversification' }, phrases: ['concentration', 'concentrated'] },
  { label: 'Volatility', meaning: glossary('Volatility'), learn: { lessonId: 'market-drops' }, phrases: ['volatility', 'volatile'] },
  { label: 'Time horizon', meaning: glossary('Time horizon'), learn: { lessonId: 'market-drops' }, phrases: ['time horizon'] },
  { label: 'Risk tolerance', meaning: glossary('Risk tolerance'), learn: { lessonId: 'market-drops' }, phrases: ['risk tolerance'] },
  { label: 'Bear market', meaning: glossary('Bear market'), learn: { lessonId: 'market-drops' }, phrases: ['bear market', 'bull market'] },
  { label: 'Bond', meaning: glossary('Bond'), learn: { lessonId: 'stocks-and-bonds' }, phrases: ['bonds', 'bond'] },
  { label: 'Dividend', meaning: glossary('Dividend'), learn: { lessonId: 'stocks-and-bonds' }, phrases: ['dividends', 'dividend'] },
  { label: 'Compound growth', meaning: glossary('Compound growth'), learn: { lessonId: 'starting-early' }, phrases: ['compound growth', 'compound interest', 'compounding'] },
  { label: 'Emergency fund', meaning: glossary('Emergency fund'), learn: { lessonId: 'safety-net-first' }, phrases: ['emergency fund'] },
  { label: 'Dollar-cost averaging', meaning: glossary('Dollar-cost averaging'), learn: { lessonId: 'steady-investing' }, phrases: ['dollar-cost averaging', 'dollar cost averaging'] },
  { label: 'Brokerage account', meaning: glossary('Brokerage account'), learn: { lessonId: 'account-types' }, phrases: ['brokerage accounts', 'brokerage account'] },
  { label: 'Capital gain', meaning: glossary('Capital gain'), learn: { lessonId: 'account-types' }, phrases: ['capital gains', 'capital gain'] },
  { label: '401(k)', meaning: glossary('401(k)'), learn: { lessonId: 'employer-plans' }, phrases: ['401(k)s', '401(k)', '401k'] },
  { label: 'TSP', meaning: 'The Thrift Savings Plan: the federal government’s version of a 401(k), for federal employees and members of the uniformed services.', learn: { lessonId: 'employer-plans' }, phrases: ['Thrift Savings Plan', 'TSP'] },
  { label: 'Employer match', meaning: glossary('Employer match'), learn: { lessonId: 'employer-plans' }, phrases: ['employer match', 'matching contributions'] },
  { label: 'Roth IRA', meaning: glossary('Roth IRA'), learn: { lessonId: 'roth-vs-traditional' }, phrases: ['Roth IRAs', 'Roth IRA'] },
  { label: 'Traditional IRA', meaning: glossary('Traditional IRA'), learn: { lessonId: 'roth-vs-traditional' }, phrases: ['traditional IRA'] },
  { label: 'P/E ratio', meaning: 'Price-to-earnings: the share price divided by the company’s earnings per share. It shows how much investors pay for each dollar of profit. Lower is not automatically better.', learn: GUIDED_RESEARCH, phrases: ['price-to-earnings', 'price to earnings', 'P/E ratio', 'P/E'] },
  { label: 'Revenue', meaning: 'The money a company brings in from sales before any costs are taken out. Also called sales or the “top line”.', learn: GUIDED_RESEARCH, phrases: ['revenue'] },
  { label: 'Net income', meaning: 'Profit: what is left after every cost, interest and tax is subtracted from revenue. Also called the “bottom line”.', learn: GUIDED_RESEARCH, phrases: ['net income'] },
  { label: 'Earnings per share', meaning: 'A company’s profit divided by its number of shares. It is the “E” in the P/E ratio.', learn: GUIDED_RESEARCH, phrases: ['earnings per share', 'EPS'] },
]

export const EXPLAINERS: readonly Explainer[] = ENTRIES

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const byPhrase = new Map<string, (typeof ENTRIES)[number]>()
for (const entry of ENTRIES) for (const phrase of entry.phrases) byPhrase.set(phrase.toLowerCase(), entry)
// Longest phrases first so "index fund" wins over "fund"-like shorter matches.
const phrases = [...byPhrase.keys()].sort((a, b) => b.length - a.length)
const PATTERN = new RegExp(`(?<![A-Za-z0-9])(${phrases.map(escape).join('|')})(?![A-Za-z0-9])`, 'gi')

// Acronyms only match in capitals, so "eps" in a word or "tsp" as teaspoon are left alone.
const CASE_SENSITIVE = new Set(['etf', 'etfs', 'tsp', 'eps', 's&p 500'])

export type Piece = string | { text: string; explainer: Explainer }

/**
 * Split text into plain strings and explainable terms. Each explainer is used at most once across
 * the `seen` set, so a long reply underlines a term the first time only.
 */
export function explainPieces(text: string, seen: Set<string> = new Set()): Piece[] {
  const out: Piece[] = []
  let last = 0
  for (const match of text.matchAll(PATTERN)) {
    const found = match[0]
    const entry = byPhrase.get(found.toLowerCase())
    if (!entry || match.index === undefined) continue
    const stem = found.replace(/s$/, '')
    if (CASE_SENSITIVE.has(found.toLowerCase()) && stem !== stem.toUpperCase()) continue
    if (seen.has(entry.label)) continue
    seen.add(entry.label)
    if (match.index > last) out.push(text.slice(last, match.index))
    out.push({ text: found, explainer: entry })
    last = match.index + found.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function learnLink(explainer: Explainer): { href: string; label: string } {
  if ('href' in explainer.learn) return explainer.learn
  const { lessonId } = explainer.learn
  const lesson = ALL_LESSONS.find((l) => l.id === lessonId)
  return { href: `/learn/${lessonId}`, label: lesson ? `Lesson: ${lesson.title}` : 'Open the lesson' }
}

/** The first lesson (not research link) suggested by the terms in a reply, if any. */
export function relatedLesson(text: string): { id: string; title: string } | null {
  for (const piece of explainPieces(text)) {
    if (typeof piece === 'string' || !('lessonId' in piece.explainer.learn)) continue
    const lesson = ALL_LESSONS.find((l) => 'lessonId' in piece.explainer.learn && l.id === piece.explainer.learn.lessonId)
    if (lesson) return { id: lesson.id, title: lesson.title }
  }
  return null
}
