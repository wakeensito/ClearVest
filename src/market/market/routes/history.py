"""GET /market/history: side-by-side performance for ETFs, index funds, stocks and crypto."""

import re
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, cache
from clearvest.errors import InvalidInput, UpstreamError

from market import metrics
from market.providers import alphavantage, fmp, yahoo

router = Router()
YEARS = {"1y": 1, "5y": 5, "10y": 10}
SYMBOL = re.compile(r"^[A-Z0-9.^-]{1,12}$")
TTL = 24 * 3600


def parse_symbols(raw: str | None, lo: int, hi: int) -> list[str]:
    symbols = [s.strip().upper() for s in (raw or "").split(",") if s.strip()]
    if not lo <= len(symbols) <= hi:
        raise InvalidInput(f"symbols: give {lo} to {hi} comma-separated tickers")
    bad = [s for s in symbols if not SYMBOL.match(s)]
    if bad:
        raise InvalidInput(f"symbols: invalid ticker {bad[0]}")
    return symbols


def _fetch(symbol: str, years: int):
    start = datetime.now(UTC).date() - timedelta(days=365 * years)
    errors = []
    for source in (lambda: yahoo.history(symbol, start), lambda: fmp.history(symbol, start),
                   lambda: [p for p in alphavantage.weekly(symbol) if p[0] >= start.isoformat()]):
        try:
            points = source()
            if points:
                return points
        except UpstreamError as err:
            errors.append(f"{err.provider}: {err.detail}")
    raise UpstreamError("market data", "; ".join(errors))


def fetch_all(symbols: list[str], fn):
    """fn(symbol) for every symbol concurrently, results in input order; worker errors propagate as-is.

    Sequential provider chains (up to ~3 sources x 5 symbols) would blow API Gateway's 30s limit.
    """
    with ThreadPoolExecutor(max_workers=len(symbols)) as pool:
        return list(pool.map(fn, symbols))


def _cached(symbol: str, rng: str):
    return cache.get_or_fetch("history", f"{symbol}:{rng}", TTL, lambda: _fetch(symbol, YEARS[rng]))


def _periods_per_year(points: list) -> float:
    """Annualization factor from the series' actual date span, not the requested range.

    A 1-year daily series requested as "10y" (because a provider only had a year of history)
    must annualize the same as if it had been requested as "1y" — using the requested range's
    YEARS value here would silently under-annualize young tickers.
    """
    if len(points) < 2:
        return 0
    first = date.fromisoformat(points[0][0])
    last = date.fromisoformat(points[-1][0])
    span_days = (last - first).days
    if span_days <= 0:
        return 0
    return (len(points) - 1) / (span_days / 365.25)


@router.get("/market/history")
def get_history():
    api.user_id(router)
    symbols = parse_symbols(router.current_event.get_query_string_value("symbols"), 1, 5)
    rng = router.current_event.get_query_string_value("range", "1y")
    if rng not in YEARS:
        raise InvalidInput("range: must be 1y, 5y or 10y")
    series, any_stale = [], False
    for symbol, (points, stale) in zip(symbols, fetch_all(symbols, lambda s: _cached(s, rng)), strict=True):
        any_stale |= stale
        closes = [c for _, c in points]
        per_year = _periods_per_year(points)
        series.append({
            "symbol": symbol,
            "points": [{"date": d, "close": c} for d, c in metrics.downsample(points)],
            "returnPct": metrics.return_pct(closes),
            "volatility": metrics.volatility(closes, per_year),
        })
    return {"series": series, "stale": any_stale}
