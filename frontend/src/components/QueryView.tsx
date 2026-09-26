import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { describeError, isApiError } from '../api/errors'
import { LinkAccountCard } from './LinkAccountCard'
import { Banner } from './ui/Banner'
import { Button } from './ui/Button'
import { SkeletonBlock } from './ui/Skeleton'

interface Props<T> {
  query: UseQueryResult<T>
  /** What's loading, for screen readers ("Loading holdings"). */
  label: string
  /** Names the data in the upstream message ("Market data is temporarily unavailable."). */
  noun?: string
  skeleton?: ReactNode
  children: (data: T) => ReactNode
}

/** Loading, error (by API code) and success for one card (DESIGN.md §11). */
export function QueryView<T>({ query, label, noun, skeleton, children }: Props<T>) {
  if (query.isPending) return <>{skeleton ?? <SkeletonBlock label={label} />}</>
  if (query.isError) {
    return <QueryError error={query.error} noun={noun} onRetry={() => void query.refetch()} retrying={query.isFetching} />
  }
  return <>{children(query.data)}</>
}

export function QueryError({ error, noun, onRetry, retrying }: {
  error: unknown
  noun?: string
  onRetry?: () => void
  retrying?: boolean
}) {
  if (isApiError(error) && error.code === 'NOT_LINKED') return <LinkAccountCard compact />

  const code = isApiError(error) ? error.code : 'INTERNAL'
  const retryable = code !== 'VALIDATION' && code !== 'NOT_FOUND'
  const tone = code === 'UPSTREAM_UNAVAILABLE' || code === 'THROTTLED' ? 'warning' : 'error'

  return (
    <Banner
      tone={tone}
      action={
        retryable &&
        onRetry && (
          <Button variant="secondary" size="compact" onClick={onRetry} loading={retrying} loadingLabel="Retrying">
            Retry
          </Button>
        )
      }
    >
      {describeError(error, noun)}
      {isApiError(error) && code === 'INTERNAL' && error.requestId && (
        <span className="t-caption c-tertiary" style={{ display: 'block', marginTop: 4 }}>
          Reference: <span className="t-mono">{error.requestId}</span>
        </span>
      )}
    </Banner>
  )
}
