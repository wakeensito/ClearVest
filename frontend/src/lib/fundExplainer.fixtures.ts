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
  leveraged: false,
  tracks: "Standard & Poor's 500 Index",
  expenseRatio: 0.0003,
  topHoldings: TOP_TEN,
  summary: 'VOO is a fund that owns shares of about 500 of the biggest U.S. companies. When they do well, it does well.',
  summarySource: 'template',
  asOf: '2026-09-26',
  stale: false,
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
  leveraged: false,
  tracks: null,
  expenseRatio: null,
  topHoldings: [],
  summary: 'Apple makes the iPhone, Mac and other devices, and sells services like iCloud.',
  summarySource: 'model',
  asOf: '2026-09-26',
  stale: false,
  fundFamily: null,
  category: null,
  sector: 'Technology',
}

/** A 3x leveraged Nasdaq-100 ETF: the provider still says it tracks an index. */
export const TQQQ: Fund = {
  ...VOO,
  symbol: 'TQQQ',
  name: 'ProShares UltraPro QQQ',
  leveraged: true,
  tracks: 'NASDAQ-100 Index',
  expenseRatio: 0.0084,
  fundFamily: 'ProShares',
  category: 'Trading--Leveraged Equity',
  topHoldings: [{ symbol: null, name: 'Nasdaq 100 Index Swap Goldman Sachs International', weight: 0.21 }, ...TOP_TEN.slice(0, 4)],
  summary: 'TQQQ tries to move three times as much as the Nasdaq-100 each day.',
}

export const SPX: Fund = { ...AAPL, symbol: '^GSPC', name: 'S&P 500', kind: 'index', sector: null, summarySource: 'template', summary: 'The S&P 500 is a list of about 500 of the biggest U.S. companies.' }
export const BTC: Fund = { ...AAPL, symbol: 'BTC-USD', name: 'Bitcoin USD', kind: 'crypto', sector: null, summarySource: 'template', summary: 'Bitcoin is a digital currency that is not issued by a government.' }

export const BND: Fund = {
  ...VOO,
  symbol: 'BND',
  name: 'Vanguard Total Bond Market ETF',
  tracks: 'Bloomberg U.S. Aggregate Float Adjusted Index',
  category: 'Intermediate Core Bond',
  topHoldings: [],
  summary: 'BND is a fund that lends money to the U.S. government and many companies.',
}

export const QQQ: Fund = {
  ...VOO,
  symbol: 'QQQ',
  name: 'Invesco QQQ Trust',
  expenseRatio: 0.002,
  tracks: 'Nasdaq-100 Index',
  category: 'Large Growth',
  fundFamily: 'Invesco',
  topHoldings: [
    { symbol: 'NVDA', name: 'NVIDIA Corp', weight: 0.091 },
    { symbol: 'AAPL', name: 'Apple Inc', weight: 0.085 },
    { symbol: 'MSFT', name: 'Microsoft Corp', weight: 0.078 },
    { symbol: 'AMZN', name: 'Amazon.com Inc', weight: 0.055 },
    { symbol: 'AVGO', name: 'Broadcom Inc', weight: 0.052 },
    { symbol: 'META', name: 'Meta Platforms Inc Class A', weight: 0.04 },
    { symbol: 'TSLA', name: 'Tesla Inc', weight: 0.034 },
    { symbol: 'GOOGL', name: 'Alphabet Inc Class A', weight: 0.028 },
    { symbol: 'GOOG', name: 'Alphabet Inc Class C', weight: 0.027 },
    { symbol: 'COST', name: 'Costco Wholesale Corp', weight: 0.026 },
  ],
  summary: 'QQQ is a fund that owns the 100 biggest non-financial companies listed on the Nasdaq.',
}

export const VGT: Fund = {
  ...VOO,
  symbol: 'VGT',
  name: 'Vanguard Information Technology ETF',
  expenseRatio: 0.0009,
  tracks: 'MSCI US IMI Info Tech 25/50',
  category: 'Technology',
  fundFamily: 'Vanguard',
  topHoldings: [
    { symbol: 'NVDA', name: 'NVIDIA Corp', weight: 0.162 },
    { symbol: 'AAPL', name: 'Apple Inc', weight: 0.15 },
    { symbol: 'MSFT', name: 'Microsoft Corp', weight: 0.131 },
    { symbol: 'AVGO', name: 'Broadcom Inc', weight: 0.046 },
    { symbol: 'ORCL', name: 'Oracle Corp', weight: 0.028 },
    { symbol: 'PLTR', name: 'Palantir Technologies Inc', weight: 0.022 },
    { symbol: 'CSCO', name: 'Cisco Systems Inc', weight: 0.02 },
    { symbol: 'AMD', name: 'Advanced Micro Devices Inc', weight: 0.019 },
    { symbol: 'CRM', name: 'Salesforce Inc', weight: 0.015 },
    { symbol: 'IBM', name: 'International Business Machines Corp', weight: 0.014 },
  ],
  summary: 'VGT is a fund that owns shares of technology companies such as NVIDIA, Apple and Microsoft.',
}

/** A single stock, not a fund: no holdings, no expense ratio. */
export const NVDA: Fund = {
  ...AAPL,
  symbol: 'NVDA',
  name: 'NVIDIA Corp',
  sector: 'Technology',
  summary: 'NVIDIA designs graphics chips used for gaming, data centers and artificial intelligence.',
  summarySource: 'template',
}

export const VTI: Fund = {
  ...VOO,
  symbol: 'VTI',
  name: 'Vanguard Total Stock Market ETF',
  tracks: 'CRSP US Total Market Index',
  topHoldings: TOP_TEN.map(holding => ({ ...holding, weight: holding.weight * 0.85 })),
  summary: 'VTI is a fund that owns shares of thousands of U.S. companies of all sizes.',
}
