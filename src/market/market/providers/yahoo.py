"""Yahoo Finance via yfinance: the primary price source (data team, #15). No key needed."""

from datetime import date

from clearvest.errors import UpstreamError


def history(symbol: str, start: date) -> list[tuple[str, float]]:
    import yfinance as yf  # heavy (pandas); import only when a request needs it

    # Lambda's filesystem is read-only except /tmp; yfinance caches timezones on disk.
    yf.set_tz_cache_location("/tmp/yfinance")
    try:
        # timeout=4: yfinance defaults to 10s, and Yahoo is only the first of three sources
        # that must all fit inside API Gateway's 30s limit.
        frame = yf.Ticker(symbol).history(start=start.isoformat(), interval="1d", auto_adjust=True, timeout=4)
    except Exception as err:  # yfinance raises many types; all mean "Yahoo failed"
        raise UpstreamError("yahoo", f"{type(err).__name__}: {err}") from err
    if frame is None or frame.empty:
        raise UpstreamError("yahoo", f"no data for {symbol}")
    return [(ts.strftime("%Y-%m-%d"), round(float(close), 4)) for ts, close in frame["Close"].items()]
