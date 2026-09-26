import { lazy, Suspense } from 'react'
import { Card } from '../ui/Card'
import { SkeletonBlock } from '../ui/Skeleton'

const Research = lazy(() => import('./SecurityResearch').then((module) => ({ default: module.SecurityResearch })))

/** Load chart code only on portfolio/research screens, keeping onboarding and chat lighter. */
export function SecurityResearch(props: { initialSymbol?: string; compact?: boolean; title?: string; onSymbolChange?: (symbol: string) => void }) {
  return <Suspense fallback={<Card title="Security research"><SkeletonBlock label="Loading research chart" /></Card>}><Research {...props} /></Suspense>
}
