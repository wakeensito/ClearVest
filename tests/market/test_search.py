"""Tests for GET /market/search: the unified beginner search (see the design doc at
docs/handoffs/2026-09-27-data-unified-search.md).

Test IDs referenced below are the "B" rows of the edge-case register in the plan this route
implements - every B1-B14 row has at least one test here. Three layers:
- `market.providers.yahoo.search` against a fake `yfinance` module (no network): quoteType
  mapping, dropped kinds, the exact kwargs passed to `yf.Search`, and exception wrapping.
- `market.routes.search`'s pure helpers directly: symbol normalization (BRK.B -> BRK-B,
  foreign listings dropped), kind heuristic, leveraged detection, call gating, merge and rank.
- the full `GET /market/search` route: validation, provider-down degradation, caching
  (versioned key), staleness, and the OpenAPI contract.
"""

import sys
import time
import types
from typing import ClassVar

import pytest
import responses
from clearvest import db
from clearvest.errors import UpstreamError
from market.app import handler
from market.providers import fmp, yahoo
from market.routes import search

from tests.contract import assert_matches
from tests.helpers import call


def request(query="apple"):
    return call(handler, "GET", "/market/search", query={"query": query})


def fmp_row(symbol, name, exchange="NASDAQ"):
    return {"symbol": symbol, "name": name, "exchange": exchange}


def yahoo_row(symbol, name, kind, exchange="NASDAQ"):
    return {"symbol": symbol, "name": name, "exchange": exchange, "kind": kind}


# --- market.providers.yahoo.search: unit tests against a fake yfinance module ------------------


class FakeSearch:
    """Mirrors `yf.Search(query, **kwargs).quotes`. `respond` may return a list or raise."""

    captured_kwargs: ClassVar[dict] = {}

    def __init__(self, query, **kwargs):
        FakeSearch.captured_kwargs = {"query": query, **kwargs}
        self._quotes = self.respond(query)

    @property
    def quotes(self):
        return self._quotes

    @staticmethod
    def respond(query):
        return []


def install_yahoo_search(monkeypatch, respond):
    fake_cls = type("FakeSearch", (FakeSearch,), {"respond": staticmethod(respond)})
    fake = types.SimpleNamespace(Search=fake_cls, set_tz_cache_location=lambda path: None)
    monkeypatch.setitem(sys.modules, "yfinance", fake)
    return fake_cls


def test_yahoo_search_maps_quote_types_and_drops_unmapped(monkeypatch):
    quotes = [
        {"symbol": "AAPL", "longname": "Apple Inc.", "exchange": "NMS", "quoteType": "EQUITY"},
        {"symbol": "SPY", "shortname": "SPDR S&P 500", "exchange": "PCX", "quoteType": "ETF"},
        {"symbol": "FXAIX", "longname": "Fidelity 500 Index Fund", "exchange": None, "quoteType": "MUTUALFUND"},
        {"symbol": "^GSPC", "shortname": "S&P 500", "exchange": None, "quoteType": "INDEX"},
        {"symbol": "BTC-USD", "shortname": "Bitcoin USD", "exchange": "CCC", "quoteType": "CRYPTOCURRENCY"},
        {"symbol": "SAAPL", "shortname": "Apple future", "exchange": "CME", "quoteType": "FUTURE"},
        {"symbol": "AAPL240119C00150000", "shortname": "Apple option", "quoteType": "OPTION"},
    ]
    install_yahoo_search(monkeypatch, lambda query: quotes)
    rows = yahoo.search("apple")
    assert [r["symbol"] for r in rows] == ["AAPL", "SPY", "FXAIX", "^GSPC", "BTC-USD"]
    assert [r["kind"] for r in rows] == ["stock", "etf", "mutual_fund", "index", "crypto"]
    assert rows[0]["name"] == "Apple Inc."
    assert rows[1]["name"] == "SPDR S&P 500"  # falls back to shortname when longname is absent


def test_yahoo_search_drops_rows_missing_symbol_or_name(monkeypatch):
    quotes = [
        {"symbol": "", "longname": "No symbol", "quoteType": "EQUITY"},
        {"symbol": "ZZZZ", "quoteType": "EQUITY"},  # no name at all
        None,
        "not a dict",
    ]
    install_yahoo_search(monkeypatch, lambda query: quotes)
    assert yahoo.search("x") == []


def test_yahoo_search_uses_expected_kwargs_no_fuzzy_short_timeout(monkeypatch):
    """B10: Yahoo is called with timeout=4 and fuzzy matching off, so a slow Yahoo response
    fails fast instead of eating into the route's time budget."""
    fake_cls = install_yahoo_search(monkeypatch, lambda query: [])
    yahoo.search("apple")
    kwargs = fake_cls.captured_kwargs
    assert kwargs["query"] == "apple"
    assert kwargs["timeout"] == 4
    assert kwargs["enable_fuzzy_query"] is False
    assert kwargs["max_results"] == 8
    assert kwargs["news_count"] == 0
    assert kwargs["lists_count"] == 0
    assert kwargs["include_cb"] is False


def test_yahoo_search_wraps_any_exception_as_upstream_error(monkeypatch):
    """B9: a timeout, a network error, or Yahoo returning a consent page instead of JSON must
    never surface as a raw exception (and never a 500) - broad except, same as history()."""
    def boom(query):
        raise ValueError("<html>consent required</html>")
    install_yahoo_search(monkeypatch, boom)
    with pytest.raises(UpstreamError):
        yahoo.search("apple")


# --- market.routes.search: pure helpers ---------------------------------------------------------


@pytest.mark.parametrize("raw,expected", [
    ("brk.b", "BRK-B"),          # B4: share-class suffix normalized
    ("BRK.B", "BRK-B"),
    ("bf.b", "BF-B"),
    ("aapl", "AAPL"),
    ("^gspc", "^GSPC"),          # index ticker shape preserved
    ("btc-usd", "BTC-USD"),
    ("aapl.l", None),            # B4: foreign listing dropped (remaining '.')
    ("vfv.to", None),
    ("0p000125kv.l", None),
    ("saapl=f", None),           # B6: futures suffix dropped
    ("<bad>", None),             # fails the SYMBOL regex
    ("", None),
])
def test_normalize_symbol(raw, expected):
    assert search._normalize_symbol(raw) == expected


def test_kind_heuristic_etf_by_name():
    assert search._kind_heuristic("SPY", "SPDR S&P 500 ETF Trust") == "etf"
    assert search._kind_heuristic("VOO", "Vanguard S&P 500 ETF") == "etf"


def test_kind_heuristic_mutual_fund_by_symbol_shape():
    assert search._kind_heuristic("FXAIX", "Fidelity 500 Index Fund") == "mutual_fund"
    assert search._kind_heuristic("SWPPX", "Schwab S&P 500 Index Fund") == "mutual_fund"


def test_kind_heuristic_defaults_to_stock():
    """B13: the FMP-only heuristic can be wrong (documented - the identity line corrects it
    after selection); a plain company name with no ETF/Trust wording and no fund-shaped
    symbol falls back to stock."""
    assert search._kind_heuristic("AAPL", "Apple Inc.") == "stock"
    assert search._kind_heuristic("XYZCO", "3x Corp") == "stock"


def test_leveraged_only_applies_to_fund_kinds():
    """B7: a stock whose name contains '3x'/'Ultra' is never flagged leveraged."""
    assert search._leveraged("etf", "ProShares UltraPro QQQ") is True
    assert search._leveraged("etf", "Direxion Daily 3x Bull") is True
    assert search._leveraged("stock", "3x Corp") is False
    assert search._leveraged("stock", "Ultra Clean Holdings") is False
    assert search._leveraged("index", "3x Leveraged Corp") is False


@pytest.mark.parametrize("query,expected_jobs", [
    ("a", set()),                                          # 1 char: no call at all
    ("ap", {"yahoo", "fmp_symbol"}),                        # 2 chars ticker-like: no name search
    ("apple", {"yahoo", "fmp_symbol", "fmp_name"}),         # 3+ chars ticker-like: also name
    ("brk-b", {"yahoo", "fmp_symbol", "fmp_name"}),
    ("APPLE", {"yahoo", "fmp_symbol", "fmp_name"}),         # caps still ticker-shaped
    ("index fund", {"yahoo", "fmp_name"}),                  # contains a space: never ticker-like
    ("apple inc", {"yahoo", "fmp_name"}),
])
def test_call_gating_by_query_shape(query, expected_jobs):
    """B12: provider-call gating by query length and shape."""
    assert set(search._jobs_for(query)) == expected_jobs


def test_jobs_for_normalizes_class_share_query_before_calling_providers(monkeypatch):
    """B4: "brk.b" must reach the providers as "BRK-B" ('normalized ... before lookup', not
    just in the results) - live Yahoo search never returns BRK-B for the literal dotted query,
    only for the dash form (verified live, see the unified-search handoff)."""
    calls = []
    monkeypatch.setattr(fmp, "search_companies", lambda q, by_symbol: calls.append(("fmp", q, by_symbol)) or [])
    monkeypatch.setattr(yahoo, "search", lambda q: calls.append(("yahoo", q)) or [])
    for job in search._jobs_for("brk.b").values():
        job()
    assert ("yahoo", "BRK-B") in calls
    assert ("fmp", "BRK-B", True) in calls
    assert ("fmp", "BRK-B", False) in calls


def test_jobs_for_name_query_is_not_normalized():
    """A name query (contains a space) is never treated as a normalizable symbol - it reaches
    the provider exactly as typed."""
    jobs = search._jobs_for("index fund")
    calls = []
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(fmp, "search_companies", lambda q, by_symbol: calls.append(q) or [])
        mp.setattr(yahoo, "search", lambda q: calls.append(q) or [])
        for job in jobs.values():
            job()
    assert calls == ["index fund", "index fund"]


def test_merge_yahoo_kind_wins_fmp_fills_exchange_gap_source_both():
    """B3: duplicate symbol across providers becomes one row; Yahoo's kind wins, FMP's
    exchange fills a gap Yahoo left null, and source becomes "both"."""
    rows = search._merge([
        {"symbol": "FXAIX", "name": "Fidelity 500 Index Fund", "exchange": None,
         "kind": "mutual_fund", "leveraged": False, "source": "yahoo"},
        {"symbol": "FXAIX", "name": "Fidelity 500 Index Fund", "exchange": "NAS",
         "kind": "stock", "leveraged": False, "source": "fmp"},
    ])
    assert len(rows) == 1
    assert rows[0]["kind"] == "mutual_fund"
    assert rows[0]["exchange"] == "NAS"
    assert rows[0]["source"] == "both"


def test_merge_leveraged_flag_sticks_from_either_source():
    rows = search._merge([
        {"symbol": "TQQQ", "name": "ProShares UltraPro QQQ", "exchange": "PCX",
         "kind": "etf", "leveraged": False, "source": "yahoo"},
        {"symbol": "TQQQ", "name": "ProShares UltraPro QQQ", "exchange": "PCX",
         "kind": "etf", "leveraged": True, "source": "fmp"},
    ])
    assert rows[0]["leveraged"] is True


def test_rank_exact_symbol_first():
    rows = [
        {"symbol": "APLE", "name": "Apple Hospitality REIT", "exchange": "NYSE"},
        {"symbol": "AAPL", "name": "Apple Inc.", "exchange": "NMS"},
    ]
    ranked = search._rank(rows, "aapl")
    assert ranked[0]["symbol"] == "AAPL"


def test_rank_one_letter_ticker_ranks_first_over_name_matches():
    """B1: real one-letter tickers (V Visa, F Ford, A Agilent, T AT&T) rank first via the
    exact-symbol rule whenever the provider returns them, never buried under longer name
    matches. Exercised directly against `_rank` since a literal 1-character query never
    reaches a provider (the "1 character -> no call" gating rule, tested separately)."""
    rows = [
        {"symbol": "VNM", "name": "VanEck Vietnam ETF", "exchange": "NYSE"},
        {"symbol": "V", "name": "Visa Inc.", "exchange": "NYSE"},
    ]
    assert search._rank(rows, "v")[0]["symbol"] == "V"
    rows = [
        {"symbol": "FDN", "name": "First Trust Dow Jones Internet ETF", "exchange": "NASDAQ"},
        {"symbol": "F", "name": "Ford Motor Co", "exchange": "NYSE"},
    ]
    assert search._rank(rows, "f")[0]["symbol"] == "F"


def test_rank_exact_match_normalizes_dotted_query():
    """B4: a query typed as "brk.b" still recognizes a normalized "BRK-B" row as the exact match."""
    rows = [
        {"symbol": "OTHERB", "name": "Berkshire Something", "exchange": "NYSE"},
        {"symbol": "BRK-B", "name": "Berkshire Hathaway Inc.", "exchange": "NYSE"},
    ]
    ranked = search._rank(rows, "brk.b")
    assert ranked[0]["symbol"] == "BRK-B"


def test_rank_us_exchange_before_foreign():
    """B5: a non-US exchange row is kept but ranked after a US one."""
    rows = [
        {"symbol": "IT", "name": "Gartner Inc (LSE listing)", "exchange": "LSE"},
        {"symbol": "IT", "name": "Gartner Inc.", "exchange": "NYSE"},
    ]
    ranked = search._rank(rows, "gartner")
    assert ranked[0]["exchange"] == "NYSE"


def test_rank_name_prefix_before_non_prefix_match():
    """Exchange is a tie (both null) so the name-prefix rule is what decides the order."""
    rows = [
        {"symbol": "ZZZZ", "name": "Something Apple-adjacent Corp", "exchange": None},
        {"symbol": "AAPL", "name": "Apple Inc.", "exchange": None},
    ]
    ranked = search._rank(rows, "apple")
    assert ranked[0]["symbol"] == "AAPL"


# --- GET /market/search route: validation, merge, providers, cache, contract -------------------


@pytest.mark.parametrize("query", ["", " ", "x" * 81, "apple\ninc"])
def test_invalid_search(aws, query):
    """B14 (validation), unchanged from the old /market/search behavior."""
    assert call(handler, "GET", "/market/search", query={"query": query})[0] == 400


def test_missing_user_id_is_rejected(aws):
    """B14: X-User-Id is still required, unchanged."""
    assert call(handler, "GET", "/market/search", query={"query": "apple"}, user=None)[0] == 400


def test_one_char_query_never_calls_a_provider(aws, monkeypatch):
    monkeypatch.setattr(fmp, "search_companies", lambda *_: pytest.fail("should not call fmp"))
    monkeypatch.setattr(yahoo, "search", lambda *_: pytest.fail("should not call yahoo"))
    status, body = request("a")
    assert status == 200
    assert body["results"] == [] and body["unavailable"] == []


def test_word_that_is_also_a_ticker_ranks_exact_first(aws, monkeypatch):
    """B1: "IT" (Gartner's ticker) ranks first over other name matches for a query of "IT"."""
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: [
        fmp_row("IT", "Gartner Inc."),
        fmp_row("ITW", "Illinois Tool Works Inc."),
    ])
    monkeypatch.setattr(yahoo, "search", lambda query: [])
    status, body = request("it")
    assert status == 200
    assert body["results"][0]["symbol"] == "IT"
    assert_matches("/market/search", "get", 200, body)


def test_dedup_across_providers_kind_from_yahoo_exchange_from_fmp(aws, monkeypatch):
    """B3: Apple appears from both providers; merged into one row, source "both"."""
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: [fmp_row("AAPL", "Apple Inc.", "NASDAQ")])
    monkeypatch.setattr(yahoo, "search", lambda query: [yahoo_row("AAPL", "Apple Inc.", "stock", None)])
    status, body = request("apple")
    assert status == 200
    aapl = next(r for r in body["results"] if r["symbol"] == "AAPL")
    assert aapl["source"] == "both"
    assert aapl["exchange"] == "NASDAQ"
    assert aapl["kind"] == "stock"
    assert_matches("/market/search", "get", 200, body)


def test_brk_b_normalized_and_listed_once(aws, monkeypatch):
    """B4: BRK.B (FMP) and BRK-B (Yahoo) merge into a single BRK-B row."""
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: [fmp_row("BRK.B", "Berkshire Hathaway Inc.")])
    monkeypatch.setattr(yahoo, "search", lambda query: [yahoo_row("BRK-B", "Berkshire Hathaway Inc.", "stock")])
    status, body = request("brk-b")
    assert status == 200
    assert [r["symbol"] for r in body["results"]] == ["BRK-B"]
    assert_matches("/market/search", "get", 200, body)


def test_foreign_listings_dropped(aws, monkeypatch):
    """B4: AAPL.L, VFV.TO and a foreign mutual fund suffix never appear."""
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: [
        fmp_row("AAPL", "Apple Inc."), fmp_row("AAPL.L", "Apple Inc. (London)"),
        fmp_row("VFV.TO", "Vanguard S&P 500 (Toronto)"), fmp_row("0P000125KV.L", "Foreign fund"),
    ])
    monkeypatch.setattr(yahoo, "search", lambda query: [])
    status, body = request("apple")
    assert status == 200
    assert [r["symbol"] for r in body["results"]] == ["AAPL"]
    assert_matches("/market/search", "get", 200, body)


def test_futures_and_options_dropped(aws, monkeypatch):
    """B6: Yahoo futures/options rows never reach the merged results (dropped in yahoo.search
    itself, before the route ever sees them)."""
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: [fmp_row("AAPL", "Apple Inc.")])
    monkeypatch.setattr(yahoo, "search", lambda query: [])  # futures/options already filtered by the provider
    _status, body = request("apple")
    assert [r["symbol"] for r in body["results"]] == ["AAPL"]


def test_non_us_exchange_kept_but_ranked_after_us(aws, monkeypatch):
    """B5: a non-US-exchange row (no dot suffix, so it isn't dropped as a foreign listing) is
    kept, just ranked after a US listing with the same name relevance. Two distinct symbols -
    a same-symbol duplicate would merge into one row instead of ranking (covered by B3)."""
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: [
        fmp_row("GRT", "Gartner Group PLC", "LSE"), fmp_row("IT", "Gartner Inc.", "NYSE"),
    ])
    monkeypatch.setattr(yahoo, "search", lambda query: [])
    status, body = request("gartner")
    assert status == 200
    assert body["results"][0]["symbol"] == "IT"
    assert body["results"][0]["exchange"] == "NYSE"
    assert any(r["symbol"] == "GRT" for r in body["results"])  # kept, just ranked after


def test_leveraged_fund_flagged_true_stock_never_flagged(aws, monkeypatch):
    """B7. TQQQ's kind comes from Yahoo (yfinance correctly tags it quoteType=ETF; FMP's
    search response carries no type field for the heuristic to use here - see B13), so the
    leveraged flag - gated on fund kinds - applies; a stock never gets it regardless of
    "3x"/"Ultra" wording in its name."""
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: [fmp_row("XYZC", "3x Corp")])
    monkeypatch.setattr(yahoo, "search", lambda query: [yahoo_row("TQQQ", "ProShares UltraPro QQQ", "etf")])
    status, body = request("proshares")
    assert status == 200
    tqqq = next(r for r in body["results"] if r["symbol"] == "TQQQ")
    corp = next(r for r in body["results"] if r["symbol"] == "XYZC")
    assert tqqq["leveraged"] is True
    assert corp["leveraged"] is False
    assert_matches("/market/search", "get", 200, body)


def test_index_and_crypto_pass_through(aws, monkeypatch):
    """B8: a crypto/index provider row is labelled with its own kind."""
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: [])
    monkeypatch.setattr(yahoo, "search", lambda query: [
        yahoo_row("BTC-USD", "Bitcoin USD", "crypto", "CCC"), yahoo_row("^GSPC", "S&P 500", "index", None),
    ])
    status, body = request("bitcoin")
    assert status == 200
    kinds = {r["symbol"]: r["kind"] for r in body["results"]}
    assert kinds == {"BTC-USD": "crypto", "^GSPC": "index"}


def test_provider_missing_or_empty_name_or_bad_symbol_dropped(aws, monkeypatch):
    """B3."""
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: [
        fmp_row("AAPL", "Apple Inc."), {"symbol": "BAD", "name": ""}, {"symbol": "<bad>", "name": "Bad"},
        {"symbol": "GOOD", "name": None}, None, "not a dict",
    ])
    monkeypatch.setattr(yahoo, "search", lambda query: [])
    _status, body = request("apple")
    assert [r["symbol"] for r in body["results"]] == ["AAPL"]


def test_provider_returns_more_than_eight_rows_capped(aws, monkeypatch):
    """B14."""
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: [
        fmp_row(f"AAA{i}", f"Company {i}") for i in range(12)
    ])
    monkeypatch.setattr(yahoo, "search", lambda query: [])
    status, body = request("company")
    assert status == 200
    assert len(body["results"]) == 8


def test_fmp_down_yahoo_ok_returns_yahoo_rows_and_unavailable(aws, monkeypatch):
    """B9."""
    def fmp_fail(*_):
        raise UpstreamError("fmp", "HTTP 402")
    monkeypatch.setattr(fmp, "search_companies", fmp_fail)
    monkeypatch.setattr(yahoo, "search", lambda query: [yahoo_row("AAPL", "Apple Inc.", "stock")])
    status, body = request("apple")
    assert status == 200
    assert body["unavailable"] == ["fmp"]
    assert [r["symbol"] for r in body["results"]] == ["AAPL"]
    assert_matches("/market/search", "get", 200, body)


def test_yahoo_down_fmp_ok_returns_fmp_rows_and_unavailable(aws, monkeypatch):
    """B9: kind comes from the FMP-only heuristic when Yahoo is unavailable."""
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: [fmp_row("AAPL", "Apple Inc.")])
    def yahoo_fail(*_):
        raise UpstreamError("yahoo", "timeout")
    monkeypatch.setattr(yahoo, "search", yahoo_fail)
    status, body = request("apple")
    assert status == 200
    assert body["unavailable"] == ["yahoo"]
    assert body["results"][0]["kind"] == "stock"
    assert_matches("/market/search", "get", 200, body)


def test_both_down_with_cache_serves_stale(aws, monkeypatch):
    """B9."""
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: [fmp_row("AAPL", "Apple Inc.")])
    monkeypatch.setattr(yahoo, "search", lambda query: [])
    original = request("apple")[1]

    row = db.get("CACHE#search", "search:v2:apple")
    row["expiresAt"] = time.time() - 1
    db.put("CACHE#search", "search:v2:apple", row)

    def fail(*_):
        raise UpstreamError("fmp", "offline")
    monkeypatch.setattr(fmp, "search_companies", fail)
    monkeypatch.setattr(yahoo, "search", fail)
    status, body = request("apple")
    assert status == 200
    assert body["stale"] is True
    assert body["results"] == original["results"]


def test_both_down_no_cache_is_502(aws, monkeypatch):
    """B9."""
    def fail(*_):
        raise UpstreamError("fmp", "offline")
    monkeypatch.setattr(fmp, "search_companies", fail)
    monkeypatch.setattr(yahoo, "search", fail)
    assert request("apple")[0] == 502


def test_no_match_returns_empty_results_not_an_error(aws, monkeypatch):
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: [])
    monkeypatch.setattr(yahoo, "search", lambda query: [])
    status, body = request("zzzznomatch")
    assert status == 200
    assert body["results"] == [] and body["unavailable"] == []


def test_cache_hits_no_provider_call_on_second_request(aws, monkeypatch):
    calls = []
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: calls.append(1) or [fmp_row("AAPL", "Apple Inc.")])
    monkeypatch.setattr(yahoo, "search", lambda query: [])
    first = request("apple")[1]
    second = request("apple")[1]
    assert first == second
    assert len(calls) == 2  # fmp_symbol + fmp_name on the first call only, none on the second


def test_casefold_and_whitespace_share_one_cache_row(aws, monkeypatch):
    """B2: " Apple ", "APPLE" and "apple" all hit the same cache row - only the first of the
    three requests below should ever reach a provider. "apple" is ticker-shaped, so it's
    normalized (uppercased) before it reaches the provider - see _jobs_for's docstring."""
    calls = []
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: calls.append(query) or [fmp_row("AAPL", "Apple Inc.")])
    monkeypatch.setattr(yahoo, "search", lambda query: [])
    request("apple")
    request("APPLE")
    request(" Apple ")
    assert calls == ["APPLE", "APPLE"]  # one fetch (fmp_symbol + fmp_name); the other two requests hit cache
    assert db.get("CACHE#search", "search:v2:apple") is not None


def test_non_ascii_query_does_not_crash_casefold_or_cache_key(aws, monkeypatch):
    """B2."""
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: [])
    monkeypatch.setattr(yahoo, "search", lambda query: [])
    status, _body = request("Nestlé")
    assert status == 200
    assert db.get("CACHE#search", "search:v2:nestlé") is not None


def test_cache_key_is_versioned_old_v1_rows_ignored(aws, monkeypatch):
    """B14: an old `search:v1:` row is never read; the route always uses the v2 key."""
    db.put("CACHE#search", "search:v1:apple", {"results": [{"symbol": "STALE_V1"}], "unavailable": []})
    monkeypatch.setattr(fmp, "search_companies", lambda query, by_symbol: [fmp_row("AAPL", "Apple Inc.")])
    monkeypatch.setattr(yahoo, "search", lambda query: [])
    status, body = request("apple")
    assert status == 200
    assert [r["symbol"] for r in body["results"]] == ["AAPL"]
    assert db.get("CACHE#search", "search:v2:apple") is not None


@responses.activate
def test_fmp_exchange_field_is_read_not_exchangeshortname(aws, monkeypatch):
    """The field regression this route fixes: FMP's /stable search endpoints return `exchange`,
    not `exchangeShortName` (research.py:138's bug). A `responses`-level test pins the real
    field name so nobody reverts to the non-existent one. Matches the verified live shape:
    keys are exactly currency/exchange/exchangeFullName/name/symbol - no exchangeShortName."""
    monkeypatch.setattr(yahoo, "search", lambda query: [])  # isolate the FMP field regression
    payload = [{"currency": "USD", "exchange": "NASDAQ", "exchangeFullName": "NASDAQ Global Select",
                "name": "Apple Inc.", "symbol": "AAPL"}]
    responses.get("https://financialmodelingprep.com/stable/search-symbol", json=payload)
    responses.get("https://financialmodelingprep.com/stable/search-name", json=payload)
    status, body = call(handler, "GET", "/market/search", query={"query": "apple"})
    assert status == 200
    aapl = next(r for r in body["results"] if r["symbol"] == "AAPL")
    assert aapl["exchange"] == "NASDAQ"
