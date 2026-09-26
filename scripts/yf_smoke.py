"""Smoke check that yfinance works on this machine.

Run: python scripts/yf_smoke.py [TICKER ...]
No API key. Hits Yahoo Finance over the network.
"""

import sys

import yfinance as yf
from yfinance.exceptions import YFDataException


def main(tickers: list[str]) -> int:
    for symbol in tickers:
        ticker = yf.Ticker(symbol)
        history = ticker.history(period="5d")
        if history.empty:
            print(f"{symbol}: no price data")
            return 1
        last_close = float(history["Close"].iloc[-1])
        print(f"{symbol}: last close {last_close:.2f} ({len(history)} rows)")

        funds = ticker.funds_data
        try:
            top = funds.top_holdings
        except YFDataException:  # not a fund
            top = None
        if top is not None and not top.empty:
            names = ", ".join(top.index[:3])
            print(f"{symbol}: fund, top holdings {names}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or ["VOO", "NVDA"]))
