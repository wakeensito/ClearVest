import { useState } from 'react'
import styles from './CompanyLogo.module.css'

/** FMP's public symbol images; missing coverage falls back to the ticker, never a broken image. */
export function CompanyLogo({ symbol, small = false }: { symbol: string; small?: boolean }) {
  const [failed, setFailed] = useState('')
  const valid = /^[A-Z0-9.^-]{1,12}$/.test(symbol)
  return <span className={`${styles.logo} ${small ? styles.small : ''}`}>
    {valid && failed !== symbol ? <img src={`https://images.financialmodelingprep.com/symbol/${encodeURIComponent(symbol)}.png`} alt={`${symbol} logo`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(symbol)} /> : <span role="img" aria-label={`${symbol || 'Company'} logo unavailable`}>{symbol.slice(0, 2) || '—'}</span>}
  </span>
}
