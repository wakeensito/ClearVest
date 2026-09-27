"""News scopes, publisher URLs and cached snapshots must remain trustworthy.

Headlines come from Yahoo Finance via yfinance (FMP's news endpoints are 402 on the free tier).
`yahoo.news` is tested against a fake `yfinance` module; the route is tested with `yahoo.news`
monkeypatched, so no test touches the network.
"""

import sys
import threading
import time
import types

import pytest
from clearvest import db
from clearvest.errors import UpstreamError
from market.app import handler
from market.providers import yahoo

from tests.contract import assert_matches
from tests.helpers import call


def article(symbol="AAPL", **extra):
    """A normalized provider row, the shape `yahoo.news` returns."""
    return {"symbol": symbol, "title": "Company reports quarterly results", "url": "https://publisher.example/story",
            "image": "https://publisher.example/image.jpg", "publisher": "Publisher", "publishedDate": "2026-09-25T12:00:00Z", **extra}


def yahoo_item(title="Company reports quarterly results", url="https://publisher.example/story", **overrides):
    """One entry of `yfinance.Ticker(...).news` (0.2.50+ shape: everything under "content")."""
    content = {
        "title": title, "pubDate": "2026-09-25T12:00:00Z", "displayTime": "2026-09-25T12:05:00Z",
        "provider": {"displayName": "Publisher", "url": "https://publisher.example"},
        "thumbnail": {"originalUrl": "https://publisher.example/image.jpg", "resolutions": [{"url": "https://cdn.example/small.jpg"}]},
        "canonicalUrl": {"url": url}, "clickThroughUrl": {"url": "https://finance.yahoo.com/redirect"},
    }
    content.update(overrides)
    return {"id": "x", "content": content}


class FakeTicker:
    def __init__(self, news=None, error=None):
        self._news, self._error = news, error

    @property
    def news(self):
        if self._error:
            raise self._error
        return self._news


def install_yfinance(monkeypatch, tickers: dict, calls: list | None = None):
    def ticker(symbol):
        if calls is not None:
            calls.append(symbol)
        return tickers[symbol]
    fake = types.SimpleNamespace(Ticker=ticker, set_tz_cache_location=lambda path: None)
    monkeypatch.setitem(sys.modules, "yfinance", fake)


# --- yahoo.news: unit tests against a fake yfinance module ---------------------------------

def test_symbol_news_is_normalized_and_tagged(monkeypatch):
    calls = []
    aapl = [yahoo_item(url=f"https://publisher.example/aapl/{i}") for i in range(3)]
    install_yfinance(monkeypatch, {"AAPL": FakeTicker([yahoo_item(), *aapl]), "MSFT": FakeTicker([yahoo_item(url="https://publisher.example/msft")])}, calls)
    rows = yahoo.news(["AAPL", "MSFT"])
    assert calls == ["AAPL", "MSFT"]
    assert rows[0] == article()
    # Feeds interleave so the second company is not pushed out of the route's six slots.
    assert [r["symbol"] for r in rows] == ["AAPL", "MSFT", "AAPL", "AAPL", "AAPL"]
    assert rows[1]["url"] == "https://publisher.example/msft"


def test_market_wide_news_uses_the_index_feed_and_no_symbol(monkeypatch):
    calls = []
    install_yfinance(monkeypatch, {"^GSPC": FakeTicker([yahoo_item()])}, calls)
    rows = yahoo.news([])
    assert calls == ["^GSPC"]
    assert rows[0]["symbol"] == "" and rows[0]["title"] == "Company reports quarterly results"


def test_missing_fields_and_flat_legacy_shape(monkeypatch):
    legacy = {"title": "Old shape", "link": "https://publisher.example/old", "publisher": "Legacy"}
    no_thumb = yahoo_item(thumbnail=None, canonicalUrl=None, pubDate=None)
    install_yfinance(monkeypatch, {"AAPL": FakeTicker([legacy, no_thumb, "junk", None])})
    rows = yahoo.news(["AAPL"])
    assert rows[0] == {"symbol": "AAPL", "title": "Old shape", "url": "https://publisher.example/old", "image": None, "publisher": "Legacy", "publishedDate": ""}
    # Falls back to the click-through link, the display time, and no image.
    assert rows[1]["url"] == "https://finance.yahoo.com/redirect" and rows[1]["publishedDate"] == "2026-09-25T12:05:00Z" and rows[1]["image"] is None
    assert len(rows) == 2


def test_hung_yahoo_becomes_upstream_error_not_a_lambda_timeout(monkeypatch):
    release = threading.Event()

    class HangingTicker:
        @property
        def news(self):
            release.wait(2)
            return []

    install_yfinance(monkeypatch, {"AAPL": HangingTicker()})
    monkeypatch.setattr(yahoo, "_NEWS_TIMEOUT", 0.05)
    started = time.time()
    with pytest.raises(UpstreamError) as err:
        yahoo.news(["AAPL"])
    assert "timed out" in err.value.detail
    assert time.time() - started < 1  # did not wait for the hung request
    release.set()


def test_yfinance_failure_and_empty_feed(monkeypatch):
    install_yfinance(monkeypatch, {"AAPL": FakeTicker(error=RuntimeError("boom")), "MSFT": FakeTicker(None)})
    with pytest.raises(UpstreamError):
        yahoo.news(["AAPL"])
    assert yahoo.news(["MSFT"]) == []


# --- GET /market/news: the route with the provider monkeypatched -----------------------------

@pytest.mark.parametrize("symbols", [None, "msft, aapl"])
def test_news_provider_and_contract(aws, monkeypatch, symbols):
    calls = []
    monkeypatch.setattr(yahoo, "news", lambda requested: calls.append(requested) or [article(s) for s in (requested or ["AAPL"])])
    status, body = call(handler, "GET", "/market/news", query={} if symbols is None else {"symbols": symbols})
    assert status == 200
    assert calls == [[] if symbols is None else ["AAPL", "MSFT"]]
    assert body["symbols"] == ([] if symbols is None else ["AAPL", "MSFT"])
    assert body["source"] == "Yahoo Finance"
    assert body["articles"][0]["publishedAt"] == "2026-09-25T12:00:00Z"
    assert_matches("/market/news", "get", 200, body)


def test_related_scope_filters_unrelated_and_deduplicates(aws, monkeypatch):
    monkeypatch.setattr(yahoo, "news", lambda _: [article(), article(), article("TSLA", url="https://publisher.example/other")])
    body = call(handler, "GET", "/market/news", query={"symbols": "AAPL"})[1]
    assert len(body["articles"]) == 1 and body["articles"][0]["symbol"] == "AAPL"


def test_invalid_links_and_images_never_reach_the_ui(aws, monkeypatch):
    monkeypatch.setattr(yahoo, "news", lambda _: [article(url="javascript:alert(1)"), article(url="data:text/html,test"), article(url="https://user:secret@publisher.example/story"), article(image="javascript:bad")])
    body = call(handler, "GET", "/market/news")[1]
    assert len(body["articles"]) == 1 and body["articles"][0]["image"] is None


def test_limit_empty_and_invalid_payload(aws, monkeypatch):
    monkeypatch.setattr(yahoo, "news", lambda _: [article(url=f"https://publisher.example/{i}") for i in range(12)])
    assert len(call(handler, "GET", "/market/news")[1]["articles"]) == 6
    monkeypatch.setattr(yahoo, "news", lambda _: [])
    assert call(handler, "GET", "/market/news", query={"symbols": "AAPL"})[1]["articles"] == []
    monkeypatch.setattr(yahoo, "news", lambda _: [{"error": "unavailable"}])
    assert call(handler, "GET", "/market/news", query={"symbols": "MSFT"})[0] == 502


def test_empty_feed_is_cached_briefly_not_for_an_hour(aws, monkeypatch):
    monkeypatch.setattr(yahoo, "news", lambda _: [])
    assert call(handler, "GET", "/market/news", query={"symbols": "AAPL"})[1]["articles"] == []
    row = db.get("CACHE#yahoo", "news:AAPL")
    assert row["expiresAt"] - time.time() <= 300


@pytest.mark.parametrize("symbols", ["", "A,B,C", "bad ticker"])
def test_bad_symbols_do_not_call_provider(aws, monkeypatch, symbols):
    monkeypatch.setattr(yahoo, "news", lambda _: pytest.fail("Unexpected provider call"))
    assert call(handler, "GET", "/market/news", query={"symbols": symbols})[0] == 400


def test_cache_keeps_retrieval_time_on_failure(aws, monkeypatch):
    calls = []
    monkeypatch.setattr(yahoo, "news", lambda symbols: calls.append(symbols) or [article()])
    first = call(handler, "GET", "/market/news", query={"symbols": "MSFT,AAPL"})[1]
    assert call(handler, "GET", "/market/news", query={"symbols": "AAPL,MSFT"})[1] == first
    assert len(calls) == 1
    row = db.get("CACHE#yahoo", "news:AAPL,MSFT")
    row["expiresAt"] = time.time() - 1
    db.put("CACHE#yahoo", "news:AAPL,MSFT", row)

    def fail(_):
        raise UpstreamError("yahoo", "HTTP 429")

    monkeypatch.setattr(yahoo, "news", fail)
    status, stale = call(handler, "GET", "/market/news", query={"symbols": "AAPL,MSFT"})
    assert status == 200 and stale["stale"] and stale["fetchedAt"] == first["fetchedAt"]
    assert call(handler, "GET", "/market/news")[0] == 502
