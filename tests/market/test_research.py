"""Financial teaching must preserve periods, missing values and partial failures."""

import time

import pytest
import responses
from clearvest import db
from clearvest.errors import UpstreamError
from market.app import handler
from market.providers import fmp

from tests.contract import assert_matches
from tests.helpers import call


def statement(symbol="AAPL", **changes):
    return {"symbol": symbol, "date": "2025-09-27", "fiscalYear": "2025", "period": "FY",
            "reportedCurrency": "USD", "revenue": 100, "netIncome": 20, "epsDiluted": 2, **changes}


def provider(symbol, section):
    if section == "profile":
        return [{"symbol": symbol, "companyName": "Example company", "currency": "USD", "isEtf": False}]
    if section == "valuation":
        return [{"symbol": symbol, "priceToEarningsRatioTTM": 20, "netIncomePerShareTTM": 2}]
    if section == "history":
        return [statement(symbol, priceToEarningsRatio=18)]
    return [statement(symbol)]


def request(symbol="AAPL"):
    return call(handler, "GET", "/market/company-research", query={"symbol": symbol})


def test_research_contract_and_scoped_cache(aws, monkeypatch):
    calls = []
    monkeypatch.setattr(fmp, "research_section", lambda symbol, section: calls.append((symbol, section)) or provider(symbol, section))
    status, body = request("aapl")
    assert status == 200 and body["symbol"] == "AAPL"
    assert body["income"][0]["costOfRevenue"] is None
    assert len(body["sources"]) == 4 and not body["unavailable"]
    assert_matches("/market/company-research", "get", 200, body)
    assert request()[1] == body and len(calls) == 4
    assert request("MSFT")[1]["symbol"] == "MSFT" and len(calls) == 8


def test_partial_failure_keeps_other_sections(aws, monkeypatch):
    def partial(symbol, section):
        if section in {"history", "valuation"}:
            raise UpstreamError("fmp", "HTTP 402")
        return provider(symbol, section)
    monkeypatch.setattr(fmp, "research_section", partial)
    status, body = request()
    assert status == 200 and body["income"]
    assert body["unavailable"] == ["valuation", "history"]
    assert body["valuation"] is None
    assert_matches("/market/company-research", "get", 200, body)


def test_empty_fund_is_not_provider_failure(aws, monkeypatch):
    def fund(symbol, section):
        if section == "profile":
            return [{"symbol": symbol, "companyName": "Example ETF", "isEtf": True}]
        return []
    monkeypatch.setattr(fmp, "research_section", fund)
    status, body = request("VOO")
    assert status == 200 and body["profile"]["isFund"]
    assert body["income"] == [] and body["unavailable"] == []
    assert_matches("/market/company-research", "get", 200, body)


def test_annual_rows_are_sorted_filtered_deduplicated_and_capped(aws, monkeypatch):
    def mixed(symbol, section):
        if section != "income":
            return provider(symbol, section)
        return [statement(fiscalYear=str(y), date=f"{y}-09-27") for y in range(2018, 2026)] + [
            statement(symbol="OTHER"), statement(period="Q4", date="2025-12-31"),
            statement(fiscalYear="2025", date="2025-09-28", revenue=120),
            statement(fiscalYear="2026", date="invalid"), None]
    monkeypatch.setattr(fmp, "research_section", mixed)
    body = request()[1]
    assert [row["year"] for row in body["income"]] == ["2025", "2024", "2023", "2022", "2021"]
    assert body["income"][0]["revenue"] == 120


def test_nonfinite_and_boolean_values_never_become_financial_figures(aws, monkeypatch):
    def invalid(symbol, section):
        if section == "income":
            return [statement(revenue=float("inf"), netIncome=-10, grossProfit=float("nan"), epsDiluted=True)]
        return provider(symbol, section)
    monkeypatch.setattr(fmp, "research_section", invalid)
    row = request()[1]["income"][0]
    assert row["revenue"] is None and row["grossProfit"] is None and row["epsDiluted"] is None
    assert row["netIncome"] == -10


def test_cached_section_preserves_original_retrieval_date(aws, monkeypatch):
    monkeypatch.setattr(fmp, "research_section", provider)
    original = request()[1]
    row = db.get("CACHE#fmp", "research:v1:AAPL:income")
    row["expiresAt"] = time.time() - 1
    db.put("CACHE#fmp", "research:v1:AAPL:income", row)
    def failure(*args):
        raise UpstreamError("fmp", "offline")
    monkeypatch.setattr(fmp, "research_section", failure)
    status, body = request()
    assert status == 200 and body["income"] == original["income"]
    source = next(s for s in body["sources"] if s["section"] == "income")
    assert source["stale"] and source["fetchedAt"] == original["sources"][1]["fetchedAt"]
    assert request("MSFT")[0] == 502


@pytest.mark.parametrize("symbol", ["", "AAPL,MSFT", "bad ticker", "x" * 13, "<script>"])
def test_invalid_symbol_never_calls_provider(aws, monkeypatch, symbol):
    monkeypatch.setattr(fmp, "research_section", lambda *_: pytest.fail("Provider should not be called"))
    assert request(symbol)[0] == 400


def test_wrong_symbol_and_malformed_payload_are_unavailable(aws, monkeypatch):
    monkeypatch.setattr(fmp, "research_section", lambda *_: [{"symbol": "WRONG", "error": "unknown"}])
    assert request()[0] == 502


@responses.activate
def test_documented_fmp_endpoints_and_parameters(aws):
    for section, endpoint in [("profile", "profile"), ("income", "income-statement"), ("valuation", "ratios-ttm"), ("history", "ratios")]:
        responses.get(f"https://financialmodelingprep.com/stable/{endpoint}", json=provider("AAPL", section))
    assert request()[0] == 200
    assert len(responses.calls) == 4
    for response in responses.calls:
        assert response.request.params["symbol"] == "AAPL"
        if response.request.url.split("?")[0].endswith(("income-statement", "/ratios")):
            assert response.request.params["period"] == "annual"
            assert response.request.params["limit"] == "5"


def test_company_search_deduplicates_and_exact_symbol_first(aws, monkeypatch):
    monkeypatch.setattr(fmp, "search_companies", lambda *_: [
        {"symbol": "AAPL.L", "name": "Other listing"}, {"symbol": "AAPL", "name": "Apple Inc.", "exchangeShortName": "NASDAQ"},
        {"symbol": "AAPL", "name": "Duplicate"}, {"symbol": "<bad>", "name": "Bad"}, None])
    status, body = call(handler, "GET", "/market/search", query={"query": "aapl"})
    assert status == 200 and [r["symbol"] for r in body["results"]] == ["AAPL", "AAPL.L"]
    assert_matches("/market/search", "get", 200, body)


@pytest.mark.parametrize("query", ["", " ", "x" * 81, "apple\ninc"])
def test_invalid_search(aws, query):
    assert call(handler, "GET", "/market/search", query={"query": query})[0] == 400


def test_search_failure_empty_and_one_provider_available(aws, monkeypatch):
    def partial(query, by_symbol):
        if by_symbol:
            raise UpstreamError("fmp", "HTTP 402")
        return [{"symbol": "AAPL", "name": "Apple"}]
    monkeypatch.setattr(fmp, "search_companies", partial)
    assert call(handler, "GET", "/market/search", query={"query": "apple"})[1]["results"]
    monkeypatch.setattr(fmp, "search_companies", lambda *_: [])
    assert call(handler, "GET", "/market/search", query={"query": "no match"})[1]["results"] == []
    def fail(*_):
        raise UpstreamError("fmp", "offline")
    monkeypatch.setattr(fmp, "search_companies", fail)
    assert call(handler, "GET", "/market/search", query={"query": "other"})[0] == 502


def test_currency_is_never_guessed_or_truncated(aws, monkeypatch):
    monkeypatch.setattr(fmp, "research_section", lambda symbol, section: [statement(reportedCurrency="USDT")] if section == "income" else provider(symbol, section))
    assert request()[1]["income"][0]["currency"] is None
