"""FRED (St. Louis Fed) series observations."""

from clearvest import config, http

URL = "https://api.stlouisfed.org/fred/series/observations"


def observations(series_id: str, limit: int) -> list[tuple[str, float]]:
    """Newest first. FRED reports missing days (e.g. bond-market holidays) as '.', so those are skipped."""
    data = http.request_json("GET", URL, provider="fred", params={
        "series_id": series_id, "api_key": config.get_secret("FRED_KEY_PARAM"),
        "file_type": "json", "sort_order": "desc", "limit": str(limit),
    })
    out = []
    for o in data.get("observations", []):
        try:
            out.append((o["date"], float(o["value"])))
        except (KeyError, ValueError):
            continue
    return out
