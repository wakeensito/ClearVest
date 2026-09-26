import { useQueryClient } from '@tanstack/react-query'
import { House, BookOpen, ChartLine, CircleUser, Search, MessageSquareText, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useChat } from '../features/advisor/chatContext'
import { resetUserId } from '../lib/userId'
import styles from './AppShell.module.css'
import { Badge } from './ui/Badge'
import { ConfirmDialog } from './ui/ConfirmDialog'

const NAV = [
  { to: '/', label: 'Home', icon: House },
  { to: '/portfolio', label: 'Portfolio', icon: Wallet },
  { to: '/advisor', label: 'Advisor', icon: MessageSquareText },
  { to: '/markets', label: 'Markets', icon: ChartLine },
  { to: '/learn', label: 'Learn', icon: BookOpen },
]

export function Wordmark() {
  return (
    <Link to="/" className={`t-wordmark ${styles.wordmark}`} aria-label="ClearVest home">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden><path d="M23 6H8L4 14l4 8h15" stroke="currentColor" strokeWidth="3" /><path d="m12 13 4 4 8-11" stroke="currentColor" strokeWidth="2.5" /></svg>
      ClearVest
    </Link>
  )
}

export function AppShell() {
  const { pathname } = useLocation()

  // Learning, research and general advisor questions work without a saved profile.

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Wordmark />
          <nav aria-label="Primary" className={styles.nav}>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={styles.navLink}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className={styles.tools}>
            <Link to="/markets" className={styles.researchLink}><Search size={17} aria-hidden /><span>Research</span></Link>
            <Badge tone="sandbox">Sandbox data</Badge>
            <ProfileMenu />
          </div>
        </div>
      </header>

      <div className={styles.workspaceBar}><span>Learn a little. Explore at your pace.</span><span>No trading in ClearVest</span></div>

      <main id="main" className={styles.main} key={pathname}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Wordmark />
            <p className={styles.footerTagline}>Clarity for every investor.</p>
          </div>
          <div className={styles.footerDetails}>
            <p>
              ClearVest provides educational information, not financial advice. Market data from Yahoo Finance,
              SEC EDGAR, FMP, Alpha Vantage and FRED. Accounts are Plaid sandbox data.
            </p>
            <p>Charts powered by <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts™</a>. Copyright (с) 2025 TradingView, Inc.</p>
          </div>
        </div>
      </footer>

      <nav aria-label="Primary" className={styles.tabbar}>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={styles.tab}>
            <n.icon size={20} aria-hidden />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function ProfileMenu() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState<'chat' | 'reset' | null>(null)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const chat = useChat()
  const qc = useQueryClient()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = async () => {
    setBusy(true)
    try {
      if (confirm === 'chat') {
        await chat.clear()
      } else {
        resetUserId()
        qc.clear()
        // A full reload so every cache and the chat thread start clean under the new id.
        window.location.assign('/')
        return
      }
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.menuWrap} ref={ref}>
      <button
        type="button"
        className={styles.menuButton}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <CircleUser size={20} aria-hidden />
        <span className="sr-only">Profile and settings</span>
      </button>
      {open && (
        <div className={styles.menu}>
          <Link to="/welcome?edit=1" state={{ returnTo: location.pathname + location.search }} className={styles.menuItem} onClick={() => setOpen(false)}>
            Edit profile
          </Link>
          <button type="button" className={styles.menuItem} onClick={() => {
              setOpen(false)
              setConfirm('chat')
            }}>
            Clear chat history
          </button>
          <button
            type="button"
            className={`${styles.menuItem} ${styles.danger}`}
            onClick={() => {
              setOpen(false)
              setConfirm('reset')
            }}
          >
            Reset demo user
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'reset' ? 'Reset demo user?' : 'Clear chat history?'}
        confirmLabel={confirm === 'reset' ? 'Reset' : 'Clear history'}
        busy={busy}
        onConfirm={() => void run()}
        onClose={() => setConfirm(null)}
      >
        {confirm === 'reset'
          ? 'This starts over as a new user: a new profile, no linked account and no chat history. The current demo user can’t be recovered.'
          : 'The advisor forgets this conversation and future answers start fresh. Your profile and linked account stay as they are.'}
      </ConfirmDialog>
    </div>
  )
}
