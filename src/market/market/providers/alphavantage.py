"""Alpha Vantage: last-resort price source. Free tier is 25 calls/day, so use weekly data (one call covers 20 years)."""

from clearvest import config, http
from clearvest.errors import UpstreamError

URL = "https://www.alphavantage.co/query"


def weekly(symbol: str) -> list[tuple[str, float]]:
    data = http.request_json("GET", URL, provider="alphavantage", params={
        "function": "TIME_SERIES_WEEKLY", "symbol": symbol, "apikey": config.get_secret("ALPHAVANTAGE_KEY_PARAM"),
    })
    series = data.get("Weekly Time Series")
    if not series:
        # Rate limits come back as HTTP 200 with a "Note"/"Information" field.
        raise UpstreamError("alphavantage", str(data)[:200])
    return sorted((d, float(v["4. close"])) for d, v in series.items())
