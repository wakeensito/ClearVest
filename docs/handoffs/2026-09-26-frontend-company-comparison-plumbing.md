# Company comparison: API plumbing, ready for the UI

- **Date:** 2026-09-26
- **Author:** @Mario-Recondo
- **Team:** frontend
- **Status:** in-progress
- **PR / issue:** #37 (this plumbing); #24 is the backend side, done. No frontend issue yet.
- **Branch:** feat/company-comparison
- **Follows:** 2026-09-26-frontend-voice-button.md, 2026-09-26-data-market.md

## What changed

- `api.compareCompanies(symbols)` in `frontend/src/api/client.ts` calls `GET /market/compare-companies`
  and returns the typed `Companies` response (`companies[]`, `notes`, optional `stale`).
- `useCompareCompanies(symbols)` in `frontend/src/api/queries.ts`: TanStack Query hook, 15-minute
  stale time, disabled unless there are 2–4 symbols so a half-typed set never hits the API.
- `frontend/src/lib/compare.ts`, pure and tested (`compare.test.ts`, 7 tests):
  - `normalizeSymbols(raw)` trims, uppercases, dedupes, and returns `invalid` entries that fail the
    backend's 12-character ticker rule.
  - `symbolsError(symbols)` gives the inline error copy for fewer than 2 or more than 4.
  - `symbolsFromParam(value, fallback)` reads a `?compare=AMD,NVDA` URL param.
  - `METRICS`: the seven rows in display order, each with a label, a one-sentence explainer, and the
    right formatter from `lib/format.ts` per DESIGN.md §10. `metricTone` colors only revenue growth.
  - `arrangeCompanies(requested, companies)` puts columns in request order and names any requested
    ticker the API didn't return.
- **No UI in this slice.** The component and the Markets page mount are Akif's (see Next steps).

## How to run / verify it

```bash
npm run lint -w frontend && npm run typecheck -w frontend
npm test -w frontend -- --run src/lib/compare.test.ts     # 7 tests
```

Contract example, in case you want to see the shape: `npm run mock -w frontend`, then
`curl "http://127.0.0.1:4010/market/compare-companies?symbols=AMD,NVDA" -H "X-User-Id: u1"`.

## Decisions & why

- **Validation lives in `lib/compare.ts`, not the component.** vitest runs in node with no DOM, so the
  rules (ticker regex, 2–4 count, dedupe) are tested there and the component only wires them up. Same
  split as `lib/voice.ts` and `lib/history.ts`.
- **Only revenue growth gets gain/loss color.** A high P/E or a low debt-to-equity is not good or bad
  on its own, and DESIGN.md §12 says hedge honestly. Growth is a signed change, like a return, so
  sign color is a fact, not a judgement.
- **Explainers are short sentences, not tooltips.** DESIGN.md §12 wants terms explained on first use;
  a visible caption under each row label is keyboard- and screen-reader-friendly where a `title`
  tooltip is not.
- **Query key is `['compare', ...symbols]` in request order.** AMD,NVDA and NVDA,AMD are separate
  cache entries; the table's column order follows the request, so it's what the user asked for.

## Gotchas

- `Company.epsTTM` and `.fcfPerShare` are dollars per share, formatted with `currency()`. That is
  the only place dollars appear; never show market cap, revenue or other raw totals (DESIGN.md §10,
  data handoff: ratios and per-share figures so a $3T and a $300B company compare fairly).
- `grossMargin` and `revenueGrowth` arrive as fractions (`0.532`), so `percentFromFraction`, not
  `percent`. The macro card is the opposite case; don't copy from it.
- **An ETF in the set usually means a 502 for the whole request.** FMP's free tier 402s on some ETFs
  (VOO, seen in testing); the backend turns that into `UpstreamError` before anything is cached, so
  AMD+VOO fails as one banner ("Company data is temporarily unavailable."), not as a VOO column of
  dashes. The exception is an ETF whose ratios are already cached: then it's a 200 with `stale: true`.
  Worth a line of helper copy under the input ("Works best with individual companies.").
- Nulls do happen when FMP returns a row with missing fields. `MISSING` (`—`) is the display, with the
  "Not available from the data provider" tooltip from DESIGN.md §10. EDGAR lacking company facts only
  affects `revenueGrowth`, and FMP's figure fills that in silently.
- **`ChipInput`'s full-state placeholder is goal copy:** it hardcodes `Up to ${max} goals`, so at four
  tickers it would read "Up to 4 goals". Add a prop for that string (or generalize the copy) before
  reusing it. With `max={4}` and `maxLength={12}` the input can't produce a fifth chip or a 13-character
  ticker, so the "up to four" error and the length half of the regex are unreachable from the UI. That's
  fine; don't write smoke cases for them.
- The Prism mock returns the AMD/NVDA example for any symbols, so requesting `INTC` from the mock
  makes `arrangeCompanies` report it as missing. That's the mock, not a bug.

## Next steps

1. **Akif: `frontend/src/components/market/CompanyComparison.tsx` + `.module.css`.** Suggested shape,
   following `SecurityResearch.tsx`:
   - Ticker entry: `ChipInput` (`ui/ChipInput.tsx`) with `max={4}`, `maxLength={12}`; on change run
     `normalizeSymbols` and show the first `invalid` entry as an inline error. A Compare button
     commits the draft; `symbolsError` blocks submit with a `role="alert"` message. Don't fetch on
     every chip change, each request costs FMP calls.
   - Table: metrics as rows (`METRICS`, label + `explain` caption in the first column), one column
     per company from `arrangeCompanies`, `th scope="col"` for tickers, values right-aligned with
     `tabular-nums`, `MISSING` cells get `title="Not available from the data provider"`. Horizontal
     scroll under 640px with the first column sticky.
   - Header: `StaleBadge` when `data.stale`. Footer: `data.notes` plus an "Ask about these" link to
     `/advisor?q=...` naming the tickers, like the research panel's footer link.
   - States through `QueryView` with `noun="Company data"`. Guard the render: if `symbolsError` is
     non-null the hook is disabled and `QueryView` would show a skeleton forever, so show the error
     copy instead.
2. **Mount on `MarketsPage.tsx`** under `SecurityResearch`, wrapping both in `<div className={styles.main}>`
   (class already exists in `PortfolioPage.module.css`). Read `?compare=` with
   `symbolsFromParam(params.get('compare'), ['AMD', 'NVDA'])` and pass it as `initialSymbols`, keyed
   on the joined string so a URL change resets the panel.
3. **Browser smoke** (`frontend/scripts/browser-smoke.cjs`): add a `compareMode` like `historyMode`
   and cover default render (AMD, NVDA columns), the invalid-ticker alert, the fewer-than-two alert,
   a 502 with Retry (this is also what an ETF in the set looks like), `stale`, a null field showing
   `—`, and a requested ticker the response lacks.
4. Open a `team:frontend` issue for the screen if it helps the board; #24 is the data-side issue.

## Open questions / blockers

- Whether the comparison should default to two tickers on page load (costs FMP calls on every Markets
  visit) or start empty. The plumbing supports both; the research panel above it does fetch on load.
  Akif's call unless Mario wants it decided.
