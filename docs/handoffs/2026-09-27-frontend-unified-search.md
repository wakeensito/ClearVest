# Unified beginner search in the existing SymbolSearch box, with "Compare with VOO"

- **Date:** 2026-09-27
- **Author:** @wakeensito
- **Team:** frontend
- **Status:** done (unpushed; needs the backend half, `GET /market/search` v2, deployed for live rows)
- **PR / issue:** not opened yet; deferred ideas go to #44
- **Branch:** `feat/unified-search`
- **Follows:** [Fund explainer: "What is this?" in security research](2026-09-27-frontend-fund-explainer.md) (backend facts: [2026-09-27-data-unified-search.md](2026-09-27-data-unified-search.md))

## What changed

- The one research search box (`components/market/SymbolSearch.tsx`) now answers anything a beginner types: a
  ticker, a company or fund name, a category word ("index fund", "ETF", "S&P 500", "Fidelity", "bonds",
  "cheap") or a question. Rows come from `buildRows()` in `lib/searchIntent.ts`: exact ticker → curated
  funds (`lib/curatedFunds.ts`, no network) → provider rows (v2 `kind`/`leveraged`) → "Look up X as a
  ticker" → "Ask the advisor: “…” →". Visible label, chips when empty, max 8 inline 44px rows, group
  headers only for mixed lists, a debounced `role=status` count. DESIGN.md §4.1, §4.9, new §4.17, §5.
- Fund rows offer **Compare with VOO** (button with `tabIndex=-1`; Shift+Enter from the keyboard) plus "Same index as
  VOO" / "Similar mix to VTI". It opens Compare securities with `?compare=FXAIX`. Deep links and
  Back/Forward open and close the dialog. Portfolio navigates to `/markets?symbol=VOO&compare=FXAIX`.
- Compare companies uses the same box with `kinds={['stock']}` and company chips (Apple, Microsoft, Nike).
- Learn glossary: Index fund, ETF, Mutual fund, Bond and Market index list up to three real examples
  (`examplesFor()`), each linking to `/markets?symbol=`.
- New phone smoke `npm run test:security-search -w frontend`. The five older smokes use the new label "Find a stock
  or fund".

## How to run / verify it

```bash
uv venv -q --python 3.12 .venv && uv pip install -q --python .venv/bin/python -e ".[dev]"
npm ci && npm run gen:api -w frontend
npm run lint && npm run typecheck && npm test && npm run build
# Phone smoke (API fully intercepted; no backend needed):
(cd frontend && npx vite --port 5176 --strictPort --host 127.0.0.1) &
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:security-search -w frontend
# The older smokes take the same env var (fund-explainer, markets-advisor, browser, company-comparison, beginner-journey).
```

By hand: `/markets?symbol=VOO`, type "index fund", "fidelity", "apple", "v", "what is an index fund?";
type "fxaix" and press Shift+Enter; open `/markets?symbol=VOO&compare=FXAIX` directly; press Back.

## Decisions & why

- **We extended SymbolSearch instead of adding a new SecuritySearch component.** Another session built the box on
  main, with the 300 ms debounce, Enter awaiting the in-flight search, `resolveSubmit` precedence and
  the `clearOnSelect`/`value`/`inputRef` props. All of that is kept. `resolveRowSubmit` (searchBox.ts)
  wraps `resolveSubmit`: a highlighted row wins, questions go to the advisor, category words research
  the first curated fund (never the ticker ETF/BONDS), and a name with nothing listed hands off to the advisor.
- **Curated/intent rules run on the RAW text.** Only the provider call uses `normalizeQuery` (which
  would turn "index fund" into "index").
- **The URL opens the compare dialog, and the click does not.** `openCompare` only pushes `compare=`, and
  an effect on `compareWith(params)` calls `showModal()`. When we opened the modal in the same frame
  as the router navigation, the navigation's transition never committed, and Back then could not close the
  dialog. Keep this order.
- **The second panel is keyed on `rightSeed` rather than `right`.** It re-keys when a comparison opens, not when its
  own search picks a symbol. Keying on `right` would remount the panel on every pick and drop focus
  from its search.
- **Picking a row on Markets moves focus to the research heading.** This is the existing
  `MarketsPage.selectSymbol` rule, and the panel re-keys on `symbol` anyway. Done in the explainer
  still returns focus to the search.
- **The provider only searches the settled draft** (`settled === term`), so a prefilled "VOO" settling
  after the user typed "v" costs no call. The smoke asserts that one letter and a question make no
  `/market/search` request.
- **The phone Compare button reads "Compare".** Its accessible name stays "Compare with VOO", and the
  text beside it keeps its width at 320px.

## Gotchas

- The `/market/search` contract example always answers AAPL (and TQQQ). The company-comparison and
  beginner-journey mocks now echo a typed ticker back as an exact match, like the fund-explainer
  smoke already did.
- On the contract example, typing MSFT + Enter researches AAPL under both the old and the new rules.
  Echo a query in any new smoke that types a ticker other than AAPL.
- `ProviderResult`/`Suggestion` keep `kind`/`leveraged`/`source` optional. A v1 row still served from
  cache renders through `guessKind`.
- `explain=1` and `compare=` together: the modal dialog wins. The explainer's Done is unreachable until
  Exit.
- Esc handling calls `preventDefault` on keydown, which is what stops a native `<dialog>` from
  treating it as a close request. `stopPropagation` alone is not enough.

## Deferred to #44

1. "More funds like this" from `yf.Lookup` seeded by `tracks` (needs a US-only filter).
2. Fuzzy/typo matching ("vangaurd"), recent searches, and a "you own this" badge on rows.
3. Target-date and money-market funds in the curated list.
4. Keep `compare=` in sync when the second panel's own search changes symbol (today the dialog shows
   the new symbol but the URL keeps the one it opened with).
5. A curated one-liner for provider-only fund rows (needs a backend summary field).

## Next steps

1. Open the PR for `feat/unified-search`, tagging @AK1F5 (market routes and research components), with the
   Playwright measurements from `test:security-search`.
2. After deploy, run the live checks from the data handoff (`apple`, `fxaix`, `brk.b`, `tqqq`, `%5EGSPC`)
   and, on a phone, `/markets?symbol=VOO&compare=FXAIX`.
3. Comment the deferred list above on #44.

## Open questions / blockers

- None for the frontend. Live rows depend on the backend v2 route being deployed. Until then the curated tier,
  the ticker lookup and the advisor handoff still work.
