import { ArrowUp, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router'
import { describeError } from '../../api/errors'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Dots } from '../../components/ui/Dots'
import { Section } from '../../components/ui/Section'
import { ContextRail } from './ContextRail'
import styles from './AdvisorPage.module.css'
import { SUGGESTED_PROMPTS, useChat } from './chatContext'
import { Markdown } from './Markdown'

const MAX = 2000
const COUNTER_FROM = 1800

export function AdvisorPage() {
  const chat = useChat()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState(() => params.get('q') ?? '')
  const [confirming, setConfirming] = useState(false)
  const [clearing, setClearing] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // A prompt handed over from the dashboard pre-fills the composer; it's never sent automatically.
  useEffect(() => {
    if (params.has('q')) {
      setParams({}, { replace: true })
      inputRef.current?.focus()
    }
  }, [params, setParams])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [chat.messages.length, chat.pending])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!draft.trim() || chat.pending) return
    chat.send(draft)
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
  }

  const clear = async () => {
    setClearing(true)
    try {
      await chat.clear()
      setConfirming(false)
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className={styles.page}>
      <Section
        level={1}
        bare
        eyebrow="Advisor"
        title="Ask about your money"
        actions={
          chat.messages.length > 0 && (
            <Button variant="tertiary" size="compact" icon={<Trash2 size={16} aria-hidden />} onClick={() => setConfirming(true)}>
              Clear history
            </Button>
          )
        }
      />

      <div className={styles.layout}>
        <div className={`${styles.chat} reveal`}>
          <div className={styles.thread} aria-live="polite" aria-busy={chat.pending}>
            {chat.messages.length === 0 && (
              <div className={styles.empty}>
                <p className="t-h2">What would you like to understand?</p>
                <p className="t-body c-secondary">
                  Answers use your linked holdings, your profile and current economic data. Numbers are calculated by
                  ClearVest, not guessed by the model.
                </p>
                <div className={styles.prompts}>
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button key={p} type="button" className={styles.prompt} onClick={() => chat.send(p)} disabled={chat.pending}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chat.messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className={styles.userRow}>
                  <p className={styles.user}>{m.text}</p>
                  {m.failed && (
                    <p className={`t-body-sm ${styles.failed}`}>
                      Not answered.{chat.error ? ` ${describeError(chat.error, 'The advisor')}` : ''}{' '}
                      <button type="button" onClick={() => chat.retry(m.id)} disabled={chat.pending}>
                        Retry
                      </button>
                    </p>
                  )}
                </div>
              ) : (
                <article key={m.id} className={styles.advisor}>
                  <p className="t-overline c-tertiary">ClearVest</p>
                  <div className={styles.reply}>
                    <Markdown text={m.text} />
                  </div>
                </article>
              ),
            )}

            {chat.pending && (
              <div className={styles.advisor}>
                <p className="t-overline c-tertiary">ClearVest</p>
                <p className={`t-body c-secondary ${styles.pending}`}>
                  <Dots />
                  <span className={styles.pendingText}>
                    <span className={styles.pendingNow}>Reviewing your portfolio</span>
                    <span className={styles.pendingSlow}>Still working. This can take up to 30 seconds.</span>
                  </span>
                </p>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className={styles.composer} onSubmit={submit}>
            <label htmlFor="advisor-input" className="sr-only">
              Your question
            </label>
            <div className={styles.inputRow}>
              <textarea
                id="advisor-input"
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
                onKeyDown={onKeyDown}
                rows={1}
                maxLength={MAX}
                placeholder="Ask about your portfolio, risk or retirement accounts"
                className={styles.input}
              />
              <button type="submit" className={styles.send} disabled={!draft.trim() || chat.pending} aria-label="Send">
                <ArrowUp size={20} aria-hidden />
              </button>
            </div>
            <div className={styles.meta}>
              <p className="t-caption c-tertiary">{chat.disclaimer}</p>
              {draft.length >= COUNTER_FROM && (
                <p className={`t-caption num ${draft.length >= MAX ? 'c-loss' : 'c-tertiary'}`}>
                  {draft.length.toLocaleString('en-US')}/{MAX.toLocaleString('en-US')}
                </p>
              )}
            </div>
          </form>
        </div>

        <ContextRail />
      </div>

      <ConfirmDialog
        open={confirming}
        title="Clear chat history?"
        confirmLabel="Clear history"
        busy={clearing}
        onConfirm={() => void clear()}
        onClose={() => setConfirming(false)}
      >
        The advisor forgets this conversation and future answers start fresh. Your profile and linked account stay as
        they are.
      </ConfirmDialog>
    </div>
  )
}
