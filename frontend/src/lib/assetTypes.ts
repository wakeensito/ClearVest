// Fixed asset-type → color mapping (DESIGN.md §2.5). Types come from the backend's Plaid normalization.

export const ASSET_TYPES = [
  'equity',
  'etf',
  'mutual fund',
  'fixed income',
  'cryptocurrency',
  'derivative',
  'cash',
  'other',
] as const

export type AssetType = (typeof ASSET_TYPES)[number]

const LABELS: Record<AssetType, string> = {
  equity: 'Stocks',
  etf: 'ETFs',
  'mutual fund': 'Mutual funds',
  'fixed income': 'Bonds',
  cryptocurrency: 'Crypto',
  derivative: 'Derivatives',
  cash: 'Cash',
  other: 'Other',
}

export function normalizeType(type: string): AssetType {
  const t = type.toLowerCase()
  return (ASSET_TYPES as readonly string[]).includes(t) ? (t as AssetType) : 'other'
}

export function typeLabel(type: string): string {
  return LABELS[normalizeType(type)]
}

export function typeColor(type: string): string {
  return `var(--cv-viz-${ASSET_TYPES.indexOf(normalizeType(type)) + 1})`
}
