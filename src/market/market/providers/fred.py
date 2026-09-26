"""FRED (St. Louis Fed) series observations via the keyless fredgraph.csv download.

Keyless on purpose: the team has no FRED API key, and the public graph CSV endpoint serves the
same series without one. It returns the full history unless bounded (DGS10: ~268 KB), so `cosd`
(start date) limits it to ~16 months back, a few KB per series. 13 monthly observations (YoY)
need 12 months before the newest one, and the newest is dated the 1st of a month that was
released up to ~6-7 weeks later, so a bare 400 days can come up one observation short.
"""

import csv
import io
from datetime import UTC, datetime, timedelta

from clearvest import http

URL = "https://fred.stlouisfed.org/graph/fredgraph.csv"
COSD_DAYS = 480


def observations(series_id: str, limit: int) -> list[tuple[str, float]]:
    """Newest first, at most `limit` rows. Missing values ('.' or empty, e.g. bond-market
    holidays) are skipped. Columns are read by position because the date header has been
    both `DATE` and `observation_date`."""
    cosd = (datetime.now(UTC).date() - timedelta(days=COSD_DAYS)).isoformat()
    resp = http.request("GET", URL, provider="fred", timeout=5, params={"id": series_id, "cosd": cosd})
    rows = list(csv.reader(io.StringIO(resp.text)))[1:]  # skip the header row
    out = []
    for row in rows:
        if len(row) < 2:
            continue
        try:
            out.append((row[0], float(row[1])))
        except ValueError:
            continue
    out.reverse()  # FRED serves oldest first
    return out[:limit]
