"""GET /market/history: side-by-side performance for ETFs, index funds, stocks and crypto."""

import re
from datetime import UTC, datetime, timedelta

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


@router.get("/market/history")
def get_history():
    api.user_id(router)
    symbols = parse_symbols(router.current_event.get_query_string_value("symbols"), 1, 5)
    rng = router.current_event.get_query_string_value("range", "1y")
    if rng not in YEARS:
        raise InvalidInput("range: must be 1y, 5y or 10y")
    series, any_stale = [], False
    for symbol in symbols:
        points, stale = cache.get_or_fetch("history", f"{symbol}:{rng}", TTL, lambda s=symbol: _fetch(s, YEARS[rng]))
        any_stale |= stale
        closes = [c for _, c in points]
        per_year = len(points) / YEARS[rng]
        series.append({
            "symbol": symbol,
            "points": [{"date": d, "close": c} for d, c in metrics.downsample(points)],
            "returnPct": metrics.return_pct(closes),
            "volatility": metrics.volatility(closes, per_year),
        })
    return {"series": series, "stale": any_stale}
