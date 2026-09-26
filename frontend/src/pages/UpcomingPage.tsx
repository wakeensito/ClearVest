import { ButtonLink } from '../components/ui/Button'
import { Section } from '../components/ui/Section'
import styles from './UpcomingPage.module.css'

// Markets and Learn are P2 in the backend plan; the API routes exist, the screens come next.
const PAGES = {
  markets: {
    eyebrow: 'Markets',
    title: 'Compare the market',
    body: 'Compare returns and volatility across funds, compare companies side by side, and see the latest economic data.',
    items: ['Compare returns (1, 5 and 10 years)', 'Compare companies', 'Economy'],
  },
  learn: {
    eyebrow: 'Learn',
    title: 'Build your understanding',
    body: 'Retirement accounts explained for your age and situation, and well-known model portfolios with their sources.',
    items: ['Retirement accounts', 'Model portfolios'],
  },
} as const

export function UpcomingPage({ page }: { page: keyof typeof PAGES }) {
  const p = PAGES[page]
  return (
    <div className={styles.page}>
      <Section bare level={1} eyebrow={p.eyebrow} title={p.title} />
      <Section eyebrow="In preparation" title="This section is on the way">
        <div className={styles.body}>
          <p className="t-body c-secondary">{p.body}</p>
          <ol className={styles.items}>
            {p.items.map((item, i) => (
              <li key={item}>
                <span className={styles.index}>{String(i + 1).padStart(2, '0')}</span>
                <span className="t-body-strong">{item}</span>
              </li>
            ))}
          </ol>
          <ButtonLink to="/advisor" variant="tertiary" arrow>
            Ask the advisor in the meantime
          </ButtonLink>
        </div>
      </Section>
    </div>
  )
}
