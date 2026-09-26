"""Tests for GET /market/macro (FRED-backed macro snapshot)."""

import pytest
import responses
from market.app import handler
from market.providers import fred

from tests.contract import assert_matches
from tests.helpers import call

URL = "https://api.stlouisfed.org/fred/series/observations"


def obs(values):
    return {"observations": [{"date": f"2026-{12 - i:02d}-01", "value": v} for i, v in enumerate(values)]}


def mock_all():
    series = {
        "FEDFUNDS": obs(["4.33"]),
        "CPIAUCSL": obs(["309.0"] + ["305.0"] * 11 + ["300.0"]),
        "UNRATE": obs(["4.2"]),
        "CES0500000003": obs(["36.0"] + ["35.5"] * 11 + ["34.68"]),
        "DGS10": obs([".", "4.10"]),
    }
    for sid, body in series.items():
        responses.get(URL, json=body, match=[responses.matchers.query_param_matcher(
            {"series_id": sid, "api_key": "fred-key", "file_type": "json", "sort_order": "desc",
             "limit": "13" if sid in {"CPIAUCSL", "CES0500000003"} else "5"})])


@responses.activate
def test_observations_skip_missing_values(aws):
    mock_all()
    assert fred.observations("DGS10", 5) == [("2026-11-01", 4.10)]


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
