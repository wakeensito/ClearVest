import { ArrowUp, ChevronRight, BookOpen, HelpCircle, Wallet, Maximize2, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useCompanyResearch, useMarketNews } from '../../api/queries'
import { useScoutContext, contextLabel } from '../../features/advisor/scoutContext'
import { describeError } from '../../api/errors'
import { useChat } from '../../features/advisor/chatContext'
import { useVoiceTurn } from '../../features/advisor/useVoiceTurn'
import { VoiceButton, VoiceStatus, VoiceReplyButton } from '../../features/advisor/VoiceButton'
import { ReplyEvidence } from '../../features/advisor/ReplyEvidence'
import { EXPLAIN_EVENT, type ExplainSelection } from '../../features/advisor/ExplainThis'
import { ReplyActions } from '../../features/advisor/ReplyActions'
import { ReplyLearning } from '../../features/advisor/ReplyLearning'
import { Markdown } from '../../features/advisor/Markdown'
import { Scout, type ScoutState } from './Scout'
import styles from './ScoutCompanion.module.css'

const MAX = 2000

/** Outside the keyed route outlet: navigation preserves the panel and conversation. */
export function ScoutCompanion() {
  const { pathname, search } = useLocation()
  const eligible = ['/', '/portfolio', '/markets', '/learn'].includes(pathname) || pathname.startsWith('/learn/')
  const chat = useChat()
  const { setDraft } = chat
  const pageContext = useScoutContext()
  const [selection, setSelection] = useState<(ExplainSelection & { path: string }) | null>(null)
  const context = selection?.path === pathname + search ? selection.context : pageContext
  const selected = selection?.path === pathname + search

  const [sharePage, setSharePage] = useState(true)
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [ready, setReady] = useState(false)
  const [infoDismissed, setInfoDismissed] = useState(false)
  const lastReply = useRef(chat.messages.at(-1)?.id)
  const [viewport, setViewport] = useState({ height: window.visualViewport?.height ?? window.innerHeight, bottom: 0 })
  const launcherRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const visible = open && eligible
  const voice = useVoiceTurn({ enabled: visible, context: sharePage ? context : undefined, onMicDenied: () => inputRef.current?.focus() })
  const { stop: stopVoice } = voice
  useEffect(() => {
    const explain = (event: Event) => {
      const detail = (event as CustomEvent<ExplainSelection>).detail
      setSelection({ ...detail, path: pathname + search })
      setDraft(detail.question)
      setSharePage(true)
      setOpen(true)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
    window.addEventListener(EXPLAIN_EVENT, explain)
    return () => window.removeEventListener(EXPLAIN_EVENT, explain)
  }, [pathname, search, setDraft])
  const busy = chat.busy
  const thinking = chat.pending || voice.status === 'uploading' || voice.status === 'thinking'
  const evidenceSymbol = visible && sharePage ? context.symbol ?? '' : ''
  const research = useCompanyResearch(evidenceSymbol)
  const news = useMarketNews(evidenceSymbol ? [evidenceSymbol] : [], !!evidenceSymbol)
  const state: ScoutState = thinking ? 'thinking' : voice.status === 'recording' ? 'attentive' : chat.error || voice.error ? 'unavailable'
    : ready || voice.status === 'speaking' ? 'ready' : hovered || focused || visible ? 'attentive' : 'idle'

  useEffect(() => {
    const latest = chat.messages.at(-1)
    const isNewReply = latest?.role === 'advisor' && latest.id !== lastReply.current
    lastReply.current = latest?.id
    const frame = requestAnimationFrame(() => setReady(isNewReply))
    const timer = isNewReply ? window.setTimeout(() => setReady(false), 2200) : undefined
    return () => { cancelAnimationFrame(frame); clearTimeout(timer) }
  }, [chat.messages])

  useEffect(() => {
    const update = () => {
      const v = window.visualViewport
      setViewport({ height: v?.height ?? window.innerHeight, bottom: Math.max(0, window.innerHeight - (v?.height ?? window.innerHeight) - (v?.offsetTop ?? 0)) })
    }
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  useEffect(() => {
    if (visible) inputRef.current?.focus()
  }, [visible])

  useEffect(() => {
    if (visible && threadRef.current) threadRef.current.scrollTop = chat.messages.length || chat.pending ? threadRef.current.scrollHeight : 0
  }, [visible, chat.messages.length, chat.pending])

  useEffect(() => {
    if (!visible) return
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        stopVoice()
        setOpen(false)
        launcherRef.current?.focus()
      }
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [visible, stopVoice])

  const close = () => { stopVoice(); setOpen(false); launcherRef.current?.focus() }
  const send = (e?: FormEvent) => {
    e?.preventDefault()
    if (!chat.draft.trim() || busy) return
    chat.send(chat.draft, sharePage && selected, sharePage ? context : undefined)
    chat.setDraft('')
  }
  const advisorParams = new URLSearchParams({ chat: '1' })
  if (sharePage) {
    if (context.symbol) advisorParams.set('symbol', context.symbol)
    if (context.range) advisorParams.set('range', context.range)
    if (context.metric) advisorParams.set('metric', context.metric)
    if (context.priceDate) advisorParams.set('priceDate', context.priceDate)
  }
  const expand = () => { if (open) close(); else setOpen(true) }
  const suggest = (text: string) => { chat.setDraft(text); inputRef.current?.focus() }
  const starters = pathname.startsWith('/learn')
    ? [{ title: 'Explain a term', prompt: 'Can you explain compound interest with a simple example?', icon: HelpCircle }, { title: 'Show me an example', prompt: 'Show me a simple example of how an ETF works.', icon: BookOpen }]
    : [{ title: 'Start with the basics', prompt: 'What is investing, and where should a beginner start?', icon: BookOpen }, { title: 'Make sense of risk', prompt: 'How can I understand investment risk in simple terms?', icon: HelpCircle }]

  return (
    <aside className={styles.companion} hidden={!eligible} aria-label="Scout companion" data-open={visible} data-keyboard={viewport.bottom > 80}
      style={{ '--scout-viewport': `${viewport.height}px`, '--scout-keyboard': `${viewport.bottom}px` } as CSSProperties}>
      {visible && (
        <section id="scout-panel" className={styles.panel} role="dialog" aria-modal="false" aria-labelledby="scout-title">
          <header className={styles.header}>
            <div className={styles.identity}><h2 id="scout-title"><span className="sr-only">Ask </span>Scout</h2><span className={styles.beta}>Beta</span></div>
            <Link to={`/advisor?${advisorParams}`} className={styles.iconButton} aria-label="Open full Advisor" onClick={() => setOpen(false)}><Maximize2 size={17} aria-hidden /></Link>
            <button type="button" className={styles.iconButton} aria-label="Close Scout" onClick={close}><X size={18} aria-hidden /></button>
            <p className={styles.subtitle}>Investing, in plain language.</p>
          </header>
          <div className={styles.pageContext}>
            <div className={styles.contextCopy}><span id="scout-page-label">Use page details</span><p>{sharePage ? contextLabel(context) : 'Ask without this page'}</p></div>
            <button type="button" className={styles.contextSwitch} role="switch" aria-checked={sharePage} aria-labelledby="scout-page-label" onClick={() => setSharePage(!sharePage)}><span /></button>
            {selected && <button type="button" className={styles.resetSelection} onClick={() => setSelection(null)}>Back to this page</button>}
          </div>
          <div className={styles.thread} ref={threadRef}>
            {chat.messages.length === 0 && <div className={styles.welcome}>
              <p className={styles.greeting}>Where would you like to start?</p>
              <div className={styles.starters}>
                {starters.map(item => <button key={item.title} type="button" onClick={() => suggest(item.prompt)}>
                  <item.icon size={18} aria-hidden /><span>{item.title}</span><ChevronRight size={16} aria-hidden />
                </button>)}
                <button type="button" disabled={busy} onClick={() => chat.send('Explain the concentration and risk in my saved portfolio using its facts.', true)}><Wallet size={18} aria-hidden /><span>Explain my portfolio</span><ChevronRight size={16} aria-hidden /></button>
              </div>
              {sharePage && (context.symbol || context.lessonId) && <button type="button" className={styles.selectionExplain} disabled={busy || research.isFetching || news.isFetching} onClick={() => chat.send(context.lessonId ? 'Explain the key idea in this lesson with a simple example using its lesson facts.' : `Explain ${context.symbol} using the available company facts and dated headlines. State any missing evidence.`, true, context)}>{context.lessonId ? 'Help with this lesson' : `Explain ${context.symbol}`}<ChevronRight size={15} aria-hidden /></button>}
            </div>}
            {chat.messages.map(m => <article key={m.id} className={m.role === 'user' ? styles.user : styles.reply}>
              <p className={styles.author}>{m.role === 'user' ? 'You' : 'Scout'}</p>
              {m.role === 'user' ? <p className={styles.question}>{m.text}</p> : <><Markdown text={m.text} /><ReplyEvidence message={m} /><ReplyActions message={m} onNavigate={() => { stopVoice(); setOpen(false) }} /><VoiceReplyButton voice={voice} text={m.text} id={m.id} disabled={busy} /></>}
              {m.failed && <div className={styles.error}>
                <p>Reply unavailable</p>
                <p>{chat.error ? describeError(chat.error, 'Scout') : 'I couldn’t get a reply this time.'}</p>
                <div><button type="button" disabled={busy} onClick={() => chat.retry(m.id)}><RotateCcw size={14} aria-hidden />Retry</button><button type="button" onClick={() => suggest(m.text)}>Edit question</button></div>
              </div>}
            </article>)}
            <div role="status" className={styles.status}>{thinking ? <><span className={styles.thinkingDots} aria-hidden><i /><i /><i /></span><span>Thinking it through…</span></> : chat.messages.at(-1)?.role === 'advisor' ? <span className="sr-only">Reply ready.</span> : null}</div>
            {!busy && chat.messages.at(-1)?.role === 'advisor' && <div className={styles.followups}><button type="button" onClick={() => suggest('Can you explain that more simply?')}>Make it simpler</button><button type="button" onClick={() => suggest('Can you give me a concrete example?')}>Give me an example</button></div>}
            {!busy && chat.messages.at(-1)?.role === 'advisor' && <ReplyLearning key={chat.messages.at(-1)!.id} message={chat.messages.at(-1)!} onOpenLesson={() => { stopVoice(); setOpen(false) }} />}
          </div>
          <form className={styles.composer} onSubmit={send}>
            <label htmlFor="scout-question" className="sr-only">Your question for Scout</label>
            <div className={styles.inputRow}>
              <textarea id="scout-question" ref={inputRef} value={chat.draft} onChange={e => chat.setDraft(e.target.value.slice(0, MAX))} maxLength={MAX} rows={2} placeholder="What’s on your mind?"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }} />
              <VoiceButton voice={voice} disabled={chat.pending} />
              <button type="submit" className={styles.send} disabled={busy || !chat.draft.trim()} aria-label="Send to Scout"><ArrowUp size={20} aria-hidden /></button>
            </div>
            <VoiceStatus voice={voice} />
            {chat.draft.length > 1800 && <p className={styles.counter}>{chat.draft.length}/{MAX}</p>}
          </form>
          <div className={styles.infoFooter}>
            <span className={styles.info} data-dismissed={infoDismissed} onMouseEnter={() => setInfoDismissed(false)}>
              <span tabIndex={0} role="img" aria-label="About Scout" aria-describedby="scout-info" className={styles.infoTrigger}
                onFocus={() => setInfoDismissed(false)} onClick={e => e.currentTarget.focus()}
                onKeyDown={e => { if (e.key === 'Escape' && !infoDismissed) { e.stopPropagation(); setInfoDismissed(true) } }}><HelpCircle size={17} aria-hidden /></span>
              <span role="tooltip" id="scout-info" className={styles.infoTip}>{chat.disclaimer}</span>
            </span>
          </div>
        </section>
      )}
      <button type="button" ref={launcherRef} className={styles.launcher} aria-label={open ? 'Close Scout companion' : 'Ask Scout'} aria-expanded={visible} aria-controls={visible ? 'scout-panel' : undefined} onClick={expand} onPointerEnter={e => { if (e.pointerType === 'mouse') setHovered(true) }} onPointerLeave={() => setHovered(false)} onFocus={e => setFocused(e.currentTarget.matches(':focus-visible'))} onBlur={() => setFocused(false)}>
        <span className={styles.mascot} data-opening={visible}><Scout state={state} engaged={hovered || focused || visible} /></span>
      </button>
    </aside>
  )
}
