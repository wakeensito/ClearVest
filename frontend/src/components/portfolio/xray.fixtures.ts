// Shared test data for OwnershipXray / PlanVsActual: the Plaid sandbox sample account
// (src/layer/clearvest/providers/plaid.py) with 2026-09-26 prices, and three fund fixtures.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement as h, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import type { Fund, Holding, Holdings, Template } from '../../api/client'
import { VOO } from '../../lib/fundExplainer.fixtures'

const ROWS = [
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'etf', quantity: 15, price: 710.79 },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf', quantity: 6, price: 744.5 },
  { symbol: 'VGT', name: 'Vanguard Information Technology ETF', type: 'etf', quantity: 8, price: 126.17 },
  { symbol: 'NVDA', name: 'NVIDIA Corp', type: 'equity', quantity: 12, price: 225.07 },
  { symbol: 'AAPL', name: 'Apple Inc', type: 'equity', quantity: 10, price: 341.07 },
  { symbol: 'CUR:USD', name: 'Cash', type: 'cash', quantity: 1500, price: 1 },
]

export function sampleHoldings(): Holdings {
  const rows = ROWS.map((r) => ({ ...r, value: r.quantity * r.price }))
  const total = rows.reduce((s, r) => s + r.value, 0)
  const holdings: Holding[] = rows.map((r) => ({ ...r, weight: r.value / total }))
  return { asOf: '2026-09-26', totalValue: total, holdings }
}

export const QQQ_FUND: Fund = {
  ...VOO,
  symbol: 'QQQ',
  name: 'Invesco QQQ Trust',
  tracks: 'NASDAQ-100 Index',
  expenseRatio: 0.002,
  fundFamily: 'Invesco',
  category: 'Large Growth',
  topHoldings: [
    { symbol: 'NVDA', name: 'NVIDIA Corp', weight: 0.09 },
    { symbol: 'AAPL', name: 'Apple Inc', weight: 0.08 },
    { symbol: 'MSFT', name: 'Microsoft Corp', weight: 0.075 },
  ],
}

export const VGT_FUND: Fund = {
  ...VOO,
  symbol: 'VGT',
  name: 'Vanguard Information Technology ETF',
  tracks: 'MSCI US IMI Information Technology 25/50',
  expenseRatio: 0.0009,
  category: 'Technology',
  topHoldings: [
    { symbol: 'NVDA', name: 'NVIDIA Corp', weight: 0.17 },
    { symbol: 'AAPL', name: 'Apple Inc', weight: 0.15 },
    { symbol: 'MSFT', name: 'Microsoft Corp', weight: 0.13 },
  ],
}

export const FUNDS: Record<string, Fund> = { VOO, QQQ: QQQ_FUND, VGT: VGT_FUND }

export const TEMPLATES: Template[] = [
  { id: 'sixty-forty', name: 'Classic 60/40', description: 'A traditional balanced portfolio: 60% total US stock market, 40% total US bond market.', allocations: [{ asset: 'VTI', weight: 0.6 }, { asset: 'BND', weight: 0.4 }] },
  { id: 'three-fund', name: 'Bogleheads three-fund', description: 'US stocks, international stocks and US bonds in one example weighting.', allocations: [{ asset: 'VTI', weight: 0.5 }, { asset: 'VXUS', weight: 0.3 }, { asset: 'BND', weight: 0.2 }] },
  { id: 'buffett-90-10', name: 'Buffett 90/10', description: 'Ninety percent in a low-cost S&P 500 fund, ten percent in short-term government bonds.', allocations: [{ asset: 'VOO', weight: 0.9 }, { asset: 'SHV', weight: 0.1 }] },
]

export const text = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ')

/** Renders `node` with a fresh client seeded by `seed`, like the page would after those queries resolved. */
export function renderSeeded(node: ReactNode, seed: (client: QueryClient) => void): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } })
  seed(client)
  return renderToStaticMarkup(h(QueryClientProvider, { client }, h(MemoryRouter, { initialEntries: ['/portfolio'] }, node)))
}

export function seedFunds(client: QueryClient, symbols = Object.keys(FUNDS)) {
  for (const s of symbols) client.setQueryData(['fund', s], FUNDS[s])
}

/** Puts a query in the error state without fetching (SSR renders never run effects). */
export function seedError(client: QueryClient, queryKey: readonly unknown[]) {
  client.getQueryCache().build(client, { queryKey }).setState({ status: 'error', error: new Error('boom'), fetchStatus: 'idle' })
}
