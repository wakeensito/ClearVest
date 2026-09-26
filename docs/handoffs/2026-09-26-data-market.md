# MarketFn: risk score, FRED macro, history/comparison, portfolio templates

- **Date:** 2026-09-26
- **Author:** @wakeensito
- **Team:** data
- **Status:** done
- **PR / issue:** #20, #21, #23, #24, #26
- **Branch:** feat/backend-iac
- **Follows:** 2026-09-26-data-sec-edgar-setup.md, 2026-09-26-backend-sam-stack.md

## What changed

- `clearvest.risk.score()` (shared layer, so `AdvisorFn` can use it too): a deterministic 0–100 portfolio
  risk score — `0.7 * asset-mix risk + 0.3 * single-name concentration`, shifted for the profile's horizon
  and age. Bands: 0–33 Conservative, 34–66 Moderate, 67–100 Aggressive. `GET /portfolio/risk` serves it.
- `GET /market/macro`: FRED snapshot (fed funds, CPI YoY, unemployment, wage growth, 10-year), cached and
  reused by the advisor prompt.
- `GET /market/history?symbols=&range=`: per-symbol price series with `returnPct` and annualized
  `volatility`, source order **yfinance → FMP → Alpha Vantage** with a 24h cache and stale-on-failure
  fallback. Symbols (1–5) are fetched in parallel threads; the response keeps request order.
- `GET /market/compare-companies?symbols=`: normalized ratios (P/E, P/S, gross margin, revenue growth,
  EPS TTM, FCF/share, debt-to-equity) from FMP, with EDGAR's own revenue-growth calc preferred when
  available (falls back to FMP's if EDGAR is down or the ticker has no EDGAR company facts, e.g. ETFs).
- `/market/compare-companies` (2–4 symbols) also fetches per symbol in parallel. `MarketFn` runs with a 29s
  timeout (API Gateway's limit is 30s); yfinance is called with `timeout=4` (its default is 10s).
- `GET /market/templates`: bundled JSON (`src/market/market/data/templates.json`) of well-known allocations
  (60/40, Bogleheads three-fund, All Weather, Buffett 90/10) with a `source` link each — not fetched live.

## How to run / verify it

```bash
source .venv/bin/activate
pytest -q tests/layer/test_risk.py tests/market
```

Env vars needed (names only): `FMP_KEY_PARAM`, `ALPHAVANTAGE_KEY_PARAM`, `FRED_KEY_PARAM`,
`SEC_USER_AGENT_PARAM`.

## Decisions & why

- **Short and margin positions (negative weight) count as invested and get max type-risk (1.0)**, regardless
  of their reported instrument type — they can lose more than 100% of the position, so treating them as
  low-risk "other" would understate the score. They also force a "Borrowed or short positions" factor and
  count toward concentration (review fix, `9290135`).
- **Numbers come from code, never Nova** (spec §6): risk score, returns, volatility, and every ratio here
  are computed in Python; the advisor only explains them.
- **yfinance is the primary price source, FMP and Alpha Vantage are fallbacks**, not the other way around —
  FMP's free tier returns 402 on some ETFs (VOO is the one we hit in testing), and Alpha Vantage's 25
  calls/day budget can't absorb primary traffic.
- **EDGAR's revenue-growth calc is preferred over FMP's** when both are available, reusing the data team's
  tag rule (latest period end, then latest filing date across tag renames) — but EDGAR going down, or the
  symbol being a fund with no company facts (ETFs aren't in EDGAR's company data), never breaks the
  comparison; FMP stands in silently.
- **Templates are bundled JSON, not S3 or a live 13F fetch.** A real "top institutional holders" feature
  (SEC Form 13F) is a stretch item that didn't make the freeze — these four are hand-curated, well-known
  allocations with cited sources instead.
- **Volatility is annualized std-dev of log returns** (`sqrt(periods_per_year)` scaling); for tickers with
  under a year of history this under-annualizes — expect it to read low for very young stocks/ETFs.

## Gotchas

- **FMP free tier 402s on some ETFs** (VOO, seen in testing) — this is exactly why yfinance is primary, not
  a fallback-of-last-resort.
- **Yahoo (yfinance) may throttle or block Lambda IPs** even though it needs no key; FMP/Alpha Vantage +
  the 24h cache are the mitigation, not a guarantee. `yf.set_tz_cache_location("/tmp/yfinance")` is required
  — Lambda's filesystem is read-only outside `/tmp`.
- **Alpha Vantage: 25 calls/day.** It's the last fallback in `history()` for a reason; don't reorder it
  ahead of FMP.
- **EDGAR: 10 req/s across all `sec.gov`/`data.sec.gov`/`efts.sec.gov` hosts, and every request needs the
  `SEC_USER_AGENT` param or you get a 403** — it's an SSM parameter (`SecUserAgentParam`, type `String`,
  not `SecureString`), not an env literal, so it can be rotated without a redeploy of code.
- **Timeout math:** one symbol's worst case is Yahoo 4s → FMP 5s → Alpha Vantage 5s (each GET may retry
  once), which is why symbols run in parallel and `MarketFn` gets 29s. Don't make the fetch sequential
  again or add a fourth source without redoing this.
- FRED returning no usable figures at all (every series missing) is a `502`, and nothing is cached — an
  empty macro snapshot would otherwise sit in the advisor's prompt for 24h. An unexpected EDGAR
  companyfacts payload (no `facts` key) means "no EDGAR growth", and FMP stands in.
- `src/market/requirements.txt` shadows the layer's packages (the function's own deps come first on
  `sys.path`); yfinance brings its own `requests`. If you pin `requests` there, keep it in lockstep with
  `src/layer/requirements.txt`.
- Company comparison intentionally never shows raw dollar figures — ratios and per-share numbers only, so a
  $3T company and a $300B company compare fairly.

## Next steps

1. Plug `clearvest-fmp` (exists), `clearvest-alphavantage`, `clearvest-fred`, `clearvest-sec-user-agent`
   into SSM (see README **Plugging in keys**), deploy, run `scripts/smoke.sh`.
2. 13F-based "who else holds this" is a stretch item — pick up post-freeze if there's time (#26 follow-up).

## Open questions / blockers

- None for this slice.
