"""Cached publisher headlines, optionally for one or two researched securities. Yahoo Finance via
yfinance: FMP's news endpoints are 402 (paid tier only), which left this card dead on the live site."""

from datetime import UTC, datetime
from urllib.parse import urlsplit

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, cache
from clearvest.errors import UpstreamError

from market.providers import yahoo
from market.routes.history import parse_symbols

router = Router()
TTL = 3600
# yfinance hides parse failures (a 429 page, an odd JSON body) behind an empty list, so an empty
# result may be an outage. Keep it briefly rather than for an hour over the last good headlines.
TTL_EMPTY = 300


def _web_url(value) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = urlsplit(value)
        return value if parsed.scheme in {"https", "http"} and parsed.hostname and not parsed.username else None
    except ValueError:
        return None


def _fetch(symbols: list[str]) -> dict:
    raw = yahoo.news(symbols)
    articles, seen = [], set()
    for row in raw:
        if not isinstance(row, dict):
            continue
        url = _web_url(row.get("url"))
        title = row.get("title")
        if not url or url in seen or not isinstance(title, str) or not title.strip():
            continue
        seen.add(url)
        symbol = str(row.get("symbol") or "").upper()
        if symbols and symbol not in symbols:
            continue
        articles.append({"title": title.strip(), "url": url, "image": _web_url(row.get("image")),
                         "publisher": str(row.get("publisher") or row.get("site") or urlsplit(url).hostname),
                         "publishedAt": str(row.get("publishedDate") or ""), "symbol": symbol})
    if raw and not seen:
        raise UpstreamError("yahoo", "no usable news payload")
    return {"articles": articles[:6], "symbols": symbols, "source": "Yahoo Finance",
            "fetchedAt": datetime.now(UTC).isoformat()}


@router.get("/market/news")
def news():
    api.user_id(router)
    raw_symbols = router.current_event.get_query_string_value("symbols")
    symbols = sorted(set(parse_symbols(raw_symbols, 1, 2))) if raw_symbols is not None else []
    snapshot, stale = cache.get_or_fetch("yahoo", f"news:{','.join(symbols) or 'market'}", TTL,
                                         lambda: _fetch(symbols),
                                         ttl_for=lambda value: TTL if value["articles"] else TTL_EMPTY)
    return {**snapshot, "stale": stale}
