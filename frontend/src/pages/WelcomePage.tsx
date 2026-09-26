import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import type { Profile } from '../api/client'
import { describeError, hasCode } from '../api/errors'
import { useProfile, useSaveProfile } from '../api/queries'
import { Wordmark } from '../components/AppShell'
import { LinkAccountCard } from '../components/LinkAccountCard'
import { Banner } from '../components/ui/Banner'
import { Button, ButtonLink } from '../components/ui/Button'
import { ChipInput } from '../components/ui/ChipInput'
import { Field, RadioCards, TextInput, type Choice } from '../components/ui/Field'
import { SkeletonBlock } from '../components/ui/Skeleton'
import styles from './WelcomePage.module.css'

const HORIZONS: Choice<Profile['horizon']>[] = [
  { value: 'short', label: 'Under 3 years' },
  { value: 'medium', label: '3–10 years' },
  { value: 'long', label: '10+ years' },
]

const TOLERANCES: Choice<Profile['riskTolerance']>[] = [
  { value: 'low', label: 'Low', description: 'Steady matters more than growth.' },
  { value: 'medium', label: 'Medium', description: 'Some ups and downs for more growth.' },
  { value: 'high', label: 'High', description: 'Comfortable with large swings.' },
]

const GOAL_SUGGESTIONS = ['Retire early', 'Buy a home', 'Build an emergency fund', 'Pay for education']

const POINTS = [
  { image: 'your-goals', title: 'Tell us your situation', body: 'Your age, time horizon and goals shape every explanation.' },
  { image: 'linked-account', title: 'Link a brokerage account', body: 'Holdings are read through Plaid. ClearVest cannot place trades.' },
  { image: 'clear-conversation', title: 'Ask in plain language', body: 'Figures are calculated by ClearVest, then explained, never guessed.' },
]

export function WelcomePage() {
  const [params] = useSearchParams()
  const editing = params.has('edit')
  const [step, setStep] = useState<'profile' | 'link'>('profile')
  const navigate = useNavigate()
  const location = useLocation()
  // Only return to known app pages; direct visits to the editor return to the portfolio.
  const requestedReturn = location.state?.returnTo
  const returnTo = typeof requestedReturn === 'string' && /^\/(portfolio|advisor|markets|learn)([?#]|$)/.test(requestedReturn)
    ? requestedReturn : '/portfolio'
  const leaveEditing = () => navigate(returnTo, { replace: true })
  const profile = useProfile()
  const isNew = hasCode(profile.error, 'NOT_FOUND')

  return (
    <div className={styles.page}>
      <aside className={styles.panel}>
        <div className={styles.panelInner}>
          <h2 className={`t-display ${styles.statement}`}>Understand what you own, and why it matters to you.</h2>
          <ul className={styles.points} role="list">
            {POINTS.map((p) => (
              <li key={p.title}>
                <img className={styles.illustration} src={`/images/onboarding/${p.image}.svg`} width="80" height="80" alt="" />
                <div>
                  <p className="t-body-strong">{p.title}</p>
                  <p className={`t-body-sm ${styles.panelMuted}`}>{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className={`t-caption ${styles.panelMuted}`}>Educational information, not financial advice.</p>
        </div>
      </aside>

      <main className={styles.content}>
        <header className={styles.top}>
          <Wordmark />
          <ButtonLink to="/learn" variant="tertiary">Explore first</ButtonLink>
        </header>

        <div className={`${styles.form} reveal`}>
          {!editing && <Steps current={step === 'profile' ? 1 : 2} />}

          {step === 'profile' ? (
            profile.isPending ? (
              <SkeletonBlock lines={6} label="Loading profile" />
            ) : (
              <ProfileForm
                key={profile.dataUpdatedAt}
                initial={profile.data}
                editing={editing}
                loadError={!isNew && profile.isError ? profile.error : null}
                onSaved={() => (editing ? leaveEditing() : setStep('link'))}
                onCancel={leaveEditing}
              />
            )
          ) : (
            <div className={styles.linkStep}>
              <div>
                <h1 className="t-h1">Link your account</h1>
                <p className={`t-body c-secondary ${styles.lede}`}>
                  With your holdings, ClearVest can show your allocation, score your risk and ground every answer in
                  your actual numbers.
                </p>
              </div>
              <LinkAccountCard onLinked={() => navigate('/portfolio')} />
              <ButtonLink to="/portfolio" variant="tertiary" arrow>
                Skip for now
              </ButtonLink>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function Steps({ current }: { current: 1 | 2 }) {
  return (
    <div className={styles.steps}>
      <p className="t-overline c-tertiary">
        Step {current} of 2 · {current === 1 ? 'Your situation' : 'Your account'}
      </p>
      <div className={styles.stepBar} aria-hidden>
        <span data-on="" />
        <span data-on={current === 2 ? '' : undefined} />
      </div>
    </div>
  )
}

interface Errors {
  age?: string
  horizon?: string
  riskTolerance?: string
}

function validate(age: string, horizon?: string, risk?: string): Errors {
  const errors: Errors = {}
  const n = Number(age)
  if (!age.trim()) errors.age = 'Enter your age.'
  else if (!Number.isInteger(n) || n < 13 || n > 120) errors.age = 'Enter a whole number from 13 to 120.'
  if (!horizon) errors.horizon = 'Choose a time horizon.'
  if (!risk) errors.riskTolerance = 'Choose a risk tolerance.'
  return errors
}

function ProfileForm({ initial, editing, loadError, onSaved, onCancel }: {
  initial?: Profile
  editing: boolean
  loadError: unknown
  onSaved: () => void
  onCancel: () => void
}) {
  const save = useSaveProfile()
  const [age, setAge] = useState(initial ? String(initial.age) : '')
  const [horizon, setHorizon] = useState<Profile['horizon'] | undefined>(initial?.horizon)
  const [risk, setRisk] = useState<Profile['riskTolerance'] | undefined>(initial?.riskTolerance)
  const [goals, setGoals] = useState<string[]>(initial?.goals ?? [])
  const [errors, setErrors] = useState<Errors>({})

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const found = validate(age, horizon, risk)
    setErrors(found)
    if (Object.keys(found).length || !horizon || !risk) return
    save.mutate({ age: Number(age), horizon, riskTolerance: risk, goals }, { onSuccess: onSaved })
  }

  return (
    <form className={styles.fields} onSubmit={submit} noValidate>
      <div>
        <h1 className="t-h1">{editing ? 'Edit your profile' : 'Tell us about your situation'}</h1>
        <p className={`t-body c-secondary ${styles.lede}`}>
          Your age, goals and comfort with risk help us explain your investments in context.
        </p>
      </div>

      {Boolean(loadError) && <Banner tone="warning">{describeError(loadError, 'Your saved profile')}</Banner>}

      <Field label="Age" error={errors.age}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            inputMode="numeric"
            autoComplete="off"
            value={age}
            onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
            onBlur={() => age && setErrors((x) => ({ ...x, age: validate(age, 'x', 'x').age }))}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={styles.age}
          />
        )}
      </Field>

      <Field as="fieldset" label="When might you need this money?" error={errors.horizon}>
        {({ describedBy }) => (
          <RadioCards name="horizon" options={HORIZONS} value={horizon} onChange={setHorizon} describedBy={describedBy} />
        )}
      </Field>

      <Field as="fieldset" label="How comfortable are you with changes in value?" error={errors.riskTolerance}>
        {({ describedBy }) => (
          <RadioCards name="risk" options={TOLERANCES} value={risk} onChange={setRisk} describedBy={describedBy} />
        )}
      </Field>

      <Field label="Goals (optional)" help="Press Enter after each goal. Up to 10.">
        {({ id, describedBy }) => (
          <ChipInput
            id={id}
            value={goals}
            onChange={setGoals}
            suggestions={GOAL_SUGGESTIONS}
            describedBy={describedBy}
            placeholder="e.g. Buy a home in 5 years"
          />
        )}
      </Field>

      {save.error && <Banner tone="error">{describeError(save.error, 'Saving your profile')}</Banner>}

      <div className={styles.submit}>
        <Button type="submit" variant="primary" size="large" loading={save.isPending} loadingLabel="Saving" arrow={!editing}>
          {editing ? 'Save profile' : 'Continue'}
        </Button>
        {editing && <Button type="button" variant="secondary" size="large" disabled={save.isPending} onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  )
}
