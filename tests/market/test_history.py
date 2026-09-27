"""Tests for GET /market/history: source fallback, caching and validation."""

import responses
from clearvest.errors import UpstreamError
from market.app import handler
from market.providers import alphavantage, fmp, yahoo

from tests.contract import assert_matches
from tests.helpers import call

SERIES = [("2026-09-24", 100.0), ("2026-09-25", 102.0), ("2026-09-26", 101.0)]


def fail(*_a, **_k):
    raise UpstreamError("x", "down")


def test_history_uses_yahoo_first(aws, monkeypatch):
    from market.routes.history import _fetch

    monkeypatch.setattr(yahoo, "history", lambda s, start: SERIES)
    monkeypatch.setattr(fmp, "history", fail)
    assert _fetch("VOO", 1) == SERIES


def test_history_falls_back_to_fmp_then_alpha_vantage(aws, monkeypatch):
    from market.routes.history import _fetch

    monkeypatch.setattr(yahoo, "history", fail)
    monkeypatch.setattr(fmp, "history", fail)
    monkeypatch.setattr(alphavantage, "weekly", lambda s: SERIES)
    assert _fetch("VOO", 1) == SERIES


def test_all_sources_down_raises_for_worker_retry(aws, monkeypatch):
    import pytest
    from market.routes.history import _fetch

    for mod, fn in ((yahoo, "history"), (fmp, "history"), (alphavantage, "weekly")):
        monkeypatch.setattr(mod, fn, fail)
    with pytest.raises(UpstreamError):
        _fetch("VOO", 1)


def test_bad_symbols_and_range_are_400(aws):
    assert call(handler, "GET", "/market/history", query={"symbols": "A,B,C,D,E,F"})[0] == 400
    assert call(handler, "GET", "/market/history", query={"symbols": "V@O"})[0] == 400
    assert call(handler, "GET", "/market/history", query={"symbols": "VOO", "range": "3y"})[0] == 400
    assert call(handler, "GET", "/market/history")[0] == 400


@responses.activate
def test_fmp_history_parses_light_endpoint(aws):
    responses.get("https://financialmodelingprep.com/stable/historical-price-eod/light",
                  json=[{"symbol": "SPY", "date": "2026-09-25", "price": 771.35},
                        {"symbol": "SPY", "date": "2026-09-24", "price": 767.18}])
    from datetime import date

    assert fmp.history("SPY", date(2026, 9, 1)) == [("2026-09-24", 767.18), ("2026-09-25", 771.35)]


@responses.activate
def test_fmp_crypto_symbol_drops_dash(aws):
    responses.get("https://financialmodelingprep.com/stable/historical-price-eod/light", json=[])
    from datetime import date

    try:
        fmp.history("BTC-USD", date(2026, 9, 1))
    except UpstreamError:
        pass
    assert "symbol=BTCUSD" in responses.calls[0].request.url


def test_cached_history_keeps_request_order(aws):
    import time

    from clearvest import cache

    for symbol in ("VOO", "QQQ", "SPY"):
        cache._put("history", f"{symbol}:1y", SERIES, 86400, time.time())
    status, body = call(handler, "GET", "/market/history", query={"symbols": "VOO,QQQ,SPY"})
    assert status == 200 and [s["symbol"] for s in body["series"]] == ["VOO", "QQQ", "SPY"]
    assert_matches("/market/history", "get", 200, body)


def test_volatility_annualizes_from_actual_span_not_requested_range(aws, monkeypatch):
    import datetime as dt

    start = dt.date(2025, 9, 26)
    points = [((start + dt.timedelta(days=i)).isoformat(), 100 + (i % 5) * 0.3) for i in range(366)]
    import time

    from clearvest import cache

    for rng in ("1y", "10y"):
        cache._put("history", f"VOO:{rng}", points, 86400, time.time())
    _, body_1y = call(handler, "GET", "/market/history", query={"symbols": "VOO", "range": "1y"})
    _, body_10y = call(handler, "GET", "/market/history", query={"symbols": "VOO", "range": "10y"})
    assert body_1y["series"][0]["volatility"] == body_10y["series"][0]["volatility"]
    assert body_1y["series"][0]["volatility"] > 0


def test_yahoo_passes_short_timeout(monkeypatch):
    import sys
    import types
    from datetime import date

    seen = {}

    class FakeTicker:
        def __init__(self, symbol):
            pass

        def history(self, **kwargs):
            seen.update(kwargs)

    fake = types.ModuleType("yfinance")
    fake.Ticker = FakeTicker
    fake.set_tz_cache_location = lambda _path: None
    monkeypatch.setitem(sys.modules, "yfinance", fake)
    try:
        yahoo.history("VOO", date(2026, 1, 1))
    except UpstreamError:
        pass  # empty frame; only the kwargs matter here
    assert seen["timeout"] == 4
