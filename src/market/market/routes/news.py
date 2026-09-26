"""Cached publisher headlines, optionally for one or two researched securities."""

from datetime import UTC, datetime
from urllib.parse import urlsplit

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, cache
from clearvest.errors import UpstreamError

from market.providers import fmp
from market.routes.history import parse_symbols

router = Router()
TTL = 3600


def _web_url(value) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = urlsplit(value)
        return value if parsed.scheme in {"https", "http"} and parsed.hostname and not parsed.username else None
    except ValueError:
        return None


def _fetch(symbols: list[str]) -> dict:
    raw = fmp.stock_news(symbols)
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
        raise UpstreamError("fmp", "no usable news payload")
    return {"articles": articles[:6], "symbols": symbols, "source": "FMP",
            "fetchedAt": datetime.now(UTC).isoformat()}


@router.get("/market/news")
def news():
    api.user_id(router)
    raw_symbols = router.current_event.get_query_string_value("symbols")
    symbols = sorted(set(parse_symbols(raw_symbols, 1, 2))) if raw_symbols is not None else []
    snapshot, stale = cache.get_or_fetch("fmp", f"news:{','.join(symbols) or 'market'}", TTL,
                                         lambda: _fetch(symbols))
    return {**snapshot, "stale": stale}
