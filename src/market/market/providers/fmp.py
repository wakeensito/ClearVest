"""Financial Modeling Prep, /stable endpoints (the legacy /api/v3 is closed to new keys).

The free tier returns HTTP 402 for some symbols (e.g. VOO); that becomes an UpstreamError
and the caller falls back.
"""

from datetime import date

from clearvest import config, http
from clearvest.errors import UpstreamError

BASE = "https://financialmodelingprep.com/stable"


def _get(path: str, **params) -> list:
    data = http.request_json("GET", f"{BASE}/{path}", provider="fmp",
                             params={**params, "apikey": config.get_secret("FMP_KEY_PARAM")})
    if not isinstance(data, list):
        raise UpstreamError("fmp", f"unexpected response for {path}")
    return data


def history(symbol: str, start: date) -> list[tuple[str, float]]:
    rows = _get("historical-price-eod/light", symbol=symbol.replace("-", ""), **{"from": start.isoformat()})
    if not rows:
        raise UpstreamError("fmp", f"no data for {symbol}")
    return sorted((r["date"], float(r["price"])) for r in rows)


def ratios_ttm(symbol: str) -> dict:
    rows = _get("ratios-ttm", symbol=symbol)
    if not rows:
        raise UpstreamError("fmp", f"no ratios for {symbol}")
    return rows[0]


def revenue_growth(symbol: str) -> float | None:
    rows = _get("financial-growth", symbol=symbol, limit=1)
    return rows[0].get("revenueGrowth") if rows else None
