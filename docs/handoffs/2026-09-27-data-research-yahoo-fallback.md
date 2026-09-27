# Company research falls back to Yahoo when FMP's daily quota runs out

- **Date:** 2026-09-27
- **Author:** @wakeensito
- **Team:** data
- **Status:** done
- **PR / issue:** hotfix before the demo
- **Branch:** fix/research-yahoo-fallback
- **Follows:** 2026-09-27-data-unified-search.md

## What changed

- `/market/company-research` now tries Yahoo (keyless yfinance) for the profile, valuation and income sections whenever FMP fails. The trigger was FMP's free-tier daily cap: 429 "Limit Reach".
- The Yahoo rows are shaped like FMP's, so they go through the same `_normalize` validation.
- `sources[].provider` says "Yahoo Finance" for those sections. Annual P/E history has no Yahoo fallback and stays in `unavailable`.

## How to run / verify it

```bash
.venv/bin/python -m pytest -q tests/market/test_research.py
curl -s "$API/market/company-research?symbol=TSLA" -H "x-user-id: <uuid>"   # 200 even with FMP out of quota
```

## Decisions & why

- **Why Yahoo:** it's keyless and already used for search, history, fund and news, so it adds no new dependency or secret.
- **Why these fields:** Yahoo's `trailingAnnualDividendYield` is used because it's a fraction. yfinance's `dividendYield` is a percent, and would misread as 20%+.
- **Caching:** fallback results are cached like FMP results (24h), so one Yahoo call serves everyone.

## Gotchas

- **Tests must never reach Yahoo.** An autouse fixture in `tests/market/test_research.py` disables the fallback; the two fallback tests monkeypatch it back on.
- **The FMP quota resets daily.** Until it does, FMP-only features (e.g. annual P/E history) show as unavailable for uncached tickers.

## Next steps

1. Consider a paid FMP plan, or a second key rotated through SSM, if demo traffic keeps hitting the cap.

## Open questions / blockers

- None.
