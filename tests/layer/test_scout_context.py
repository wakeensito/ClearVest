import time

import pytest
from advisor.app import handler
from clearvest import advisor, db
from clearvest.providers import bedrock, guardrails
from clearvest.scout_context import PageContext, Scenario, evidence, scenario_result
from pydantic import ValidationError

from tests.helpers import USER, call
from tests.layer.test_advisor import seed


def snapshot():
    return {"asOf": "2026-09-26", "totalValue": 10000, "holdings": [
        {"symbol": "NVDA", "value": 4000, "type": "equity"},
        {"symbol": "NVDA", "value": 2000, "type": "equity"},
        {"symbol": "CASH", "value": 4000, "type": "cash"}]}


def test_scenario_aggregates_same_ticker_and_computes_portfolio_impact():
    out = scenario_result(snapshot(), Scenario(symbol="NVDA", dropPct=20))
    assert out["loss"] == 1200 and out["after"] == 8800 and out["portfolioDropPct"] == 12
    assert out["positionValue"] == 6000


def test_scenario_zero_and_rounding():
    assert scenario_result(snapshot(), Scenario(symbol="NVDA", dropPct=0))["loss"] == 0
    value = snapshot()
    value["holdings"] = [{"symbol": "NVDA", "value": .05, "type": "equity"}]
    assert scenario_result(value, Scenario(symbol="NVDA", dropPct=10))["loss"] == .01


@pytest.mark.parametrize("drop", [-1, 61, 20.5, True, "20"])
def test_scenario_rejects_invalid_shocks(drop):
    with pytest.raises(ValidationError):
        Scenario(symbol="NVDA", dropPct=drop)


def test_scenario_refuses_missing_short_derivative_or_nonfinite_data():
    test = Scenario(symbol="NVDA", dropPct=20)
    assert scenario_result(None, test) is None
    assert scenario_result(snapshot(), Scenario(symbol="MSFT", dropPct=20)) is None
    for key, value in [("value", -1), ("value", float("nan")), ("type", "derivative")]:
        data = snapshot()
        data["holdings"][0][key] = value
        assert scenario_result(data, test) is None


def put_cache(key, value, fresh=True, provider="fmp"):
    db.put(f"CACHE#{provider}", key, {"value": value, "expiresAt": time.time() + (600 if fresh else -1), "fetchedAt": time.time()})


def test_evidence_filters_expired_and_wrong_symbol_news_and_retains_dates(aws):
    put_cache("research:v2:NVDA:profile", {"value": {"name": "NVIDIA"}, "fetchedAt": "2026-09-26"}, fresh=False)
    article = {"symbol": "NVDA", "title": "Example earnings headline", "url": "https://example.com/news", "publisher": "Example", "publishedAt": "2026-09-24"}
    put_cache("news:NVDA", {"articles": [article, {**article, "symbol": "AAPL"}, {**article, "url": "javascript:bad"}], "fetchedAt": "2026-09-26"}, provider="yahoo")
    sources = evidence(PageContext(page="markets", symbol="NVDA"), None)
    assert len(sources) == 1 and sources[0]["asOf"] == "2026-09-24"
    assert sources[0]["retrievedAt"] == "2026-09-26" and "full article was not retrieved" in sources[0]["text"]


def test_screen_range_uses_matching_fresh_history_snapshot(aws):
    put_cache("NVDA:5y", [["2021-09-26", 10], ["2026-09-26", 20]], provider="history")
    source = evidence(PageContext(page="markets", symbol="NVDA", range="5y"), None)[0]
    assert "100.00%" in source["text"] and "2021-09-26" in source["text"]
    assert evidence(PageContext(page="markets", symbol="NVDA", range="1y"), None) == []


def test_lesson_is_resolved_on_server_and_unknown_lessons_have_no_evidence(aws):
    source = evidence(PageContext(page="learn", lessonId="what-is-investing"), None)[0]
    assert source["kind"] == "lesson" and "investing" in source["label"].lower()
    assert evidence(PageContext(page="learn", lessonId="made-up"), None) == []


def test_context_rejects_client_facts_and_unknown_scope(aws):
    for context in [{"page": "markets", "symbol": "<script>"}, {"page": "markets", "portfolioValue": 1000000},
                    {"page": "admin"}, {"page": "advisor", "scenario": {"symbol": "NVDA", "dropPct": 20, "loss": 0}}]:
        assert call(handler, "POST", "/advisor/chat", {"message": "Explain this", "context": context})[0] == 400


def test_scenario_is_recomputed_from_callers_holdings_and_checked(aws, monkeypatch):
    seed()
    seen = {}
    monkeypatch.setattr(guardrails, "mask_input", lambda t: t)
    def converse(system, messages, **kw):
        seen["system"] = system
        return "A 20% fall in this position would reduce the portfolio by 1000.00. [1]"
    monkeypatch.setattr(bedrock, "converse", converse)
    monkeypatch.setattr(guardrails, "check_grounding", lambda *args: None)
    out = advisor.answer(USER, "Explain this scenario", grounded=True, context=PageContext(page="advisor", scenario=Scenario(symbol="NVDA", dropPct=20)))
    assert "loss 1000.00" in seen["system"] and "portfolio after 4000.00" in seen["system"]
    assert out["sources"][0]["kind"] == "scenario" and out["safety"]["grounding"] == "checked"
    assert "retire at 65" not in seen["system"]


def test_missing_company_sources_never_fall_back_to_unrelated_portfolio(aws, monkeypatch):
    seed()
    monkeypatch.setattr(guardrails, "mask_input", lambda t: t)
    monkeypatch.setattr(bedrock, "converse", lambda *a, **kw: pytest.fail("missing source"))
    out = advisor.answer(USER, "Explain MSFT", grounded=True, context=PageContext(page="advisor", symbol="MSFT"))
    assert out["safety"]["grounding"] == "unavailable"


def test_made_up_citation_is_withheld(aws, monkeypatch):
    seed()
    monkeypatch.setattr(guardrails, "mask_input", lambda t: t)
    monkeypatch.setattr(guardrails, "check_grounding", lambda *a: None)
    monkeypatch.setattr(bedrock, "converse", lambda *a, **kw: "NVDA is 100% of your portfolio. [99]")
    out = advisor.answer(USER, "Explain my portfolio", grounded=True)
    assert out["safety"]["grounding"] == "withheld" and not out["sources"]


def test_company_evidence_preserves_period_currency_and_missing_values(aws):
    put_cache("research:v2:NVDA:profile", {"value": {"name": "Example company", "description": "Builds computing products", "sector": "Technology"}, "fetchedAt": "2026-09-26"})
    put_cache("research:v2:NVDA:income", {"value": [{"year": "2025", "date": "2025-12-31", "currency": "USD", "revenue": 100000, "netIncome": None, "epsDiluted": 1.25}], "fetchedAt": "2026-09-26"})
    put_cache("research:v2:NVDA:valuation", {"value": {"pe": -10, "eps": -2, "ps": None}, "fetchedAt": "2026-09-26"})
    sources = evidence(PageContext(page="advisor", symbol="NVDA"), None)
    assert len(sources) == 3
    assert "Builds computing products" in sources[0]["text"]
    assert "FY 2025, period ended 2025-12-31, currency USD" in sources[1]["text"]
    assert "net profit None" in sources[1]["text"] and "unavailable, not zero" in sources[1]["text"]
    assert "nonpositive P/E is not a meaningful" in sources[2]["text"]
    assert sources[1]["asOf"] == "2026-09-26"


def test_this_company_uses_selection_without_implying_ownership(aws, monkeypatch):
    seed()  # Owns NVDA; researches a different company.
    monkeypatch.setattr(guardrails, "mask_input", lambda text: text)
    seen = {}

    def converse(system, messages, **kwargs):
        seen["system"] = system
        return "I need source facts to explain this company."

    monkeypatch.setattr(bedrock, "converse", converse)
    out = advisor.answer(USER, "Explain this company", context=PageContext(page="markets", symbol="MSFT", range="5y"))
    assert '"symbol":"MSFT"' in seen["system"]
    assert "question, validated screen identifiers or supplied sources" in seen["system"]
    assert "A selected company is not necessarily owned" in seen["system"]
    assert out["safety"]["grounding"] == "not_requested" and out["sources"] == []


def test_selected_price_uses_exact_date_and_never_substitutes_latest(aws):
    put_cache("NVDA:5y", [["2025-01-02", 10], ["2026-09-26", 20]], provider="history")
    selected = PageContext(page="markets", symbol="NVDA", range="5y", metric="price", priceDate="2025-01-02")
    source = evidence(selected, None)[0]
    assert source["asOf"] == "2025-01-02" and "10.0000" in source["text"]
    assert source["retrievedAt"] and "cannot explain why" in source["text"]
    assert evidence(selected.model_copy(update={"priceDate": "2025-01-03"}), None) == []
    put_cache("NVDA:5y", [["2025-01-02", 10]], fresh=False, provider="history")
    assert evidence(selected, None) == []


@pytest.mark.parametrize("changes", [{"priceDate": "2026-02-31"}, {"symbol": None}, {"range": None}, {"metric": "risk"}, {"scenario": {"symbol": "NVDA", "dropPct": 20}}])
def test_price_selection_requires_a_real_date_and_complete_scope(changes):
    context = {"page": "markets", "symbol": "NVDA", "range": "5y", "metric": "price", "priceDate": "2025-01-02", **changes}
    with pytest.raises(ValidationError):
        PageContext(**context)


def test_holding_selection_returns_only_matching_saved_positions(aws):
    sources = evidence(PageContext(page="portfolio", symbol="NVDA", metric="holding"), snapshot())
    assert len(sources) == 1 and sources[0]["kind"] == "portfolio"
    assert "NVDA" in sources[0]["text"] and "CASH" not in sources[0]["text"]
    assert evidence(PageContext(page="portfolio", symbol="MSFT", metric="holding"), snapshot()) == []
