import type { ChatMessage } from './chatContext'

/** Only app-owned destinations are offered; model prose never becomes a navigation URL. */
export function showMe(message: ChatMessage): { label: string; to: string } | null {
  if (message.safety?.status !== 'passed') return null
  const c = message.context
  const symbol = c?.symbol && /^[A-Z0-9.^-]{1,12}$/.test(c.symbol) ? c.symbol : undefined
  if (c?.scenario && /^[A-Z0-9.^-]{1,12}$/.test(c.scenario.symbol) && Number.isInteger(c.scenario.dropPct) && c.scenario.dropPct >= 0 && c.scenario.dropPct <= 60)
    return { label: 'Show me this scenario', to: `/advisor?tool=scenario&symbol=${encodeURIComponent(c.scenario.symbol)}&drop=${c.scenario.dropPct}&focus=scenario` }
  if (c?.metric === 'exposure') return { label: 'Show me what I own', to: `/advisor?tool=ownership&focus=ownership${symbol ? `&symbol=${encodeURIComponent(symbol)}` : ''}` }
  if (c?.metric === 'holding' && symbol) return { label: `Show me my ${symbol} holding`, to: `/portfolio?focus=holding&holding=${encodeURIComponent(symbol)}` }
  if (c?.metric === 'risk') return { label: 'Show me my risk score', to: '/portfolio?focus=risk' }
  if (symbol) {
    const params = new URLSearchParams({ symbol, focus: c?.metric === 'price' ? 'price' : 'company' })
    if (c?.range && ['1y','5y','10y'].includes(c.range)) params.set('range', c.range)
    if (c?.metric) params.set('metric', c.metric)
    if (c?.priceDate && /^\d{4}-\d{2}-\d{2}$/.test(c.priceDate)) params.set('priceDate', c.priceDate)
    return { label: c?.metric === 'price' ? `Show me the ${symbol} chart` : `Show me ${symbol} research`, to: `/markets?${params}` }
  }
  if (message.sources?.some(s => s.kind === 'portfolio')) return { label: 'Show me my portfolio', to: '/portfolio?focus=risk' }
  return null
}
