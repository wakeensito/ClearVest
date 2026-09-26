# Markets discovery board, compact research and visual company comparison

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend (includes the market-data API extension)
- **Status:** done (local implementation; not committed or deployed)
- **PR / issue:** No PR opened. Include with `team:frontend` and `team:data` in the shared frontend PR.
- **Branch:** `feat/frontend`
- **Follows:** [Comparison downloads](2026-09-26-frontend-company-comparison-downloads.md), [Market backend](2026-09-26-data-market.md)

## What changed

- Rebuilt `/markets` around a Top 10 most active board, separate gainers/losers and a narrower Security research / Economy panel. Ticker selection opens the corresponding chart; plus adds a company to comparison. The user explicitly chose trading activity as the Top 10 definition.
- Added `GET /market/movers?category=active|gainers|losers`, FMP adapter support, OpenAPI schemas/examples and generated frontend types. Each list gets its own shared one-hour cache and stale/error behavior. No additional keys or infrastructure resources are needed.
- Reworked comparison into removable company chips, suggested industry pairs, three metric groups, zero-based colored bars, explicit values and an optional full table. Draft selection changes are distinguished from displayed results; missing and negative values are handled honestly.
- Replaced the large download area with a compact header menu for CSV/JSON. Existing raw units, source notes, retrieval time and formula-safe CSV export are preserved.
- Added backend ranking/cache/contract coverage and frontend geometry/input tests. Expanded browser coverage to the new workspace and retained full application regression coverage.

## How to run / verify it

```bash
npm run mock
npm run dev -w frontend -- --host 127.0.0.1 --port 5175 --strictPort
# Separate terminal; browser scripts intercept API calls with fixtures:
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5175 node frontend/scripts/company-comparison-smoke.cjs
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5175 npm run test:browser -w frontend
npm run lint
npm run typecheck
npm test
npm run build
python -m pytest -q tests/market tests/test_contract_doc.py tests/test_template.py
ruff check src/market tests/market
```

Frontend verification: lint, TypeScript, 29 unit tests, production build, redesigned Markets browser
smoke and the existing full application browser smoke. Backend verification: 45 market tests plus 12
contract/template tests; Ruff passes for market code/tests. Browser fixtures cover all three lists,
independent failure/retry/stale/empty states, ticker selection, Economy, chip limits/duplicates,
suggested pairs, signed/missing visual values, table view, real downloaded file contents and
320/390/768px layouts. Screenshots are in the ignored `frontend/node_modules/.cache/clearvest-review/`.

An isolated Linux test environment was created at `/tmp/clearvest-markets-venv` using pinned project
dependencies. Linux lacked pip/ensurepip, so pip was bootstrapped inside that temporary environment.
Node and Chromium run on Windows here; set `CLEARVEST_PREVIEW_URL` and optional
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` inside that process if WSL does not forward them. The standard
sandbox still fails on a host mount alias; shell operations used approved escalation.

## Decisions & why

- Existing design tokens remain: canvas #F5F7FA, surfaces #FFFFFF, text #172B46, actions #2457C5,
  rules #DDE3EB and secondary text #536176. SamsungOne, left-aligned labels and right-aligned numbers
  preserve continuity with Portfolio. Discovery is the main column; research is the smaller companion.
- Provider endpoints are documented at [FMP API documentation](https://site.financialmodelingprep.com/developer/docs):
  `/stable/most-actives`, `/stable/biggest-gainers`, `/stable/biggest-losers`. Activity preserves provider
  order. Gainers/losers filter by sign and sort by percentage change. No ranking is fabricated from a
  hardcoded ticker basket. Fixtures exist only in the contract/tests.
- One-hour shared caching balances provider quota and freshness: nominally 72 list refreshes/day if
  every category is continually requested, excluding retries and concurrent cache misses. `fetchedAt`
  is stored with the cached snapshot, so stale fallbacks do not falsely get a new timestamp.
- Normalize FMP `changesPercentage` to fractional `changePct`. Reject nonfinite/invalid quote rows,
  deduplicate tickers and cap lists at ten. Empty arrays are valid empty states; unusable nonempty
  payloads become upstream errors so a last good cache can stand in.
- Comparison visualizations share a scale only within a metric. Signed values have a centered zero;
  missing data has no bar. Company colors carry identity rather than performance/winner judgments.
- Chip editing is local. Explicit Compare or pair selection fetches. Downloads always represent the
  displayed response, never a newer unsubmitted selection, and contain all seven metrics regardless
  of the selected visual group.

## Gotchas

- The new endpoint must be deployed with the backend before a production frontend can load rankings.
  FMP key entitlement and live-provider behavior were not verified; 402/429/provider failures use
  normal error/retry or stale-cache states. No new secrets were read or committed.
- OpenAPI examples are illustrative, not current market quotes. Prism may reuse the active-list
  example across category queries; the dedicated browser smoke supplies category-specific fixtures.
  Real rankings come only from the backend provider calls.
- FMP's universe can include OTC/small companies. "Most active" does not mean recommended, largest
  market cap, or guaranteed returns. Volume itself is absent from these endpoint payloads and is not
  invented in the UI. Provider retrieval time is not a quote timestamp or a market-open indicator.
- Comparison still lacks company metadata/report dates/per-field provenance in the existing contract.
  Its `stale` flag reflects ratios, while growth helpers discard their own stale flags (pre-existing).
- Shared branch already has substantial unrelated uncommitted work. None was committed, pushed or
  deployed here; previous handoffs remain intact. The Portfolio chart keeps its original dimensions.

## Next steps

1. Review `/markets` and `/markets?view=companies` locally using the browser fixtures/screenshots.
2. Validate provider entitlements and deploy the new backend route through the team's protected-main
   PR process, then verify the frontend against the deployed API using `VITE_API_BASE_URL`.
3. Include this handoff in the PR, apply team labels, and require green `ci-ok` before merge.
4. Data team: consider richer quote metadata/reporting periods and complete growth stale propagation
   before promising live timing, currency attribution or precise filing-date comparisons.

## Open questions / blockers

- No local implementation blocker. Deployment and live FMP entitlement checks remain outstanding.
- The user resolved the ranking question: Top 10 means most actively traded stocks.
