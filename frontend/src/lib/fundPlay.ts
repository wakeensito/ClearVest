// Ties the "Be the fund" lesson back to what the user actually holds.
import type { FundPlay } from './lessons'

export interface HeldFund {
  /** Dollars of the fund the user holds. */
  held: number
  /** Dollars of that money that sit in the spotlight company, by the fund's published weight. */
  inside: number
  /** The spotlight holding's weight, as a fraction. */
  weight: number
}

/**
 * How much of the user's money in `play.fund` is really `play.spotlight`. Null when the user does
 * not hold the fund, so the caller falls back to the generic line. Top-10 weights only, so this is
 * exact for the spotlight company but says nothing about the other ~490.
 */
export function heldFund(play: FundPlay, holdings: readonly { symbol: string; value: number }[] | undefined): HeldFund | null {
  const weight = play.holdings.find((h) => h.symbol === play.spotlight)?.weight
  if (weight === undefined || !holdings) return null
  const held = holdings.filter((h) => h.symbol === play.fund).reduce((sum, h) => sum + (Number.isFinite(h.value) ? h.value : 0), 0)
  if (held <= 0) return null
  return { held, inside: held * weight, weight }
}
