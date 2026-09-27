# GET /market/fund: beginner "what is this?" explainer for ETFs, mutual funds and stocks

- **Date:** 2026-09-27
- **Author:** @wakeensito
- **Team:** data
- **Status:** done
- **PR / issue:** #42
- **Branch:** (see worktree; not yet opened as a PR)
- **Follows:** 2026-09-26-data-market.md

## What changed

- `market.providers.yahoo.fund_profile(symbol)`: one more yfinance call, same lazy-import +
  `/tmp` tz-cache + broad-except-to-`UpstreamError` pattern as `history()`. Returns kind
  (etf/mutual_fund/stock/other), name, expense ratio (normalized to a fraction), holdings count,
  top holdings, `fundFamily`, `category` (funds), `sector` (stocks), and the raw
  `longBusinessSummary` text for the route to summarize.
- `GET /market/fund?symbol=` (`src/market/market/routes/fund.py`), wired into `market.app`:
  validates with the existing `SYMBOL`/`parse_symbols` from `routes/history.py`, caches via
  `cache.get_or_fetch("fund", SYMBOL, 7 days, fetch)`, and rewrites the provider's business
  summary into one beginner sentence with `clearvest.providers.bedrock.converse` (model id from
  `FUND_MODEL_ID`, default `us.amazon.nova-micro-v1:0`). Every number in the response comes from
  yfinance; the model only ever rewrites prose, and several guardrails reject anything that looks
  like it invented a number or a tracked index name (see **Decisions & why**).
- `clearvest.providers.bedrock.converse` gained an optional `model_id` kwarg (defaults to the old
  `os.environ["MODEL_ID"]` behavior) so `MarketFn` can call a different, cheaper model than
  Advisor/Voice without touching their code paths.
- `template.yaml`: new `FundModelId` (default `us.amazon.nova-micro-v1:0`) and
  `FundFoundationModelId` (default `amazon.nova-micro-v1:0`) parameters; `MarketFn` gets
  `FUND_MODEL_ID` and a `bedrock:InvokeModel` statement scoped to exactly those two ARNs (its own
  inference profile + foundation model, region-wildcarded like `AdvisorFn`/`VoiceFn`) — it cannot
  invoke the Advisor/Voice model or vice versa.
- `docs/api/openapi.yaml`: `GET /market/fund` path + `Fund`/`FundHolding` schemas with a VOO
  example.
- `tests/test_template.py`: renamed/rewrote the Bedrock-access guard to
  `test_only_advisor_voice_and_market_fund_can_call_bedrock` — Portfolio still gets nothing,
  Advisor/Voice keep `ModelId`/`FoundationModelId`, and MarketFn's policy is asserted to reference
  only `FundModelId`/`FundFoundationModelId`.

## How to run / verify it

```bash
source .venv/bin/activate
pytest -q tests/market/test_fund.py tests/test_template.py tests/test_contract_doc.py
export PATH="$(dirname "$(uv python find 3.12)"):$PATH"   # only if sam can't find python3.12
sam validate --lint
```

No new env vars to plug in: `FUND_MODEL_ID` has a working default and needs no SSM parameter
(same as `ModelId`/`FoundationModelId` — Bedrock model ids aren't secrets).

## Decisions & why

- **netExpenseRatio vs annualReportExpenseRatio are different units.** yfinance reports
  `netExpenseRatio` as a PERCENT number (`0.03` means 0.03%, i.e. a 0.0003 fraction) but
  `annualReportExpenseRatio` is already a FRACTION (`0.0004` means 0.04%, i.e. stays `0.0004`).
  `_expense_ratio()` prefers `netExpenseRatio` (normalizing `/100`) when present, and only falls
  back to `annualReportExpenseRatio` as-is. Getting this backwards silently produces numbers off
  by 100x — there's a dedicated unit test (`test_expense_ratio_percent_vs_fraction_units`) pinning
  both cases so nobody "fixes" the asymmetry later.
- **> 20% expense ratio (post-normalization) is treated as bad data, not a real fund fee** — almost
  certainly a unit-parsing bug or a garbage payload; returned as `null` rather than shown.
- **A fund with no `funds_data.top_holdings` is not a provider failure.** Real yfinance raises
  `yfinance.exceptions.YFDataException` from `top_holdings` when Yahoo has no holdings data for a
  ticker (this is genuinely true for some ETFs, and always true for equities if that code path were
  ever hit). `fund_profile()` catches `YFDataException` — and, defensively, any other exception
  from that one property access (`# noqa: BLE001`) — and just returns `topHoldings: []`,
  `holdingsCount: null`, without failing the whole request. Only the initial `Ticker(...).info`
  fetch failing is a real `UpstreamError`.
- **Numbers never come from the model** (same rule as the rest of MarketFn, spec §6). The model
  gets exactly one job: rewrite `longBusinessSummary` into one plain sentence, plus a `TRACKS:`
  line. Three independent guardrails, each with its own test:
  1. The sentence is rejected (fallback to the template) if it's empty, contains any digit or `%`,
     or is over 30 words — even though the prompt asks for ≤25, so a slightly-over-budget reply
     doesn't get discarded while a truly rambling one does.
  2. `TRACKS: <name>` is only accepted if `<name>` appears case-insensitively **verbatim** in the
     provider's own `longBusinessSummary` — otherwise `tracks` is `null`, even if the sentence
     itself was accepted. This is checked independently from the sentence guardrail
     (`test_tracks_only_accepted_when_verbatim_in_source`): a good sentence with a hallucinated
     index name still gets `summarySource: "model"` but `tracks: null`.
  3. Any Bedrock `UpstreamError` (throttled, empty reply, etc.) falls back to the template — never
     a 502 for the whole endpoint just because the summary rewrite failed.
- **Template wording varies by kind** (`_fund_template`/`_stock_template` in `routes/fund.py`):
  "VOO is an index ETF...", "VFIAX is an index mutual fund...", "AAPL is one company's stock...".
  No digits in any of them, so they always pass the same guardrail the model output does.
- **`fundFamily`/`category` are fund-only, `sector` is stock-only** (per the frontend's contract
  addition): the provider strings are passed through as-is (e.g. `"Large Blend"`) — the frontend
  owns translating them to plain words with a static map, not this backend.
- **`asOf` is the fetch date, not "today"** — it's the date portion of the timestamp captured when
  `fetch()` ran, stored in the 7-day cache entry, so it stays stable across cache hits (matches how
  `asOf`/`fetchedAt` work in `research.py`).

## Gotchas

- **`fund_profile()`'s only network call is `Ticker(symbol).info`** — `ticker.funds_data` is a
  *second*, separate network round-trip (only made for `etf`/`mutual_fund` kinds), so a bad/slow
  network can, in principle, fail holdings gracefully (see above) while the base profile still
  succeeds, or vice versa fail the whole thing if `.info` itself times out.
- **Testing yfinance without hitting the network**: `yahoo.py` does `import yfinance as yf` lazily
  *inside* the function, so tests monkeypatch `sys.modules["yfinance"]` with a fake module
  (`Ticker`, `set_tz_cache_location`) — see `install_yfinance()` in `tests/market/test_fund.py`.
  `from yfinance.exceptions import YFDataException` is also inside the function; the test file
  does a real, network-free `from yfinance.exceptions import YFDataException` at module load time
  *before* any monkeypatching, which pins the real submodule in `sys.modules` so the later lazy
  import inside `fund_profile()` resolves it from cache instead of trying (and failing) to import a
  submodule off the fake top-level module.
- **`converse()`'s new `model_id` kwarg is opt-in and additive** — every existing caller
  (`advisor/routes/retirement.py`, `clearvest/advisor.py`, and their tests, none of which pass
  `model_id`) is unaffected; only `routes/fund.py` passes it.
- **`parse_symbols(..., 1, 1)` is reused from `routes/history.py`** — its validation error message
  literally says "symbols: give 1 to 1 comma-separated tickers" (plural) even though this route
  takes one `symbol` query param; that's pre-existing behavior also visible on
  `/market/company-research` and `/market/search`, not something new here.

## Next steps

1. Frontend wires up the "What is this fund?" screen against `GET /market/fund` (see contract in
   `docs/api/openapi.yaml`).
2. If FMP/EDGAR's ETF profile data (from `#20`/`#21`) ever grows a "top institutional holders" or
   sector-weighting view, `fund_profile()` already exposes `fund_family`/`category` that could feed
   it — not built here, this slice is the beginner explainer only.

## Open questions / blockers

- None for this slice.
