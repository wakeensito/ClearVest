"""Rankings are provider data, bounded and normalized, with independent shared caches."""

import time

import pytest
import responses
from clearvest import cache, db
from clearvest.errors import UpstreamError
from market.app import handler
from market.providers import fmp

from tests.contract import assert_matches
from tests.helpers import call


def row(symbol="AMD", change=2.5, **extra):
    return {"symbol": symbol, "name": f"{symbol} company", "price": 12.34,
            "changesPercentage": change, "exchange": "NASDAQ", **extra}


@pytest.mark.parametrize("category,endpoint", [("active", "most-actives"), ("gainers", "biggest-gainers"), ("losers", "biggest-losers")])
@responses.activate
def test_provider_endpoint_units_and_contract(aws, category, endpoint):
    change = -2.5 if category == "losers" else 2.5
    responses.get(f"https://financialmodelingprep.com/stable/{endpoint}", json=[row(change=change)])
    status, body = call(handler, "GET", "/market/movers", query={"category": category})
    assert status == 200
    assert body["stocks"][0]["changePct"] == change / 100
    assert body["source"] == "FMP" and not body["stale"]
    assert_matches("/market/movers", "get", 200, body)
    assert responses.calls[0].request.params["apikey"] == "fmp-key"


def test_active_keeps_provider_order_limits_and_deduplicates(aws, monkeypatch):
    rows = [row(f"S{i}") for i in range(12)]
    monkeypatch.setattr(fmp, "market_movers", lambda _: [rows[0], rows[0], *rows[1:]])
    body = call(handler, "GET", "/market/movers")[1]
    assert [stock["symbol"] for stock in body["stocks"]] == [f"S{i}" for i in range(10)]


@pytest.mark.parametrize("category,expected", [("gainers", ["B", "A"]), ("losers", ["D", "C"])])
def test_sort_and_direction(aws, monkeypatch, category, expected):
    monkeypatch.setattr(fmp, "market_movers", lambda _: [row("A", 2), row("B", 5), row("C", -2), row("D", -5), row("E", 0)])
    body = call(handler, "GET", "/market/movers", query={"category": category})[1]
    assert [stock["symbol"] for stock in body["stocks"]] == expected


def test_missing_and_nonfinite_rows_are_not_fabricated(aws, monkeypatch):
    monkeypatch.setattr(fmp, "market_movers", lambda _: [None, row(price=None), row(price=float("nan")), row(change="Infinity"), row(price=True), row("bad ticker"), row("VALID", -1, price="2.30")])
    body = call(handler, "GET", "/market/movers")[1]
    assert len(body["stocks"]) == 1 and body["stocks"][0]["symbol"] == "VALID"


def test_invalid_category_never_calls_provider(aws, monkeypatch):
    monkeypatch.setattr(fmp, "market_movers", lambda _: pytest.fail("unexpected provider call"))
    assert call(handler, "GET", "/market/movers", query={"category": "best"})[0] == 400


def test_cache_preserves_snapshot_time_and_stale_fallback(aws, monkeypatch):
    calls = []
    monkeypatch.setattr(fmp, "market_movers", lambda endpoint: calls.append(endpoint) or [row()])
    first = call(handler, "GET", "/market/movers")[1]
    assert call(handler, "GET", "/market/movers")[1] == first
    assert calls == ["most-actives"]
    cached = db.get("CACHE#fmp", "movers:active")
    cached["expiresAt"] = time.time() - 1
    db.put("CACHE#fmp", "movers:active", cached)

    def fail(_):
        raise UpstreamError("fmp", "HTTP 402")

    monkeypatch.setattr(fmp, "market_movers", fail)
    status, stale = call(handler, "GET", "/market/movers")
    assert status == 200 and stale["stale"]
    assert stale["fetchedAt"] == first["fetchedAt"]
    assert call(handler, "GET", "/market/movers", query={"category": "gainers"})[0] == 502


def test_empty_list_is_distinct_from_invalid_payload(aws, monkeypatch):
    monkeypatch.setattr(fmp, "market_movers", lambda _: [])
    assert call(handler, "GET", "/market/movers")[1]["stocks"] == []
    monkeypatch.setattr(fmp, "market_movers", lambda _: [{"message": "unavailable"}])
    assert call(handler, "GET", "/market/movers", query={"category": "gainers"})[0] == 502
    assert cache.peek("fmp", "movers:gainers") is None
