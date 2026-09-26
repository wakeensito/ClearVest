# yfinance added as the market-data dependency

- **Date:** 2026-09-26
- **Author:** @Mario-Recondo
- **Team:** data
- **Status:** done
- **PR / issue:** #3 (partial: Python CI now activates), #7
- **Branch:** data/yfinance-setup
- **Follows:** none

## What changed

- Added `requirements.txt` with `yfinance==1.7.0`. This is the first Python manifest, so the `python` CI job (ruff + pytest) now runs on every PR.
- Added `scripts/yf_smoke.py`: prints last close for any tickers and top holdings for funds. Proves the install works on a new machine.
- Uncommented the pip block in `.github/dependabot.yml` (per issue #3).
- README got a "Local setup (Python)" section.

## How to run / verify it

```bash
pip install -r requirements.txt
python scripts/yf_smoke.py VOO QQQ NVDA
```

## Decisions & why

- `requirements.txt`, not `pyproject.toml`: CI installs either, and a flat file is less to argue about during a 48-hour build. Switch later if packaging matters.
- Pinned exactly (`==1.7.0`) so everyone on the team gets the same behavior. Yahoo's endpoints and yfinance's return shapes change between minors.
- yfinance over Alpha Vantage / Polygon for prices: no key, no rate-limit budget to babysit.

## Gotchas

- `yf.Ticker(x).funds_data.top_holdings` returns the top 10 holdings with weights for ETFs. That's enough for the ETF look-through feature without scraping iShares/Vanguard CSVs. It raises `yfinance.exceptions.YFDataException` on non-fund tickers; the smoke script catches that.
- `yf.download(...)` defaults to `auto_adjust=True` in 1.x. Use `history()` on a `Ticker` for one symbol, `download()` for many.
- CI ruff config is strict (default set includes BLE001, no bare `except Exception`). Run `ruff check .` before pushing.
- yfinance hits Yahoo live; don't put network calls in pytest or CI turns flaky. The smoke script is deliberately not a test.

## Next steps

1. Decide FastAPI vs Lambda for the backend (issue #4). Whichever wins, `requirements.txt` is where its deps go.
2. Wrap yfinance behind one module (prices, fund holdings) so the look-through and risk code never import yfinance directly (issue #7).

## Open questions / blockers

- Backend shape, issue #4. Needs the whole team.
