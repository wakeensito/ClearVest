"""Tests for GET /market/fund: the beginner "what is this?" explainer.

Every number in the response must come from yfinance, never the model. Two layers are tested:
- `market.providers.yahoo.fund_profile` against a fake `yfinance` module (no network), covering
  the ETF/mutual-fund/stock split and the expense-ratio unit quirk.
- `market.routes.fund` against a monkeypatched `yahoo.fund_profile` + `bedrock.converse`,
  covering validation, caching, staleness and the summary guardrails.
"""

import sys
import time
import types

import pandas as pd
import pytest
from clearvest import db
from clearvest.errors import UpstreamError
from clearvest.providers import bedrock
from market.app import handler
from market.providers import yahoo
from market.routes import fund
from yfinance.exceptions import (
    YFDataException,
)

from tests.contract import assert_matches
from tests.helpers import call

VOO_SUMMARY = (
    "The fund manager employs an indexing investment approach designed to track the performance "
    "of the Standard & Poor's 500 Index, a widely recognized benchmark of U.S. common stocks. The "
    "fund attempts to replicate the target index by investing all, or substantially all, of its "
    "assets in the stocks that make up the index."
)

VOO_INFO = {
    "quoteType": "ETF",
    "longName": "Vanguard S&P 500 ETF",
    "shortName": "Vanguard S&P 500 ETF",
    "netExpenseRatio": 0.03,
    "annualReportExpenseRatio": None,
    "longBusinessSummary": VOO_SUMMARY,
    "fundFamily": "Vanguard",
    "category": "Large Blend",
}

VFIAX_INFO = {
    "quoteType": "MUTUALFUND",
    "longName": "Vanguard 500 Index Admiral",
    "shortName": "Vanguard 500 Index Admiral",
    "netExpenseRatio": 0.04,
    "annualReportExpenseRatio": 0.0004,
    "longBusinessSummary": VOO_SUMMARY,
    "fundFamily": "Vanguard",
    "category": "Large Blend",
}

AAPL_INFO = {
    "quoteType": "EQUITY",
    "longName": "Apple Inc.",
    "shortName": "Apple Inc.",
    "netExpenseRatio": None,
    "annualReportExpenseRatio": None,
    "longBusinessSummary": "Apple Inc. designs, manufactures and markets smartphones, personal "
                           "computers, tablets, wearables and accessories worldwide.",
    "sector": "Technology",
}

TOP_HOLDINGS = pd.DataFrame(
    {"Name": ["NVIDIA Corp", "Apple Inc", "Microsoft Corp"], "Holding Percent": [0.080820, 0.070339, 0.056958]},
    index=pd.Index(["NVDA", "AAPL", "MSFT"], name="Symbol"),
)


class FakeFundsData:
    def __init__(self, holdings=None, error=None):
        self._holdings = holdings
        self._error = error

    @property
    def top_holdings(self):
        if self._error:
            raise self._error
        return self._holdings


class FakeTicker:
    def __init__(self, info, holdings=None, holdings_error=None):
        self.info = info
        self._funds_data = FakeFundsData(holdings, holdings_error)

    @property
    def funds_data(self):
        return self._funds_data


def install_yfinance(monkeypatch, tickers: dict):
    """tickers: {symbol: FakeTicker}. Mirrors the real yfinance module surface yahoo.py uses."""
    fake = types.SimpleNamespace(Ticker=lambda symbol: tickers[symbol], set_tz_cache_location=lambda path: None)
    monkeypatch.setitem(sys.modules, "yfinance", fake)


GOOD_REPLY = (
    "Owning this fund gives you a small slice of hundreds of leading American companies all at "
    "once.\nTRACKS: Standard & Poor's 500 Index"
)


def request(symbol="VOO"):
    return call(handler, "GET", "/market/fund", query={"symbol": symbol})


# --- yahoo.fund_profile: unit tests against a fake yfinance module -------------------------


def test_etf_profile_from_fake_yfinance(monkeypatch):
    install_yfinance(monkeypatch, {"VOO": FakeTicker(VOO_INFO, TOP_HOLDINGS)})
    profile = yahoo.fund_profile("VOO")
    assert profile["kind"] == "etf"
    assert profile["name"] == "Vanguard S&P 500 ETF"
    assert profile["expenseRatio"] == 0.0003
    assert profile["fundFamily"] == "Vanguard"
    assert profile["category"] == "Large Blend"
    assert profile["sector"] is None
    assert [h["symbol"] for h in profile["topHoldings"]] == ["NVDA", "AAPL", "MSFT"]
    assert profile["topHoldings"][0] == {"symbol": "NVDA", "name": "NVIDIA Corp", "weight": 0.080820}


def test_mutual_fund_profile(monkeypatch):
    install_yfinance(monkeypatch, {"VFIAX": FakeTicker(VFIAX_INFO, TOP_HOLDINGS)})
    profile = yahoo.fund_profile("VFIAX")
    assert profile["kind"] == "mutual_fund"
    assert profile["expenseRatio"] == 0.0004


def test_stock_profile_has_no_fund_fields(monkeypatch):
    install_yfinance(monkeypatch, {"AAPL": FakeTicker(AAPL_INFO, holdings_error=YFDataException("AAPL: No Fund data found."))})
    profile = yahoo.fund_profile("AAPL")
    assert profile["kind"] == "stock"
    assert profile["expenseRatio"] is None
    assert profile["holdingsCount"] is None
    assert profile["topHoldings"] == []
    assert profile["fundFamily"] is None
    assert profile["category"] is None
    assert profile["sector"] == "Technology"


def test_expense_ratio_percent_vs_fraction_units(monkeypatch):
    """netExpenseRatio is a PERCENT (0.03 -> 0.0003); annualReportExpenseRatio is already a
    FRACTION (0.0004 stays 0.0004). netExpenseRatio wins when both are present."""
    both = {**VFIAX_INFO, "netExpenseRatio": 0.04, "annualReportExpenseRatio": 0.0004}
    install_yfinance(monkeypatch, {
        "A": FakeTicker({**both}),
        "B": FakeTicker({**both, "netExpenseRatio": None}),  # only the fraction field present
    })
    assert yahoo.fund_profile("A")["expenseRatio"] == 0.0004
    assert yahoo.fund_profile("B")["expenseRatio"] == 0.0004


def test_expense_ratio_missing_is_none(monkeypatch):
    install_yfinance(monkeypatch, {"X": FakeTicker({**VOO_INFO, "netExpenseRatio": None, "annualReportExpenseRatio": None})})
    assert yahoo.fund_profile("X")["expenseRatio"] is None


def test_expense_ratio_bad_data_over_20_percent_is_none(monkeypatch):
    install_yfinance(monkeypatch, {"X": FakeTicker({**VOO_INFO, "netExpenseRatio": 25})})  # -> 0.25 fraction
    assert yahoo.fund_profile("X")["expenseRatio"] is None


def test_missing_funds_data_yields_no_holdings_not_a_failure(monkeypatch):
    install_yfinance(monkeypatch, {"VOO": FakeTicker(VOO_INFO, holdings_error=YFDataException("VOO: No Fund data found."))})
    profile = yahoo.fund_profile("VOO")
    assert profile["kind"] == "etf"
    assert profile["topHoldings"] == []
    assert profile["holdingsCount"] is None


def test_holdings_count_only_when_present_and_positive(monkeypatch):
    install_yfinance(monkeypatch, {
        "VOO": FakeTicker({**VOO_INFO, "holdingsCount": 504}, TOP_HOLDINGS),
        "QQQ": FakeTicker({**VOO_INFO, "holdingsCount": -1}, TOP_HOLDINGS),
    })
    assert yahoo.fund_profile("VOO")["holdingsCount"] == 504
    assert yahoo.fund_profile("QQQ")["holdingsCount"] is None


def test_top_holdings_sorted_desc_and_capped_at_ten(monkeypatch):
    names = [f"Company {i}" for i in range(12)]
    weights = [0.01 * i for i in range(12)]  # ascending, must come back descending
    frame = pd.DataFrame({"Name": names, "Holding Percent": weights}, index=pd.Index([f"T{i}" for i in range(12)], name="Symbol"))
    install_yfinance(monkeypatch, {"VOO": FakeTicker(VOO_INFO, frame)})
    holdings = yahoo.fund_profile("VOO")["topHoldings"]
    assert len(holdings) == 10
    assert [h["weight"] for h in holdings] == sorted((h["weight"] for h in holdings), reverse=True)
    assert holdings[0]["weight"] == max(weights)


def test_provider_failure_raises_upstream(monkeypatch):
    def boom(symbol):
        raise RuntimeError("network down")
    fake = types.SimpleNamespace(Ticker=boom, set_tz_cache_location=lambda path: None)
    monkeypatch.setitem(sys.modules, "yfinance", fake)
    with pytest.raises(UpstreamError):
        yahoo.fund_profile("VOO")


def test_empty_info_raises_upstream(monkeypatch):
    install_yfinance(monkeypatch, {"ZZZZ": FakeTicker({})})
    with pytest.raises(UpstreamError):
        yahoo.fund_profile("ZZZZ")


# --- routes/fund.py: guardrails on the model's rewrite ---------------------------------------


def test_summary_accepts_a_good_reply(monkeypatch):
    monkeypatch.setattr(bedrock, "converse", lambda *a, **k: GOOD_REPLY)
    summary, source, tracks = fund._summarize("VOO", "etf", True, VOO_SUMMARY)
    assert source == "model"
    assert "hundreds" in summary
    assert tracks == "Standard & Poor's 500 Index"


@pytest.mark.parametrize("bad_reply", [
    "This fund holds 500 companies together.\nTRACKS: NONE",  # contains a digit
    "This fund charges a small % fee to manage your money.\nTRACKS: NONE",  # contains %
    "TRACKS: NONE",  # empty sentence
    "   \nTRACKS: NONE",  # blank sentence
    ("This fund is a very very very very very very very very very very very very very very very "
     "long sentence that goes on and on and on well past thirty words in total.\nTRACKS: NONE"),  # >30 words
])
def test_summary_guardrails_reject_and_fall_back_to_template(monkeypatch, bad_reply):
    monkeypatch.setattr(bedrock, "converse", lambda *a, **k: bad_reply)
    summary, source, tracks = fund._summarize("VOO", "etf", True, VOO_SUMMARY)
    assert source == "template"
    assert summary == "VOO is an index ETF that holds a basket of many investments in one."
    assert tracks is None


def test_summary_falls_back_on_bedrock_failure(monkeypatch):
    def boom(*a, **k):
        raise UpstreamError("bedrock", "throttled")
    monkeypatch.setattr(bedrock, "converse", boom)
    summary, source, tracks = fund._summarize("VOO", "etf", True, VOO_SUMMARY)
    assert (source, tracks) == ("template", None)
    assert summary == "VOO is an index ETF that holds a basket of many investments in one."


def test_tracks_only_accepted_when_verbatim_in_source(monkeypatch):
    reply = "Owning this fund spreads your money across many great companies at once.\nTRACKS: S&P 500"
    monkeypatch.setattr(bedrock, "converse", lambda *a, **k: reply)
    _summary, source, tracks = fund._summarize("VOO", "etf", True, VOO_SUMMARY)
    assert source == "model"  # the sentence itself is fine
    assert tracks is None  # "S&P 500" never appears verbatim in VOO_SUMMARY


def test_tracks_case_insensitive_match(monkeypatch):
    reply = "Owning this fund spreads your money across many great companies at once.\nTRACKS: standard & poor's 500 index"
    monkeypatch.setattr(bedrock, "converse", lambda *a, **k: reply)
    _, _, tracks = fund._summarize("VOO", "etf", True, VOO_SUMMARY)
    assert tracks == "standard & poor's 500 index"


def test_no_source_text_uses_template_without_calling_model(monkeypatch):
    monkeypatch.setattr(bedrock, "converse", lambda *a, **k: pytest.fail("should not call the model"))
    summary, source, tracks = fund._summarize("VOO", "etf", False, "")
    assert (source, tracks) == ("template", None)
    assert summary == "VOO is an ETF that holds a basket of many investments in one."


def test_stock_template_text():
    assert fund._template_summary("AAPL", "stock", False) == (
        "AAPL is one company's stock: owning a share means owning a small piece of that business."
    )


# --- GET /market/fund route: validation, contract, caching, staleness -----------------------


def test_bad_symbol_is_400(aws, monkeypatch):
    monkeypatch.setattr(yahoo, "fund_profile", lambda *_: pytest.fail("should not call provider"))
    for symbol in ["", "v o o", "x" * 13, "<script>", "VOO,QQQ"]:
        assert request(symbol)[0] == 400


def test_etf_happy_path_contract(aws, monkeypatch):
    monkeypatch.setattr(yahoo, "fund_profile", lambda symbol: yahoo_profile_for(symbol))
    monkeypatch.setattr(bedrock, "converse", lambda *a, **k: GOOD_REPLY)
    status, body = request("VOO")
    assert status == 200
    assert body["symbol"] == "VOO"
    assert body["kind"] == "etf"
    assert body["isIndexFund"] is True
    assert body["tracks"] == "Standard & Poor's 500 Index"
    assert body["expenseRatio"] == 0.0003
    assert body["summarySource"] == "model"
    assert body["fundFamily"] == "Vanguard"
    assert body["category"] == "Large Blend"
    assert body["sector"] is None
    assert body["stale"] is False
    assert_matches("/market/fund", "get", 200, body)


def yahoo_profile_for(symbol):
    if symbol == "VOO":
        return {
            "name": "Vanguard S&P 500 ETF", "kind": "etf", "expenseRatio": 0.0003,
            "holdingsCount": 504, "topHoldings": [{"symbol": "NVDA", "name": "NVIDIA Corp", "weight": 0.08082}],
            "fundFamily": "Vanguard", "category": "Large Blend", "sector": None, "description": VOO_SUMMARY,
        }
    if symbol == "VFIAX":
        return {
            "name": "Vanguard 500 Index Admiral", "kind": "mutual_fund", "expenseRatio": 0.0004,
            "holdingsCount": None, "topHoldings": [], "fundFamily": "Vanguard", "category": "Large Blend",
            "sector": None, "description": VOO_SUMMARY,
        }
    if symbol == "AAPL":
        return {
            "name": "Apple Inc.", "kind": "stock", "expenseRatio": None, "holdingsCount": None,
            "topHoldings": [], "fundFamily": None, "category": None, "sector": "Technology",
            "description": AAPL_INFO["longBusinessSummary"],
        }
    raise AssertionError(f"unexpected symbol {symbol}")


def test_mutual_fund_contract(aws, monkeypatch):
    monkeypatch.setattr(yahoo, "fund_profile", lambda symbol: yahoo_profile_for(symbol))
    monkeypatch.setattr(bedrock, "converse", lambda *a, **k: GOOD_REPLY)
    status, body = request("VFIAX")
    assert status == 200
    assert body["kind"] == "mutual_fund"
    assert body["isIndexFund"] is True
    assert body["topHoldings"] == []
    assert_matches("/market/fund", "get", 200, body)


def test_stock_contract(aws, monkeypatch):
    monkeypatch.setattr(yahoo, "fund_profile", lambda symbol: yahoo_profile_for(symbol))

    # A stock's business summary is rewritten by the model too; make it fail here to exercise
    # the template fallback path for the "stock" wording.
    def boom(*a, **k):
        raise UpstreamError("bedrock", "down")
    monkeypatch.setattr(bedrock, "converse", boom)
    status, body = request("AAPL")
    assert status == 200
    assert body["kind"] == "stock"
    assert body["isIndexFund"] is False
    assert body["tracks"] is None
    assert body["expenseRatio"] is None
    assert body["holdingsCount"] is None
    assert body["topHoldings"] == []
    assert body["fundFamily"] is None
    assert body["category"] is None
    assert body["sector"] == "Technology"
    assert body["summary"] == (
        "AAPL is one company's stock: owning a share means owning a small piece of that business."
    )
    assert body["summarySource"] == "template"
    assert_matches("/market/fund", "get", 200, body)


def test_provider_failure_with_no_cache_is_502(aws, monkeypatch):
    def boom(_symbol):
        raise UpstreamError("yahoo", "down")
    monkeypatch.setattr(yahoo, "fund_profile", boom)
    assert request("VOO")[0] == 502


def test_caching_hits_no_provider_on_second_call(aws, monkeypatch):
    calls = []
    def fake(symbol):
        calls.append(symbol)
        return yahoo_profile_for("VOO")
    monkeypatch.setattr(yahoo, "fund_profile", fake)
    monkeypatch.setattr(bedrock, "converse", lambda *a, **k: GOOD_REPLY)
    first = request("VOO")
    second = request("VOO")
    assert first[1] == second[1]
    assert len(calls) == 1


def test_stale_cache_is_served_on_provider_failure(aws, monkeypatch):
    monkeypatch.setattr(yahoo, "fund_profile", lambda symbol: yahoo_profile_for("VOO"))
    monkeypatch.setattr(bedrock, "converse", lambda *a, **k: GOOD_REPLY)
    original = request("VOO")[1]
    row = db.get("CACHE#fund", "VOO")
    row["expiresAt"] = time.time() - 1
    db.put("CACHE#fund", "VOO", row)

    def boom(_symbol):
        raise UpstreamError("yahoo", "down")
    monkeypatch.setattr(yahoo, "fund_profile", boom)
    status, body = request("VOO")
    assert status == 200
    assert body["stale"] is True
    assert body["symbol"] == original["symbol"]
    assert_matches("/market/fund", "get", 200, body)
