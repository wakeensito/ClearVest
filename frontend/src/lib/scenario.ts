import type { Holdings } from '../api/client'

/** Mechanical price shock; no forecast, correlations, fees or new risk score. */
export function scenarioResult(snapshot: Holdings, symbol: string, dropPct: number) {
  if (!Number.isInteger(dropPct) || dropPct < 0 || dropPct > 60 || !Number.isFinite(snapshot.totalValue) || snapshot.totalValue <= 0) return null
  if (snapshot.holdings.some(h => !Number.isFinite(h.value) || h.value < 0 || h.type === 'derivative')) return null
  const positionValue = snapshot.holdings.filter(h => h.symbol === symbol && h.type !== 'cash').reduce((sum,h) => sum + h.value, 0)
  if (!positionValue || positionValue > snapshot.totalValue) return null
  const loss = Math.round((positionValue * dropPct / 100 + Number.EPSILON) * 100) / 100
  return {before:snapshot.totalValue, after:Math.round((snapshot.totalValue-loss)*100)/100, loss, positionValue,
    weight:positionValue/snapshot.totalValue, portfolioDropPct:loss/snapshot.totalValue*100}
}
