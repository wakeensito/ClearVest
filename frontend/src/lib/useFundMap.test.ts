import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import type { Holding } from '../api/client'
import { renderSeeded, sampleHoldings, seedError, seedFunds } from '../components/portfolio/xray.fixtures'
import { FUND_CAP, fundSymbols, planFundRequests, useFundMap } from './useFundMap'

const etf = (symbol: string, value: number): Holding => ({ symbol, name: symbol, type: 'etf', quantity: 1, price: value, value, weight: 0 })

describe('fundSymbols', () => {
  it('lists distinct uppercase fund symbols, largest first, long positions only', () => {
    const holdings = [etf('qqq', 100), etf('VOO', 300), etf(' qqq ', 250), etf('SHORT', -10), { ...etf('AAPL', 999), type: 'equity' }]
    expect(fundSymbols(holdings)).toEqual(['QQQ', 'VOO'])
    expect(fundSymbols(undefined)).toEqual([])
  })
})

describe('planFundRequests', () => {
  it('requests at most the cap, and marks the rest and invalid tickers as unchecked', () => {
    const symbols = ['BAD FUND', ...Array.from({ length: FUND_CAP + 1 }, (_, i) => `F${i}`)]
    const { requested, unchecked } = planFundRequests(symbols)
    expect(requested).toHaveLength(FUND_CAP)
    expect(requested).not.toContain('BAD FUND')
    expect(unchecked).toEqual(['BAD FUND', `F${FUND_CAP}`])
  })
})

function Probe({ holdings }: { holdings: Holding[] }) {
  const { funds, loaded, total, pending, unchecked, failed } = useFundMap(holdings)
  return h('pre', null, JSON.stringify({ keys: Object.keys(funds).sort(), loaded, total, pending, unchecked, failed }))
}
const probe = (holdings: Holding[], seed: Parameters<typeof renderSeeded>[1]) =>
  JSON.parse(renderSeeded(h(Probe, { holdings }), seed).replace(/<\/?pre>/g, '').replace(/&quot;/g, '"'))

describe('useFundMap', () => {
  it('sorts each requested fund into loaded, pending or failed, and counts distinct symbols', () => {
    const holdings = [...sampleHoldings().holdings, etf('BAD FUND', 5)]
    const state = probe(holdings, (c) => { seedFunds(c, ['VOO']); seedError(c, ['fund', 'QQQ']) })
    expect(state).toEqual({ keys: ['VOO'], loaded: 1, total: 4, pending: ['VGT'], unchecked: ['BAD FUND'], failed: ['QQQ'] })
  })
})
