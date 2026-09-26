"""News scopes, publisher URLs and cached snapshots must remain trustworthy."""

import time

import pytest
import responses
from clearvest import db
from clearvest.errors import UpstreamError
from market.app import handler
from market.providers import fmp

from tests.contract import assert_matches
from tests.helpers import call


def article(symbol="AAPL", **extra):
    return {"symbol": symbol, "title": "Company reports quarterly results", "url": "https://publisher.example/story",
            "image": "https://publisher.example/image.jpg", "publisher": "Publisher", "publishedDate": "2026-09-25 12:00:00", **extra}


@responses.activate
@pytest.mark.parametrize("symbols,path", [(None, "news/stock-latest"), ("msft, aapl", "news/stock")])
def test_news_provider_and_contract(aws, symbols, path):
    responses.get(f"https://financialmodelingprep.com/stable/{path}", json=[article()])
    status, body = call(handler, "GET", "/market/news", query={} if symbols is None else {"symbols": symbols})
    assert status == 200
    assert body["symbols"] == ([] if symbols is None else ["AAPL", "MSFT"])
    assert body["articles"][0]["publishedAt"] == "2026-09-25 12:00:00"
    assert_matches("/market/news", "get", 200, body)
    assert responses.calls[0].request.params["limit"] == "12"
    if symbols:
        assert responses.calls[0].request.params["symbols"] == "AAPL,MSFT"


def test_related_scope_filters_unrelated_and_deduplicates(aws, monkeypatch):
    monkeypatch.setattr(fmp, "stock_news", lambda _: [article(), article(), article("TSLA", url="https://publisher.example/other")])
    body = call(handler, "GET", "/market/news", query={"symbols": "AAPL"})[1]
    assert len(body["articles"]) == 1 and body["articles"][0]["symbol"] == "AAPL"


def test_invalid_links_and_images_never_reach_the_ui(aws, monkeypatch):
    monkeypatch.setattr(fmp, "stock_news", lambda _: [article(url="javascript:alert(1)"), article(url="data:text/html,test"), article(url="https://user:secret@publisher.example/story"), article(image="javascript:bad")])
    body = call(handler, "GET", "/market/news")[1]
    assert len(body["articles"]) == 1 and body["articles"][0]["image"] is None


def test_limit_empty_and_invalid_payload(aws, monkeypatch):
    monkeypatch.setattr(fmp, "stock_news", lambda _: [article(url=f"https://publisher.example/{i}") for i in range(12)])
    assert len(call(handler, "GET", "/market/news")[1]["articles"]) == 6
    monkeypatch.setattr(fmp, "stock_news", lambda _: [])
    assert call(handler, "GET", "/market/news", query={"symbols": "AAPL"})[1]["articles"] == []
    monkeypatch.setattr(fmp, "stock_news", lambda _: [{"error": "unavailable"}])
    assert call(handler, "GET", "/market/news", query={"symbols": "MSFT"})[0] == 502


@pytest.mark.parametrize("symbols", ["", "A,B,C", "bad ticker"])
def test_bad_symbols_do_not_call_provider(aws, monkeypatch, symbols):
    monkeypatch.setattr(fmp, "stock_news", lambda _: pytest.fail("Unexpected provider call"))
    assert call(handler, "GET", "/market/news", query={"symbols": symbols})[0] == 400


def test_cache_keeps_retrieval_time_on_failure(aws, monkeypatch):
    calls = []
    monkeypatch.setattr(fmp, "stock_news", lambda symbols: calls.append(symbols) or [article()])
    first = call(handler, "GET", "/market/news", query={"symbols": "MSFT,AAPL"})[1]
    assert call(handler, "GET", "/market/news", query={"symbols": "AAPL,MSFT"})[1] == first
    assert len(calls) == 1
    row = db.get("CACHE#fmp", "news:AAPL,MSFT")
    row["expiresAt"] = time.time() - 1
    db.put("CACHE#fmp", "news:AAPL,MSFT", row)

    def fail(_):
        raise UpstreamError("fmp", "HTTP 402")

    monkeypatch.setattr(fmp, "stock_news", fail)
    status, stale = call(handler, "GET", "/market/news", query={"symbols": "AAPL,MSFT"})
    assert status == 200 and stale["stale"] and stale["fetchedAt"] == first["fetchedAt"]
    assert call(handler, "GET", "/market/news")[0] == 502
