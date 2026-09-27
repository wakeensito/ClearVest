import { expect, it } from 'vitest'
import type { ChatMessage } from './chatContext'
import { showMe } from './showMe'
import { scoutContext } from './scoutContext'
const message: ChatMessage = { id: '1', role: 'advisor', text: 'An explanation.', safety: { status: 'passed', grounding: 'checked' } }
it('returns exact app destinations for selections instead of model links', () => {
  expect(showMe({ ...message, text: 'Open https://example.com', context: { page: 'markets', symbol: 'AAPL', metric: 'price', range: '5y', priceDate: '2026-01-02' } })?.to).toBe('/markets?symbol=AAPL&focus=price&range=5y&metric=price&priceDate=2026-01-02')
  expect(showMe({ ...message, context: { page: 'advisor', scenario: { symbol: 'NVDA', dropPct: 32 } } })?.to).toBe('/advisor?tool=scenario&symbol=NVDA&drop=32&focus=scenario')
  expect(showMe({ ...message, context: { page: 'portfolio', symbol: 'VOO', metric: 'holding' } })?.to).toBe('/portfolio?focus=holding&holding=VOO')
})
it('does not offer actions for unavailable or unscoped answers', () => {
  expect(showMe({ ...message, safety: { status: 'unavailable', grounding: 'unavailable' } })).toBeNull()
  expect(showMe(message)).toBeNull()
})
it('accepts only complete valid price-date identifiers from navigation', () => {
  expect(scoutContext('/markets', '?symbol=AAPL&range=5y&metric=price&priceDate=2026-01-02').priceDate).toBe('2026-01-02')
  for (const query of ['?metric=price&priceDate=2026-02-31', '?symbol=bad!&metric=price&priceDate=2026-01-02', '?range=bad&metric=price&priceDate=2026-01-02', '?symbol=AAPL&metric=revenue&priceDate=2026-01-02']) expect(scoutContext('/markets', query).priceDate).toBeUndefined()
})
