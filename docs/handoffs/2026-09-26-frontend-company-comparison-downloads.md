# Company comparison and CSV / JSON downloads

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done (local implementation; not committed or deployed)
- **PR / issue:** No PR opened. Include in the frontend PR with `team:frontend`; backend feature is #24.
- **Branch:** `feat/frontend`
- **Follows:** [Market data backend](2026-09-26-data-market.md), [Inclusive investing experience](2026-09-26-frontend-inclusive-investing-experience.md), [Light brokerage workspace](2026-09-26-frontend-light-brokerage-workspace.md)

## What changed

- Markets now offers Price history and Compare companies; `/markets?view=companies` opens comparison directly. No profile is needed. Ticker drafts/results survive switching views within Markets.
- Wired the existing company comparison API through the typed client and TanStack Query. Explicit submission validates 2–4 distinct tickers and shows seven metrics with explanations, missing values, cached-data status and local loading/error/retry states.
- Added a download area for CSV and JSON snapshots of the displayed result, including units, source notes and retrieval time. Downloads make no extra API call and remain disabled without a successful, nonempty result or during a fetch.
- Added unit coverage and a dedicated browser smoke script for comparison, actual downloaded contents, responsive behavior and failure states. Made the existing token consistency test normalize CRLF so Windows checkouts pass without weakening token comparison.

## How to run / verify it

```bash
npm run dev -w frontend -- --host 127.0.0.1 --port 5175 --strictPort
# Separate terminal; browser smoke intercepts API calls with OpenAPI examples:
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5175 node frontend/scripts/company-comparison-smoke.cjs
npm run lint
npm run typecheck
npm test
npm run build
```

Install Playwright Chromium if needed, or select an existing binary with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE`. In this WSL/Windows Node environment, set both environment variables
inside the Windows Node process rather than assuming WSL environment propagation. The standard shell
sandbox cannot start because of a host mount alias; shell operations used approved escalation.

Validation: lint, TypeScript, all 26 unit tests and production build pass. Browser smoke covers
pre-profile access, view switching, no comparison fetch before submission, invalid/duplicate tickers,
loading, correct display units, null values, four companies, CSV/JSON filenames and contents, exports
remaining tied to displayed data after draft edits, stale/empty/error/retry states, and 320/390/768px
layouts without page overflow. Screenshots and downloaded fixtures are under the ignored
`frontend/node_modules/.cache/clearvest-review/` directory. Live provider calls were not exercised.

## Decisions & why

- A table with seven explained measures fits fundamental comparison. This is independent of the price
  history chart and uses existing SamsungOne, navy/blue and white-surface design tokens.
- Company data only loads on Compare; FMP quotas are limited. The query caches for 15 minutes. Pressing
  Compare again with the same submitted symbols explicitly refreshes that result. Price history mounts
  only in its own view, avoiding hidden history requests when opening comparison directly.
- Downloads export the current response, not unsubmitted input. CSV includes a UTF-8 BOM, CRLF row
  endings, escaped text, explicit units and formula protection. Raw fractions/precision remain intact;
  JSON includes a units map. No extra export service or dependency was needed.
- Retrieval time is the frontend query update time, not a filing date. Source copy describes backend
  behavior without claiming EDGAR supplied every growth value. No fabricated names or report dates.

## Gotchas

- Backend response has no company names, reporting periods, currency metadata or per-field sources.
  Per-share currency formatting follows the current design contract. Company search is ticker input.
- Backend `stale` currently reflects the ratios cache; growth helpers discard their own stale flags.
  UI/export faithfully pass the supplied flag through; it is not proof that every metric is fresh.
- A provider failure for one symbol can fail the whole response. Existing QueryView handles it; partial
  per-company error responses would need a backend contract change.
- Null metrics are shown as an accessible dash; exports use blank CSV cells / JSON nulls. Fractions
  such as 0.532 are displayed as 53.2% but remain 0.532 in files with an explicit fraction unit.
- The branch already contains other contributors' uncommitted changes. This work did not commit, push,
  overwrite handoffs, or deploy those changes.

## Next steps

1. Review `/markets?view=companies` with the deployed API and representative operating-company tickers.
2. Include this handoff and the comparison changes in the frontend PR, label `team:frontend`, and require
   green `ci-ok` before merging.
3. Backend/data: add reporting periods, per-field sources/currencies and complete stale propagation if
   more precise attribution or downloadable filing documents are desired.

## Open questions / blockers

- No local implementation blocker. Live-provider verification and publishing remain outstanding.
- Downloads currently cover comparison data in CSV/JSON; filing PDFs or original SEC documents would
  require document links/data not present in the current comparison response.
