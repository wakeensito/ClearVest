# Market news moves from FMP to Yahoo Finance (the card was 502 on the live site)

- **Date:** 2026-09-27
- **Author:** @Mario-Recondo
- **Team:** data
- **Status:** done
- **PR / issue:** (this PR)
- **Branch:** fix/market-news-yfinance
- **Follows:** [2026-09-27-data-fund-explainer.md](2026-09-27-data-fund-explainer.md)

## What changed

- **`GET /market/news` now reads Yahoo Finance through yfinance**, the same library MarketFn already
  uses for history and fund profiles. No key, no paid tier. FMP's `news/stock` and `news/stock-latest`
  return HTTP 402 on the free plan, so the card had shown its error state on every load since it shipped.
- **Same response shape.** `yahoo.news(symbols)` normalizes Yahoo's rows into the fields the route
  already filtered (symbol, title, url, image, publisher, publishedDate), so the URL-safety checks,
  dedupe, related-symbol filter and six-article cap are untouched. `source` is now `"Yahoo Finance"`
  (contract enum updated, frontend types regenerated; the card footer reads it from the response).
- **Market-wide scope** (no symbols) uses the S&P 500 index's own feed (`^GSPC`). Symbol rows carry
  the requested ticker; market-wide rows carry `""`, as before.
- **Two-symbol requests interleave the feeds**, so a comparison shows both companies instead of the
  first company's ten headlines filling all six slots.
- **Each symbol's fetch runs under an 8s timeout** (`_NEWS_TIMEOUT`). `.news` has no timeout parameter
  and MarketFn has 29s in total, so a hung Yahoo would have timed out the Lambda instead of reaching
  the route's 502 / stale-cache path.
- **An empty feed is cached for 5 minutes, not an hour** (`TTL_EMPTY`). yfinance hides parse failures
  (a 429 page, an odd JSON body) behind an empty list, so "no articles" may be an outage.
- Cache namespace moved from `CACHE#fmp` to `CACHE#yahoo` for `news:*` keys. `fmp.stock_news` is gone;
  nothing else called it.

## How to run / verify it

```bash
.venv/Scripts/python.exe -m pytest -q          # 329 passed
uvx ruff@0.16.5 check .
cd frontend && npm run typecheck && npm run lint && npm test   # gen:api runs inside typecheck
```

Live probe on 2026-09-27 (local, real yfinance, through the route's `_fetch`): AAPL 6 articles in 1.1s,
AAPL+MSFT 6 articles alternating in 0.3s, market-wide 6 in 0.1s, every row with an image.

After deploy: `curl -H "X-User-Id: <uuid>" "$API/market/news?symbols=AAPL"` should be 200 with
`"source": "Yahoo Finance"`. On the site: Markets, pick a company, the "Market news" card fills.

## Decisions & why

- **yfinance over hiding the card.** Hiding was ten minutes; this was an hour and keeps a judge-facing
  card alive with real headlines. Mario's call at ~04:00.
- **Normalize in the provider, not the route.** The route's safety filters (scheme check, no
  credentials in URLs, dedupe, cap) were already tested against hostile payloads; feeding them the same
  shape kept every one of those tests valid.
- **Both yfinance shapes handled.** 0.2.50+ nests under `content` with `canonicalUrl`/`clickThroughUrl`;
  older releases were flat with `link`/`publisher`. The Lambda's pinned version is the nested one; the
  flat fallback costs three lines and a test.
- **`publishedAt` is Yahoo's ISO timestamp** (`2026-09-27T02:35:00Z`). The contract says the provider's
  timestamp is kept verbatim; the frontend slices the date part, which still works.

## Gotchas

- `yfinance.Ticker(...).news` has no timeout parameter (unlike `.history`). Two symbols cost two
  calls, well under a second warm; a cold Lambda adds the pandas import (~2s).
- Yahoo may throttle Lambda IPs (known from the fund route). The 1-hour cache plus stale fallback
  from `cache.get_or_fetch` covers a burst; a cold cache under throttling is still a 502.
- **"Related" is Yahoo's related, not ours.** AAPL's feed includes stories about Alphabet or Nvidia
  that mention Apple in passing; the card shows them under the Apple logo. Yahoo's per-story ticker
  tags (`content.finance.stockTickers`) came back empty on every item with the pinned yfinance, so
  there is nothing to filter on. Found in review; left as is.
- `npm run typecheck` regenerates `frontend/src/api/schema.d.ts`; this PR's regeneration is a real
  change (the `source` enum), unlike the LF-only noise from other branches.

## Next steps

1. Watch the card on the live site after deploy; if Yahoo throttles, the next-cheapest move is a
   longer TTL (news is not time-critical for a beginner).
2. `docs/api/openapi.yaml` still says `provider: FMP` for movers and company research. Those routes do
   work on the free tier; leave them.

## Open questions / blockers

- None.
