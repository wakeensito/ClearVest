# GET /market/search v2: merged FMP + Yahoo search, kind-labelled, for the unified beginner search

- **Date:** 2026-09-27
- **Author:** @wakeensito
- **Team:** data
- **Status:** done
- **PR / issue:** (see worktree; not yet opened as a PR)
- **Branch:** (see worktree; not yet opened as a PR)
- **Follows:** 2026-09-27-data-fund-explainer.md

## What changed

- **Fixed a real bug**: `/market/search` always returned `exchange: null` because the old code
  (`routes/research.py:138`) read FMP's `exchangeShortName`, a field that does not exist in the
  `/stable` search response. The verified live shape is exactly
  `['currency', 'exchange', 'exchangeFullName', 'name', 'symbol']` - the new route reads
  `row["exchange"]`, pinned by a `responses`-level regression test
  (`test_fmp_exchange_field_is_read_not_exchangeshortname`).
- `market.providers.yahoo.search(query)`: keyless Yahoo search via `yf.Search(query,
  max_results=8, news_count=0, lists_count=0, include_cb=False, enable_fuzzy_query=False,
  timeout=4).quotes`, same lazy-import + `/tmp` tz-cache + broad-except-to-`UpstreamError`
  pattern as `history()`/`fund_profile()`. Reuses `_QUOTE_KIND` (already in `yahoo.py`) to map
  `quoteType` to `etf`/`mutual_fund`/`stock`/`index`/`crypto`; any other `quoteType`
  (FUTURE, OPTION, CURRENCY, ...) is silently dropped, not surfaced as `other` - a future/option
  contract is never a useful hit for a beginner-name search.
- `search()` moved out of `research.py` into its own `market.routes.search`, registered in
  `market.app`. Same path (`GET /market/search`), additive v2 response shape. It:
  1. **Gates provider calls by query shape** (`_jobs_for`): a 1-character query never calls a
     provider; a 2+ character query with no spaces/punctuation outside `[A-Za-z0-9.^-]` (i.e.
     "ticker-shaped", whether or not it's semantically a ticker - see Decisions) calls FMP
     `search-symbol` + Yahoo; 3+ characters of that shape also calls FMP `search-name`; anything
     else (a name with a space) calls FMP `search-name` + Yahoo only.
  2. **Normalizes and validates every symbol** (`_normalize_symbol`): uppercases; rewrites a
     single-letter share-class suffix (`BRK.B`, `BF.B`) to the dash form (`BRK-B`); drops
     anything with a remaining `.` (a foreign listing suffix like `AAPL.L`, `VFV.TO`,
     `0P000125KV.L`), a `=` (futures), or that otherwise fails the existing `SYMBOL` regex.
  3. **Merges** Yahoo rows before FMP rows by normalized symbol, so Yahoo's `kind` (from a real
     `quoteType`) wins a duplicate; FMP fills in a null `exchange`; `source` becomes `"both"` on
     a duplicate, `"leveraged"` is true if either source flags it.
  4. **Ranks**: exact symbol match (query itself normalized the same way, so `"brk.b"` matches
     a `"BRK-B"` row) > US exchange > name-starts-with-query > provider order (stable sort); caps
     at 8.
  5. **Degrades per-provider**: FMP down + Yahoo up -> Yahoo rows + `unavailable: ["fmp"]` (and
     vice versa); both down with a live cache row -> that row, `stale: true`; both down with no
     cache -> `502`.
- `market.routes.fund.LEVERAGED_RE` is now public (was `_LEVERAGED_RE`) so `routes/search.py`
  reuses the exact same leveraged/inverse pattern instead of a second copy that could drift.
- **I1 fix**: search only ever has the fund NAME (no description text), and `LEVERAGED_RE` alone
  missed several real inverse/leveraged ETF names (SDS, QID, SH, PSQ, a Direxion "... Bear 1X
  ..."); `search.py` now also matches its own search-only `_LEVERAGED_NAME_RE` (ultra/ultrashort/
  bear/short-not-followed-by-term-duration-maturity-treasury-government-bond/Nx), so
  `_leveraged` is `LEVERAGED_RE.search(name) or _LEVERAGED_NAME_RE.search(name)`, still gated on
  `_FUND_KINDS` - `LEVERAGED_RE` itself stays untouched since `routes/fund.py` feeds it
  description text where "short-term" is common, ordinary wording.
- **I2 fix**: a partial result (one provider unavailable) was cached for the full 24h `TTL` like
  a clean success; `search()`'s `cache.get_or_fetch` call now passes `ttl_for=lambda v: 600 if
  v.get("unavailable") else TTL`, so a degraded row expires in 10 minutes and a clean row still
  gets the normal 24h.
- `docs/api/openapi.yaml`: `CompanySearch` gained `results[].kind` (enum
  `etf|mutual_fund|stock|index|crypto|other`), `results[].leveraged` (bool),
  `results[].source` (enum `fmp|yahoo|both`), and a new required top-level `unavailable: []`
  array (enum `fmp|yahoo`) - additive, same path and same required `symbol`/`name`/`exchange`
  fields as before.
- `tests/market/test_search.py` (new; the 3 old search tests were moved out of
  `test_research.py`, which no longer imports or tests `search`): 60 tests covering every B1-B14
  row of the plan's edge-case register, at three layers - `yahoo.search` against a fake
  `yfinance` module, the route's pure helpers (`_normalize_symbol`, `_kind_heuristic`,
  `_leveraged`, `_jobs_for`, `_merge`, `_rank`) called directly, and the full route through
  `market.app.handler`.

## How to run / verify it

```bash
source .venv/bin/activate
pytest -q tests/market/test_search.py tests/market/test_research.py tests/test_contract_doc.py
export PATH="$(dirname "$(uv python find 3.12)"):$PATH"   # only if sam can't find python3.12
sam validate --lint
```

No new env vars or SSM parameters: this route uses the same `FMP_KEY_PARAM` FMP already reads,
and Yahoo is keyless.

## Decisions & why

- **"Ticker-shaped" gating is a shape check, not a semantic one.** `_jobs_for` treats "apple" and
  "aapl" identically - both are a single run of `[A-Za-z0-9.^-]` characters with no spaces, so
  both call FMP `search-symbol` + Yahoo (plus FMP `search-name` at 3+ characters). This
  deliberately does not try to guess whether a string "looks like a real ticker" semantically;
  the frontend's own `searchIntent.ts` classification is a separate, independent concern (it
  decides whether to show a curated/advisor row, not which backend jobs to run). A query
  containing a space (`"index fund"`, `"apple inc"`) is never ticker-shaped and only ever
  triggers FMP `search-name` + Yahoo - `search-symbol` on a multi-word string burns FMP quota for
  nothing.
- **A literal 1-character query never calls a provider, even for a real one-letter ticker** (V,
  F, A, T, etc.) - this is the plan's explicit quota-gating rule. The frontend's own ticker tier
  (`lib/searchIntent.ts`) is expected to offer a manual "Look up V as a ticker" affordance for
  that case instead. Because of this, the exact-symbol-first ranking rule for one-letter tickers
  is tested directly against `_rank()` (a pure function, so it doesn't care whether the 1-char
  query that produced it could really reach the route) rather than through the HTTP route.
- **The FMP-only kind heuristic (`_kind_heuristic`) is a documented best-effort, not a source of
  truth** (B13): FMP's `/stable` search response carries no asset-type field at all (verified -
  the keys are exactly `currency, exchange, exchangeFullName, name, symbol`), so `etf`/
  `mutual_fund` are guessed from the name (`"ETF"`/`"Trust"` as a whole word) or the symbol shape
  (5 letters ending in `X`). This guess is wrong for funds whose name doesn't contain either
  cue - **"ProShares UltraPro QQQ" (TQQQ) does not contain "ETF" or "Trust" and the heuristic
  alone would call it a stock**, which would silently suppress its `leveraged` flag (leveraged
  only ever applies to `etf`/`mutual_fund` kinds). In practice this self-corrects whenever Yahoo
  also returns the symbol, because Yahoo's `kind` (from a real `quoteType`) always wins a merge
  over FMP's guess - the same self-correcting relationship `routes/fund.py`'s identity line has
  with a wrong guess after selection. `test_leveraged_fund_flagged_true_stock_never_flagged`
  documents this explicitly by sourcing TQQQ from Yahoo, not FMP, in its fixture.
- **Foreign-listing detection is a fixed rule, not a suffix allowlist.** A single-letter suffix
  after a dot (`.A`, `.B`) is treated as a US share class and rewritten to the dash form; *any
  other* remaining dot (`.L`, `.TO`, `.MX`, or a longer code) drops the row outright as a v1
  foreign listing. This can't be done by suffix length alone - London's `.L` is exactly as short
  as a class-share `.B` - so the rule is deliberately narrow (only `A`/`B` normalize) rather than
  trying to enumerate every real exchange code.
- **The exact-match ranking rule normalizes the query the same way as a result symbol** - a user
  who types `"brk.b"` still gets the `"BRK-B"` row ranked first, not silently treated as a
  non-match because the raw strings differ.
- **Cache key is versioned (`search:v2:<casefold>`)** for the same reason as `routes/fund.py`'s
  `v2#{SYMBOL}` - the response shape changed (new required fields), so an old `search:v1:` row
  must never be served against the new contract. It expires naturally; nothing reads it anymore.
- **Provider-down semantics are per-provider, not per-job.** FMP can run up to two jobs
  (`search-symbol` + `search-name`) for one query; `unavailable` only lists `"fmp"` if *both* of
  those jobs failed - if a beginner's name query gets a hit from `search-name` but `search-symbol`
  legitimately 402s (its own separate FMP call), that's not "FMP is unavailable," it's just a
  ticker-search miss, and reporting it as an outage would be misleading noise on the frontend.

## Gotchas

- **The 3 old search tests in `tests/market/test_research.py` are gone**, not just moved
  verbatim - the new `tests/market/test_search.py` supersedes them with the v2 contract
  (`kind`/`leveraged`/`source`/top-level `unavailable`). Don't look for
  `test_company_search_deduplicates_and_exact_symbol_first` anymore; the equivalent case is
  `test_dedup_across_providers_kind_from_yahoo_exchange_from_fmp` plus
  `test_brk_b_normalized_and_listed_once`.
- **`yahoo.search`'s lazy `import yfinance as yf` inside the function** means any test exercising
  the route with an unmocked `yahoo.search` will try a real network call. Every route-level test
  in `test_search.py` monkeypatches `yahoo.search` directly (simpler than faking the whole
  `yfinance` module at that layer); only the three `yahoo.search`-specific unit tests fake
  `sys.modules["yfinance"]`, the same pattern as `tests/market/test_fund.py`'s
  `install_yfinance()`.
- **`_kind_heuristic`'s mutual-fund regex is `^[A-Z]{4}X$`** (5 total characters, last is `X`) -
  it does not match a 4-letter or 6-letter symbol ending in X. This mirrors the plan's own wording
  ("5 letters ending in X") exactly; don't "fix" it to `\w*X$` without checking it still excludes
  things like `AMZN` (not X-ending, fine) or unusually-shaped real tickers.
- **`ThreadPoolExecutor(max_workers=3)`** covers the worst case of 3 concurrent jobs
  (`fmp_symbol` + `fmp_name` + `yahoo`); for a 2-job case (a 2-character ticker-shaped query, or
  any name query) one worker slot is simply idle - not a bug, just headroom.
- **A `_jobs_for()` result of `{}` (1-character query) returns `{"results": [], "unavailable":
  []}` without calling `cache.get_or_fetch`'s `fetch()` failure path at all** - this is a cache
  *hit-shaped* success, not a degraded/partial result, so `unavailable` stays empty rather than
  listing both providers as unavailable.

## Next steps

1. Frontend wires the three deterministic tiers (ticker/curated/provider) plus the advisor
   handoff against this contract - see `docs/api/openapi.yaml`'s `CompanySearch` schema and the
   plan's steps 5-9 for `lib/searchIntent.ts`, `lib/curatedFunds.ts`,
   `components/market/SecuritySearch.tsx`, and the compare-with-VOO integration. A frontend
   handoff for this slice should land alongside it
   (`docs/handoffs/2026-09-27-frontend-unified-search.md` or similar - check
   `docs/handoffs/README.md` / `ls docs/handoffs/ | sort | tail` for the actual filename once
   it's written).
2. If the frontend's curated map ever wants "more funds like this" seeded from a real fund's
   `tracks` value (deferred to issue #44 per the plan), `yahoo.fund_profile()` already exists for
   the single-symbol case; this route intentionally does not attempt `yf.Lookup` at all (it's
   noisy for category words per the plan's own live-facts section, and out of scope here).
3. `_kind_heuristic`'s false-stock guess for FMP-only fund rows with no ETF/Trust wording in the
   name (TQQQ being the canonical example - see Decisions) is a known, accepted gap. If FMP later
   exposes an asset-type field on the search endpoints, prefer it over the heuristic outright.

## Open questions / blockers

- None for this slice. The live check below (real FMP + Yahoo, no mocks) is in the PR/commit
  history for this worktree if you want to see actual merged rows for "apple", "fidelity",
  "brk.b", "tqqq", and "v" before wiring the frontend against it.
