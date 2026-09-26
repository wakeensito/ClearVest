"""Tests for GET /market/macro (FRED-backed macro snapshot, keyless fredgraph.csv endpoint)."""

from datetime import UTC, date, datetime
from urllib.parse import parse_qs, urlsplit

import pytest
import responses
from market.app import handler
from market.providers import fred

from tests.contract import assert_matches
from tests.helpers import call

URL = "https://fred.stlouisfed.org/graph/fredgraph.csv"



def monthly(sid, newest_first, header="observation_date"):
    """Dated monthly rows going back from 2026-12; works for >12 rows too."""
    rows = [f"{header},{sid}"]
    y, m = 2026, 12
    dated = []
    for v in newest_first:
        dated.append(f"{y:04d}-{m:02d}-01,{v}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    rows.extend(reversed(dated))
    return "\n".join(rows) + "\n"


def mock_all(header="observation_date"):
    series = {
        "FEDFUNDS": ["4.33", ""],
        "CPIAUCSL": ["309.0"] + ["305.0"] * 5 + ["."] + ["305.0"] * 6 + ["300.0"],
        "UNRATE": ["4.2"],
        "CES0500000003": ["36.0"] + ["35.5"] * 11 + ["34.68", ""],
        "DGS10": [".", "4.10"],
    }
    for sid, values in series.items():
        responses.get(URL, body=monthly(sid, values, header), content_type="text/csv",
                      match=[responses.matchers.query_param_matcher({"id": sid}, strict_match=False)])


@responses.activate
def test_observations_newest_first_skip_missing(aws):
    mock_all()
    assert fred.observations("DGS10", 5) == [("2026-11-01", 4.10)]
    assert fred.observations("FEDFUNDS", 5) == [("2026-12-01", 4.33)]


@responses.activate
def test_observations_truncate_to_limit(aws):
    mock_all()
    obs = fred.observations("CES0500000003", 3)
    assert [v for _, v in obs] == [36.0, 35.5, 35.5]


@responses.activate
def test_observations_parse_old_date_header_by_position(aws):
    mock_all(header="DATE")
    assert fred.observations("DGS10", 5) == [("2026-11-01", 4.10)]


@responses.activate
def test_request_is_keyless_and_bounded_by_cosd(aws):
    mock_all()
    fred.observations("DGS10", 5)
    query = parse_qs(urlsplit(responses.calls[0].request.url).query)
    assert query["id"] == ["DGS10"]
    assert "api_key" not in query
    cosd = date.fromisoformat(query["cosd"][0])
    days_back = (datetime.now(UTC).date() - cosd).days
    assert days_back == fred.COSD_DAYS


@responses.activate
def test_macro_route(aws):
    mock_all()
    status, body = call(handler, "GET", "/market/macro")
    assert status == 200
    assert body["fedFunds"] == 4.33 and body["tenYear"] == 4.1
    assert body["cpiYoY"] == pytest.approx(3.0, abs=0.01)
    assert body["wageGrowth"] == pytest.approx(3.81, abs=0.01)
    assert "Fed funds 4.33%" in body["summary"]
    assert_matches("/market/macro", "get", 200, body)


@responses.activate
def test_macro_is_cached_for_advisor(aws):
    from clearvest import cache

    mock_all()
    call(handler, "GET", "/market/macro")
    assert cache.peek("fred", "macro")["fedFunds"] == 4.33


@responses.activate
def test_fred_down_no_cache_is_502(aws):
    responses.get(URL, status=500)
    assert call(handler, "GET", "/market/macro")[0] == 502


@responses.activate
def test_fred_all_missing_is_502_and_not_cached(aws):
    from clearvest import cache

    responses.get(URL, body="observation_date,X\n2026-09-01,.\n2026-10-01,\n", content_type="text/csv")
    assert call(handler, "GET", "/market/macro")[0] == 502
    assert cache.peek("fred", "macro") is None


def test_cosd_window_covers_thirteen_months_plus_release_lag():
    # 13 monthly observations span 12 full months back from the newest one, and the newest is
    # dated the 1st of a month released up to ~6-7 weeks later (CPI, wages).
    assert fred.COSD_DAYS >= 13 * 31 + 60
