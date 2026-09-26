import { useMutation } from '@tanstack/react-query'
import { Link2, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { api } from '../api/client'
import { describeError } from '../api/errors'
import { useOnLinked } from '../api/queries'
import styles from './LinkAccountCard.module.css'
import { Banner } from './ui/Banner'
import { Button } from './ui/Button'

/**
 * Shown for 409 NOT_LINKED and as onboarding step 2 (DESIGN.md §4.14).
 * Flow: /plaid/link-token → Plaid Link → /plaid/exchange. Dev builds also get the sandbox shortcut.
 */
export function LinkAccountCard({ compact, onLinked }: { compact?: boolean; onLinked?: () => void }) {
  const refresh = useOnLinked()
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [plaidError, setPlaidError] = useState<string | null>(null)

  const done = useCallback(async () => {
    await refresh()
    onLinked?.()
  }, [refresh, onLinked])

  const tokenMutation = useMutation({
    mutationFn: api.createLinkToken,
    onSuccess: ({ linkToken }) => setLinkToken(linkToken),
  })
  const exchange = useMutation({ mutationFn: api.exchangePublicToken, onSuccess: done })
  const sandbox = useMutation({ mutationFn: api.sandboxLink, onSuccess: done })

  const busy = tokenMutation.isPending || exchange.isPending || Boolean(linkToken)
  const failure = tokenMutation.error ?? exchange.error ?? sandbox.error

  return (
    <div className={`${styles.card} ${compact ? styles.compact : ''}`}>
      {linkToken && <PlaidLauncher
        token={linkToken}
        onSuccess={(publicToken) => {
          setLinkToken(null)
          if (publicToken) exchange.mutate(publicToken)
          else setPlaidError('Plaid did not return an account. Try again.')
        }}
        onExit={(message) => { setLinkToken(null); if (message) setPlaidError(message) }}
      />}
      <div className={styles.icon} aria-hidden>
        <Link2 size={20} />
      </div>
      <div className={styles.body}>
        <h3 className={compact ? 't-h3' : 't-h2'}>Link a brokerage account</h3>
        <p className="t-body c-secondary">
          ClearVest reads your holdings through Plaid to explain them. We never see your login and can't place trades.
        </p>
        <div className={styles.actions}>
          <Button
            variant="primary"
            onClick={() => {
              setPlaidError(null)
              tokenMutation.mutate()
            }}
            loading={busy}
            loadingLabel={exchange.isPending ? 'Linking' : 'Opening Plaid'}
          >
            Link account
          </Button>
          {import.meta.env.DEV && (
            <Button variant="tertiary" onClick={() => sandbox.mutate()} loading={sandbox.isPending} loadingLabel="Linking">
              Use a sample account
            </Button>
          )}
        </div>
        <p className={`t-caption c-tertiary ${styles.note}`}>
          <ShieldCheck size={14} aria-hidden /> Sandbox only: no real accounts or money.
        </p>
        {plaidError && <p className={`t-body-sm ${styles.error}`}>{plaidError}</p>}
        {failure && <Banner tone="error">{describeError(failure, 'Account linking')}</Banner>}
      </div>
    </div>
  )
}

/** Mount the third-party SDK only after the user requests account linking. */
function PlaidLauncher({ token, onSuccess, onExit }: {
  token: string
  onSuccess: (publicToken: string | null) => void
  onExit: (message: string | null) => void
}) {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess,
    onExit: (error) => onExit(error ? error.display_message || 'Plaid could not finish linking. Try again.' : null),
  })
  useEffect(() => { if (ready) open() }, [ready, open])
  return null
}
