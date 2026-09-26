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
        # Rate limits/errors come back as HTTP 200 with a "Note"/"Information"/"Error Message"
        # field. Never surface the raw payload (it can include the request's own API key).
        reason = next((data[k] for k in ("Note", "Information", "Error Message") if k in data), "no series")
        raise UpstreamError("alphavantage", f"no weekly series ({reason})")
    return sorted((d, float(v["4. close"])) for d, v in series.items())
