# SEC EDGAR wired in: ticker to CIK, XBRL facts, filings, full-text search

- **Date:** 2026-09-26
- **Author:** @Mario-Recondo
- **Team:** data
- **Status:** done
- **PR / issue:** #7
- **Branch:** data/sec-edgar-setup
- **Follows:** 2026-09-26-data-yfinance-setup.md

## What changed

- `requests==2.34.2` added to `requirements.txt`.
- `.env.example` with `SEC_USER_AGENT`. EDGAR returns 403 without it (verified).
- `scripts/sec_smoke.py`: resolves a ticker to its CIK, prints latest fiscal-year revenue from XBRL company facts, the latest 10-K filing, and a full-text-search hit count. Proves all four endpoints the features need.
- README: SEC section under local setup.

## How to run / verify it

```bash
pip install -r requirements.txt
cp .env.example .env      # set SEC_USER_AGENT="ClearVest you@email"
python scripts/sec_smoke.py NVDA
```

## Decisions & why

- Plain `requests`, no EDGAR wrapper library. The four endpoints are simple JSON GETs; a library would add a dependency for no gain and hide the User-Agent rule.
- `SEC_USER_AGENT` is read from the environment, then from the repo-root `.env`. No `python-dotenv` dependency for one variable.
- Revenue tag: companies switch tags over time (Apple used `Revenues` through FY2018, then `RevenueFromContractWithCustomerExcludingAssessedTax`), and later 10-Ks restate prior years. "First tag that exists" returned Apple's 2018 number. The script gathers annual values across both tags and picks the latest period end, then latest filing date. Real code needs the same rule for every metric.
- Every request goes through `raise_for_status()` and `main()` catches `requests` errors, so a rejected User-Agent prints `HTTP 403 ... check SEC_USER_AGENT` instead of a JSON-decode traceback.

## Gotchas

- ETFs are not in `company_tickers.json` and have no company facts. VOO, QQQ, VGT all miss. EDGAR company data is for operating companies only; fund holdings come from yfinance (`funds_data.top_holdings`), not EDGAR.
- Hosts differ: ticker map is on `www.sec.gov`, facts and submissions on `data.sec.gov`, full-text on `efts.sec.gov`. All need the header.
- Rate limit is 10 req/s across all SEC hosts. Cache `company_tickers.json` (10k rows, changes rarely) instead of refetching per request.
- Company facts JSON is large (several MB for big filers). Don't fetch it per page load; cache per CIK.
- Full-text search returns hit counts and filing IDs, not passages. Pulling the 10-K text means fetching the primary document from `www.sec.gov/Archives/edgar/data/<cik>/<accession-no-dashes>/<primaryDocument>` and stripping HTML.

## Next steps

1. Wrap EDGAR behind one module (`cik_for(ticker)`, `facts(cik)`, `filings(cik)`, `search(query, cik)`) with caching, alongside the yfinance wrapper (issue #7).
2. Decide what feeds the "ask a question about the 10-K" feature: full-text search hits only, or fetched 10-K sections into the LLM.

## Open questions / blockers

- None for this slice.
