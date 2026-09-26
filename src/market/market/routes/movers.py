"""Market discovery lists; FMP ranking order, shared one-hour cache, no invented quotes."""

from datetime import UTC, datetime
from math import isfinite

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, cache
from clearvest.errors import InvalidInput, UpstreamError

from market.providers import fmp
from market.routes.history import SYMBOL

router = Router()
ENDPOINTS = {"active": "most-actives", "gainers": "biggest-gainers", "losers": "biggest-losers"}
TTL = 3600  # About 72 shared refreshes/day across all lists, excluding retries/concurrent misses.


def _number(value):
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
        return number if isfinite(number) else None
    except (TypeError, ValueError):
        return None


def _fetch(category: str) -> dict:
    raw = fmp.market_movers(ENDPOINTS[category])
    stocks, seen = [], set()
    for row in raw:
        if not isinstance(row, dict):
            continue
        symbol = str(row.get("symbol") or "").strip().upper()
        price, change = _number(row.get("price")), _number(row.get("changesPercentage"))
        if not SYMBOL.fullmatch(symbol) or symbol in seen or price is None or price <= 0 or change is None:
            continue
        seen.add(symbol)
        if (category == "gainers" and change <= 0) or (category == "losers" and change >= 0):
            continue
        stocks.append({"symbol": symbol, "name": str(row.get("name") or symbol), "price": price,
                       "changePct": change / 100, "exchange": str(row.get("exchange") or "")})
    if raw and not stocks:
        raise UpstreamError("fmp", f"no usable {category} market rows")
    if category != "active":
        stocks.sort(key=lambda row: row["changePct"], reverse=category == "gainers")
    return {"category": category, "stocks": stocks[:10], "source": "FMP",
            "fetchedAt": datetime.now(UTC).isoformat()}


@router.get("/market/movers")
def movers():
    api.user_id(router)
    category = router.current_event.get_query_string_value("category", "active")
    if category not in ENDPOINTS:
        raise InvalidInput("category: use active, gainers or losers")
    snapshot, stale = cache.get_or_fetch("fmp", f"movers:{category}", TTL, lambda: _fetch(category))
    return {**snapshot, "stale": stale}
