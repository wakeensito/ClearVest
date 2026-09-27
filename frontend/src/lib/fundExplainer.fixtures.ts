// Realistic /market/fund payloads (provider wording from yfinance), shared by unit and render tests
// and mirrored in scripts/fund-explainer-smoke.cjs.
import type { Fund, FundHolding } from '../api/client'

export const TOP_TEN: FundHolding[] = [
  { symbol: 'NVDA', name: 'NVIDIA Corp', weight: 0.08082 },
  { symbol: 'AAPL', name: 'Apple Inc', weight: 0.070339 },
  { symbol: 'MSFT', name: 'Microsoft Corp', weight: 0.056958 },
  { symbol: 'AMZN', name: 'Amazon.com Inc', weight: 0.038 },
  { symbol: 'META', name: 'Meta Platforms Inc Class A', weight: 0.029 },
  { symbol: 'AVGO', name: 'Broadcom Inc', weight: 0.025 },
  { symbol: 'GOOGL', name: 'Alphabet Inc Class A', weight: 0.021 },
  { symbol: 'TSLA', name: 'Tesla Inc', weight: 0.019 },
  { symbol: 'GOOG', name: 'Alphabet Inc Class C', weight: 0.017 },
  { symbol: 'BRK-B', name: 'Berkshire Hathaway Inc Class B', weight: 0.016 },
]

export const VOO: Fund = {
  symbol: 'VOO',
  name: 'Vanguard S&P 500 ETF',
  kind: 'etf',
  isIndexFund: true,
  tracks: "Standard & Poor's 500 Index",
  expenseRatio: 0.0003,
  holdingsCount: 504,
  topHoldings: TOP_TEN,
  summary: 'VOO is a fund that owns shares of about 500 of the biggest U.S. companies. When they do well, it does well.',
  summarySource: 'template',
  asOf: '2026-09-26',
  fundFamily: 'Vanguard',
  category: 'Large Blend',
  sector: null,
}

export const VFIAX: Fund = {
  ...VOO,
  symbol: 'VFIAX',
  name: 'Vanguard 500 Index Admiral',
  kind: 'mutual_fund',
  expenseRatio: 0.0004,
  summary: 'VFIAX is a mutual fund that owns shares of about 500 of the biggest U.S. companies.',
}

export const AAPL: Fund = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  kind: 'stock',
  isIndexFund: false,
  tracks: null,
  expenseRatio: null,
  holdingsCount: null,
  topHoldings: [],
  summary: 'Apple makes the iPhone, Mac and other devices, and sells services like iCloud.',
  summarySource: 'model',
  asOf: '2026-09-26',
  fundFamily: null,
  category: null,
  sector: 'Technology',
}
