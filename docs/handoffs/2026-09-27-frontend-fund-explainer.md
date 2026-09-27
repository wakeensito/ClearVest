# Fund explainer: "What is this?" in security research

- **Date:** 2026-09-27
- **Author:** @wakeensito
- **Team:** frontend
- **Status:** done (frontend half; needs the backend's `GET /market/fund` to show real data)
- **PR / issue:** not opened yet; deeper learning ideas are in #44
- **Branch:** `worktree-agent-a8d8f3af7584fbb7a` (local worktree, unpushed)
- **Follows:** [Advisor replies: heading lead-ins and comparison tables](2026-09-26-frontend-reply-markdown-tables.md)

## What changed

- An **identity line** sits under the ticker search in `SecurityResearch` (Portfolio and Markets): "VOO · Index fund (ETF)", "Tracks the Standard & Poor's 500 Index" when known, and a "What is this?" button. It shows a quiet skeleton while loading and disappears on error; the chart is never blocked.
- **"What is this?"** opens an inline explainer below the line (it pushes the chart down; no page, tab or modal). A sticky "VOO explained" bar has Done. Three items stay visible: what it is (first sentence of the API summary), what's inside (the **dollar strip**: one bar is $1, sliced by the top holdings, plus "Of every $1: 8¢ NVIDIA · 7¢ Apple · 6¢ Microsoft + hundreds more") and what it costs ("About $3 a year on every $10,000 invested · expense ratio 0.03%"). Stocks show only what it is, with a jump to company financials.
- A single row of **"Keep learning" chips** (Who runs it? / Where is the money? / Why own it? / How do I buy it? / ETF or mutual fund?) opens one two-sentence answer at a time, each ending with the next question. The last one is the static Index fund | ETF | Mutual fund table, ending with "Ask the advisor about VOO →".
- Open state is `explain=1` in the URL: Back closes it, Done clears it and refocuses the search, Escape closes it, and changing the ticker keeps it open for the new security.
- **Compare securities** gets a compact explainer under each chart and a "What's the real difference?" strip (at most three sentences built from data: fund vs fund, fund vs stock, stock vs stock).
- `api.getFund` + `useFund` (one-day staleTime) use a hand-written `Fund` type and a small untyped GET wrapper that shares `unwrap`, the user header and the timeout. DESIGN.md gains §4.13.

## How to run / verify it

```bash
npm ci
npm run lint && npm run typecheck && npm test && npm run build   # 148 tests (66 new)
# Phone check with the API intercepted (no backend or Prism needed):
cd frontend && npx vite --port 5174 --strictPort --host 127.0.0.1 &
npm run test:fund-explainer        # defaults to http://127.0.0.1:5174; screenshots in node_modules/.cache/clearvest-review/
```

Measured (document `scrollWidth` vs `innerWidth`, explainer open, chip answer open, comparison table open, stock, long provider names, Portfolio, and the compare dialog): **320/320, 375/375, 393/393** in every state. At 375px the open explainer is 528px tall, 672px with "Who runs it?" open, and each visible item is two lines.

To see it by hand: `/markets?symbol=VOO&explain=1`, `/markets?symbol=AAPL&explain=1`, `/portfolio?explain=1`, or Compare securities with VOO and VFIAX. Until the backend ships, `/market/fund` 404s against Prism, so the line stays hidden (by design).

## Decisions & why

- **Accent ramp, not viz colors, for the strip.** `viz-1..8` mean asset categories (§2); every holding in the strip is the same category, so category hues would imply a meaning that isn't there. A sequential ramp also says "bigger slice = deeper".
- **The ticker change keeps the explainer open.** The learner is in "explain" mode, and "what is this other one?" is the natural next question. The URL param survives `MarketsPage.selectSymbol`, which copies the existing params.
- **Done pops history only when we pushed it** (`location.state.explainOpened`). If a symbol change replaced the URL in between, Done replaces instead, so it never undoes the ticker change.
- **Comparison table uses row-group headers** (`th scope="rowgroup" colSpan=3`) instead of a label column. With a label column, four columns at 320px broke words mid-word; this way each answer column gets a third of the width and wraps whole words. It deviates slightly from the §4.12 "narrow label column" pattern for that reason.
- **First sentence of the summary only**, to meet the owner's two-lines-per-item cap. `firstSentence` does not split on "U.S." or "Inc.".
- **Chips scroll in one row** rather than wrapping: wrapping made a 3-row block at 375px. The row uses `contain: inline-size`, so it never widens the page, and the Next links walk through every chip.
- **The comparison dialog hides the URL-synced line** (`explainable={false}`): two panels share one URL, so `explain=1` would open both. The compact explainer below each chart carries the identity instead.
- **Stock "See what this company earns"** focuses `[data-company-financials=SYMBOL]` (added to `CompanyFinancials`), or navigates to `/markets?symbol=` from Portfolio, which has no financials section.
- `.workspace` in `ResearchWorkspace.module.css` changed from `overflow: hidden` to `overflow: clip`, so the sticky explainer bar works (hidden creates a scroll container). `tsconfig.node.json` now includes the DOM lib because render tests import `SecurityResearch`.

## Gotchas

- `Fund` comes from `schema.d.ts`, so `npm run typecheck` (which regenerates from `openapi.yaml`) fails if the contract and this code drift, for example on `leveraged` or the `index`/`crypto` kinds.
- The render tests seed an errored query with `retryOnMount: false`; without it, React Query refetches on mount and the state reads as pending.
- The 5xx retry in `queries.ts` means a 502 shows the skeleton for about a second before the line disappears.
- Port 5174 may already be taken by another checkout's preview. Run the smoke with `CLEARVEST_PREVIEW_URL` pointing at your own server (the review round used 5175).
- Category and sector maps are keyed loosely ("Mid-Cap Blend" = "Mid Blend"). Unknown values skip the chip; they are never shown raw.

## Review round (combined branch)

After the backend half merged, a review found these gaps. They were fixed on top of `feat/fund-explainer`, and each has a test:

- **Leveraged funds (critical).** Live TQQQ read "Index fund (ETF)", with "one bad company can't sink you, fees stay low". `leveraged: true` now labels it "Leveraged ETF · high risk", with "high risk" in the loss color. Its why chip warns about borrowing and daily moves, and the compare strip calls it "a very different kind of product", never a basket.
- **New kinds.** `index` reads "Stock market index" and points to "Research VOO". `crypto` reads "Cryptocurrency" and gets only a why chip. `other` reads "Investment" and shows the summary only.
- **`holdingsCount` removed.** The copy now says "+ hundreds more" for plain index funds and "+ more" for everything else.
- **Compare companies.** The dead link is now an `onCompareCompanies(a, b)` path: `ResearchWorkspace` closes the dialog, then `MarketsPage` selects both tickers, switches to Compare companies and focuses its tab.
- **Generated types.** `Fund` is now `Schemas['Fund']` and `getFund` uses `client.GET('/market/fund')`. The untyped wrapper is gone.
- **Smaller fixes.**
  - A ratio of 0 reads "No yearly fee".
  - Params are built from `window.location.search`.
  - The chip row's right edge fades while chips are offscreen.
  - Holdings match on symbol OR name, with BRK.B equal to BRK-B, and "almost the same" covers a near match.
  - Missing fees are named.
  - Bond funds say "investments".

## Next steps

1. Done in the review round: types come from `openapi.yaml`. Re-run `npm run gen:api` whenever the fund contract changes.
2. Run `npm run test:fund-explainer` against real backend data. Check that summaries stay at one sentence and that provider categories hit the plain-word map; add any misses to `CATEGORIES` or `SECTORS` in `lib/fundExplainer.ts`.
3. Done in the review round: `MarketsPage.selectSymbol`/`switchView` and the explainer build params from `window.location.search`.
4. **Deferred to the learning-extension issue (#44)**, cut to meet the 375px caps: a "See top 10" holdings list (name, cents per $1); showing the provider's category or sector term after the plain answer ("Fund category: Large Blend"); the full API summary beyond its first sentence; a "Stock or fund?" chip for stocks; a "Keep learning" label above the chips; remembering which chip was open in the URL.

## Open questions / blockers

- Backend: `holdingsCount` was removed from the contract, so the copy now says "+ hundreds more" for plain index funds and "+ more" otherwise. If a reliable count comes back, the exact number is more honest.
- Owner: is the first-sentence cut on `summary` acceptable, or should the backend guarantee a one-sentence summary instead?
