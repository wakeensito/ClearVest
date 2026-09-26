"""Smoke check that yfinance works on this machine.

Run: python scripts/yf_smoke.py [TICKER ...]
No API key. Hits Yahoo Finance over the network.
"""

import sys

import yfinance as yf


def main(tickers: list[str]) -> int:
    """Print last close for each ticker, plus top holdings for funds.

    Returns 1 if any ticker has no price data. Holdings are optional: any
    failure there (not a fund, Yahoo error, rate limit) is skipped.
    """
    for symbol in tickers:
        ticker = yf.Ticker(symbol)
        history = ticker.history(period="5d")
        if history.empty:
            print(f"{symbol}: no price data")
            return 1
        last_close = float(history["Close"].iloc[-1])
        print(f"{symbol}: last close {last_close:.2f} ({len(history)} rows)")

        try:
            top = ticker.funds_data.top_holdings
        except Exception:  # noqa: BLE001 - optional; not a fund, or Yahoo failed
            top = None
        if top is not None and not top.empty:
            names = ", ".join(top.index[:3])
            print(f"{symbol}: fund, top holdings {names}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or ["VOO", "NVDA"]))
