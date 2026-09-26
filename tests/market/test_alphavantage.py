"""Tests for market.providers.alphavantage: last-resort weekly price source."""

import responses
from clearvest.errors import UpstreamError
from market.providers import alphavantage

URL = "https://www.alphavantage.co/query"


@responses.activate
def test_weekly_parses_series(aws):
    responses.get(URL, json={"Weekly Time Series": {
        "2026-09-19": {"4. close": "100.0"},
        "2026-09-26": {"4. close": "102.0"},
    }})
    assert alphavantage.weekly("VOO") == [("2026-09-19", 100.0), ("2026-09-26", 102.0)]


@responses.activate
def test_weekly_raises_with_reason_from_known_field(aws):
    responses.get(URL, json={"Note": "Thank you for using Alpha Vantage! Our API call frequency is..."})
    try:
        alphavantage.weekly("VOO")
        raise AssertionError("expected UpstreamError")
    except UpstreamError as err:
        assert err.provider == "alphavantage"
        assert err.detail == "no weekly series (Thank you for using Alpha Vantage! Our API call frequency is...)"


@responses.activate
def test_weekly_raises_with_information_reason_when_no_note(aws):
    responses.get(URL, json={"Information": "Invalid API call."})
    try:
        alphavantage.weekly("VOO")
        raise AssertionError("expected UpstreamError")
    except UpstreamError as err:
        assert err.detail == "no weekly series (Invalid API call.)"


@responses.activate
def test_weekly_raises_no_series_when_payload_has_no_known_reason_field(aws):
    responses.get(URL, json={"unexpected": "shape"})
    try:
        alphavantage.weekly("VOO")
        raise AssertionError("expected UpstreamError")
    except UpstreamError as err:
        assert err.detail == "no weekly series (no series)"
