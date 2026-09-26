import type { Holding } from '../../api/client'
import { ASSET_TYPES, normalizeType, typeColor, typeLabel, type AssetType } from '../../lib/assetTypes'
import { currencyCompact, percentFromFraction } from '../../lib/format'
import styles from './AllocationBar.module.css'

interface Slice {
  type: AssetType
  value: number
  share: number
}

/** Long positions grouped by asset type, in the fixed viz order (DESIGN.md §4.6). */
function allocationSlices(holdings: Holding[]): Slice[] {
  const totals = new Map<AssetType, number>()
  for (const h of holdings) {
    if (h.value <= 0) continue
    const t = normalizeType(h.type)
    totals.set(t, (totals.get(t) ?? 0) + h.value)
  }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0)
  return ASSET_TYPES.filter((t) => totals.has(t)).map((type) => {
    const value = totals.get(type) ?? 0
    return { type, value, share: sum ? value / sum : 0 }
  })
}

export function AllocationBar({ holdings, hideValues = false }: { holdings: Holding[]; hideValues?: boolean }) {
  const slices = allocationSlices(holdings)
  if (!slices.length) return null
  const hasShorts = holdings.some((h) => h.value < 0)

  return (
    <figure className={styles.figure}>
      <div
        className={styles.bar}
        role="img"
        aria-label={`Allocation: ${slices.map((s) => `${typeLabel(s.type)} ${percentFromFraction(s.share)}`).join(', ')}`}
      >
        {slices.map((s) => (
          <span key={s.type} style={{ flexGrow: s.share, background: typeColor(s.type) }} />
        ))}
      </div>
      <figcaption>
        <ul role="list" className={styles.legend}>
          {slices.map((s) => (
            <li key={s.type}>
              <span className={styles.swatch} style={{ background: typeColor(s.type) }} aria-hidden />
              <span className="t-body-sm c-secondary">{typeLabel(s.type)}</span>
              <span className="t-body-sm num">{percentFromFraction(s.share)}</span>
              <span className="t-body-sm c-tertiary num">{hideValues ? 'Hidden' : currencyCompact(s.value)}</span>
            </li>
          ))}
        </ul>
        {hasShorts && <p className="t-caption c-tertiary">Short positions are excluded from this bar.</p>}
      </figcaption>
    </figure>
  )
}
