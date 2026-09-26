# Compact market widgets, full-screen research comparison and related news

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend (includes market news backend)
- **Status:** done (local implementation; not committed or deployed)
- **PR / issue:** No PR opened. Include with `team:frontend` and `team:data` in the shared frontend PR.
- **Branch:** `feat/frontend`
- **Follows:** [Markets discovery revamp](2026-09-26-frontend-markets-discovery-revamp.md), [Company comparison downloads](2026-09-26-frontend-company-comparison-downloads.md)

## What changed

- Turned the overview/comparison navigation into clear buttons. Replaced the tall discovery board with
  two compact widgets: most active shows five of ten rows in a keyboard-scrollable viewport; the
  second switches between gainers and losers in place. Only the selected movers category loads.
- Added FMP logo images to company lists, research panels, comparison selections/legend and news
  attribution, with accessible ticker-initial fallbacks for missing image coverage.
- Moved Security research to a large full-width surface below the widgets. Its Compare securities
  button opens a native full-screen dialog with two independently searchable charts, a short opening
  transition, keyboard/table inspection, individual ranges and local error/retry states. Added real
  annualized volatility and observation count from the existing history response.
- Added Market news below research and in the two-chart dialog. It follows submitted securities,
  offers a market-wide option and explicitly falls back to broader headlines when related news is
  empty. Publisher links, optional article images and calendar publication dates are retained.
- Added the cached `/market/news` endpoint, OpenAPI/generated types and provider adapter, plus news
  backend tests and expanded browser verification. The subtle CSV/JSON menu remains in fundamentals.

## How to run / verify it

```bash
npm run mock
npm run dev -w frontend -- --host 127.0.0.1 --port 5175 --strictPort
# Separate terminal; scripts intercept API calls with fixtures:
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5175 node frontend/scripts/company-comparison-smoke.cjs
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5175 npm run test:browser -w frontend
npm run lint
npm run typecheck
npm test
npm run build
python -m pytest -q tests/market tests/test_contract_doc.py tests/test_template.py
ruff check src/market tests/market
```

Verification: frontend lint/typecheck/build and 29 unit tests; 66 market/contract/template backend
tests and market Ruff checks. Both redesigned Markets and full application browser suites pass.
New checks cover exactly five visible rows with ten scrollable entries, mover switching, logo image
and fallback paths, independent chart symbols/ranges/table views, no request for an empty second
symbol, one-side provider failure/retry, full-screen Escape/Exit, focus return, restored scrolling,
reduced motion, related and market-wide news, labelled fallback, news error/retry/stale states,
mobile overflow and retained fundamentals/download behavior.

Screenshots are in the ignored `frontend/node_modules/.cache/clearvest-review/` directory, including
`markets-overview-desktop.png` and `research-compare-desktop.png`. Browser data and test logo images
are fixtures, not current prices/news or proof of live entitlement. The previous handoff documents
this environment's Windows Node/Chromium and temporary Linux Python tooling. Public AAPL, MSFT and NVDA logo URLs were also verified to return HTTP 200 image/png. No live news
API key was read for this change.

## Decisions & why

- Kept the established white/navy/cobalt palette and SamsungOne. The compact lists support discovery;
  research is the main surface. The full-screen view gives each chart meaningful room instead of
  squeezing two plots into the previous narrow companion column.
- Native `<dialog>` supplies modal focus containment and Escape. Its close event restores the Compare
  trigger; the body scroll lock restores its previous value on close/unmount. Two 280ms CSS entry
  animations are disabled under reduced motion; close remains visible in a sticky header.
- Each panel keeps its own symbol, range and query. The second begins empty, so no arbitrary stock is
  chosen for the user and no invalid blank-symbol provider request occurs. Empty, error, cached and
  successful states are independent. News deduplicates/sorts up to two submitted symbols for cache keys.
- FMP endpoints: [ticker news](https://site.financialmodelingprep.com/developer/docs/stable/search-stock-news)
  uses `/stable/news/stock?symbols=...`; [market stock news](https://site.financialmodelingprep.com/developer/docs/stable/stock-news)
  uses `/stable/news/stock-latest`. Responses are cached for one hour by scope, capped at six and
  deduplicated by publisher URL. No generated summaries, article bodies or significance scores.
- [FMP profile examples](https://site.financialmodelingprep.com/developer/docs) document public logo
  images at `https://images.financialmodelingprep.com/symbol/<SYMBOL>.png`. Requests use no referrer;
  failed images become initials rather than broken-image icons. News image failures have a separate
  neutral fallback. External article links use `noopener noreferrer`.
- Backend rejects non-web article URLs/credentials, strips unsafe image URLs and filters related
  responses to requested symbols. Invalid nonempty payloads trigger upstream failure/stale-cache
  behavior; a valid empty related result triggers the explicit broader-news fallback in the frontend.

## Gotchas

- Both `/market/movers` and `/market/news` must be deployed before the production frontend can use
  them. Existing `FMP_KEY_PARAM` is reused; live key entitlement/rate-limit behavior remains unverified.
- News uses an additional cached provider call per researched symbol pair. A one-hour TTL limits
  repeat fetches but does not bound total usage across many different securities.
- Provider publication timestamps can omit a timezone. Show the calendar date, not a fabricated local
  time or relative age. Retrieval timestamps remain distinct and persist through stale fallback.
- Logo/image availability varies by symbol/publisher. Mock screenshots use deterministic logo fixtures;
  production uses provider images and graceful fallbacks. OpenAPI news examples are explicitly labelled
  example headlines and are not current market reporting.
- Chart comparison is separate from fundamental company comparison. It does not synchronize ranges or
  assume identical currencies/scales. The UI explicitly explains this; no buy/sell or winner ranking.
- Existing unrelated work remains uncommitted on the shared branch. Earlier handoffs were preserved.

## Next steps

1. Review the compact widgets, research-first layout, full-screen comparison and news on desktop/mobile.
2. Deploy the market endpoints through the team's protected-main branch/PR process, validate FMP
   entitlement and verify live related-news coverage for representative stocks and funds.
3. Include this handoff, apply team labels, and require green `ci-ok` before merge.

## Open questions / blockers

- No local implementation blocker. Backend deployment and live-provider integration remain outstanding.
- All requested layout choices have been incorporated; further quote/company metadata still requires
  backend contract additions as documented in the previous handoff.
