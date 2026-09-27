import time
from datetime import UTC, datetime, timedelta

import pytest
import responses
from clearvest import advisor, db, exposure
from clearvest.errors import UpstreamError
from clearvest.providers import bedrock, guardrails
from clearvest.scout_context import PageContext
from market.app import handler as market_handler
from portfolio.app import handler as portfolio_handler

from tests.contract import assert_matches
from tests.helpers import USER, call


def row(fund="VTI", asset="AAPL", weight=10, **changes):
    return {
        "symbol": fund,
        "asset": asset,
        "weightPercentage": weight,
        "name": asset + " example company",
        "isin": "US0378331005" if asset == "AAPL" else "US5949181045",
        "updatedAt": datetime.now(UTC).isoformat(),
        **changes,
    }


def portfolio():
    return {
        "asOf": "2026-09-27",
        "totalValue": 10000,
        "holdings": [
            {
                "symbol": "VTI",
                "name": "Fund A",
                "type": "etf",
                "value": 4000,
                "weight": 0.4,
            },
            {
                "symbol": "VOO",
                "name": "Fund B",
                "type": "etf",
                "value": 3000,
                "weight": 0.3,
            },
            {
                "symbol": "AAPL",
                "name": "Apple",
                "type": "equity",
                "value": 1000,
                "weight": 0.1,
            },
            {
                "symbol": "CASH",
                "name": "Cash",
                "type": "cash",
                "value": 2000,
                "weight": 0.2,
            },
        ],
    }


def cache_fund(symbol, rows, expired=False):
    data = exposure.normalize_fund(symbol, rows)
    db.put(
        "CACHE#fmp",
        exposure.CACHE_PREFIX + symbol,
        {"value": data, "expiresAt": time.time() + (-1 if expired else 86400)},
    )
    return data


def test_overlap_direct_plus_two_funds_without_renormalizing_partial_lists(aws):
    cache_fund("VTI", [row(weight=10), row(asset="MSFT", weight=20)])
    cache_fund("VOO", [row("VOO", weight=5), row("VOO", asset="MSFT", weight=30)])
    result = exposure.analyze(portfolio())
    apple = next(r for r in result["exposures"] if r["symbol"] == "AAPL")
    assert (
        apple["value"] == 1550
        and apple["weightPct"] == 15.5
        and apple["directValue"] == 1000
    )
    assert [p["value"] for p in apple["paths"]] == [1000, 400, 150]
    assert (
        result["mappedPct"] == 52.5
        and result["unmappedValue"] == 4750
        and result["cashValue"] == 2000
    )
    assert result["overlapCount"] == 2 and result["funds"][0]["coveragePct"] == 30


def test_duplicates_in_account_are_aggregated_not_counted_as_fund_overlap(aws):
    data = portfolio()
    data["holdings"] = [
        {"symbol": "AAPL", "name": "Apple", "type": "equity", "value": 5000}
    ] * 2
    result = exposure.analyze(data)
    assert result["mappedPct"] == 100 and result["overlapCount"] == 0
    assert result["exposures"][0]["value"] == 10000


@pytest.mark.parametrize(
    "change",
    [
        {"weightPercentage": -2},
        {"weightPercentage": 101},
        {"symbol": "WRONG"},
        {"weightPercentage": True},
        {"weightPercentage": float("nan")},
        {"updatedAt": "invalid"},
        {"updatedAt": "2099-01-01"},
    ],
)
def test_unverifiable_sources_are_rejected(change):
    with pytest.raises(UpstreamError):
        exposure.normalize_fund("VTI", [row(**change)])


def test_duplicate_or_excess_weight_is_rejected():
    for rows in [[row(), row()], [row(weight=60), row(asset="MSFT", weight=50)]]:
        with pytest.raises(UpstreamError):
            exposure.normalize_fund("VTI", rows)


def test_mixed_dates_and_unidentified_rows_remain_unmapped():
    earlier = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    data = exposure.normalize_fund(
        "VTI",
        [
            row(weight=10),
            row(asset="MSFT", weight=20, updatedAt=earlier),
            row(asset="", weight=30),
        ],
    )
    assert data["coveragePct"] == 10 and len(data["holdings"]) == 1


def test_expired_and_old_holdings_are_excluded_without_losing_direct_exposure(aws):
    cache_fund("VTI", [row()], expired=True)
    cache_fund(
        "VOO",
        [row("VOO", updatedAt=(datetime.now(UTC) - timedelta(days=40)).isoformat())],
    )
    result = exposure.analyze(portfolio())
    assert result["mappedPct"] == 30 and result["unmappedValue"] == 7000
    assert result["overlapCount"] == 0 and all(
        s["status"] == "outdated" for s in result["funds"]
    )


def test_conflicting_identifiers_and_known_nested_funds_are_not_merged(aws):
    cache_fund("VTI", [row(), row(asset="VOO", weight=20)])
    cache_fund("VOO", [row("VOO", isin="US0000000001")])
    result = exposure.analyze(portfolio())
    assert result["mappedPct"] == 30 and result["overlapCount"] == 0


@pytest.mark.parametrize(
    "kind,value", [("derivative", 1000), ("equity", -1000), ("equity", float("inf"))]
)
def test_unsupported_portfolios_do_not_produce_exposure(aws, kind, value):
    data = portfolio()
    data["holdings"][2].update(type=kind, value=value)
    assert exposure.analyze(data)["status"] == "unsupported"


@responses.activate
def test_source_route_contract_cache_and_upstream_endpoint(aws):
    responses.get("https://financialmodelingprep.com/stable/etf/holdings", json=[row()])
    status, body = call(
        market_handler, "GET", "/market/fund-holdings", query={"symbol": "vti"}
    )
    assert status == 200 and body["coveragePct"] == 10
    assert_matches("/market/fund-holdings", "get", 200, body)
    assert (
        call(market_handler, "GET", "/market/fund-holdings", query={"symbol": "VTI"})[1]
        == body
    )
    assert (
        len(responses.calls) == 1
        and responses.calls[0].request.params["symbol"] == "VTI"
    )
    assert (
        call(
            market_handler, "GET", "/market/fund-holdings", query={"symbol": "VTI,VOO"}
        )[0]
        == 400
    )


def test_private_exposure_reads_only_callers_snapshot(aws):
    cache_fund("VTI", [row()])
    db.put(db.user_pk(USER), "HOLDINGS", portfolio())
    status, body = call(portfolio_handler, "GET", "/portfolio/exposure")
    assert status == 200 and body["exposures"][0]["value"] == 1400
    assert_matches("/portfolio/exposure", "get", 200, body)
    assert (
        call(
            portfolio_handler,
            "GET",
            "/portfolio/exposure",
            user="00000000-0000-4000-8000-000000000000",
        )[0]
        == 409
    )


def test_scout_exposure_uses_recalculated_sources_not_client_figures(aws, monkeypatch):
    db.put(db.user_pk(USER), "HOLDINGS", portfolio())
    cache_fund("VTI", [row()])
    monkeypatch.setattr(guardrails, "mask_input", lambda text: text)
    monkeypatch.setattr(guardrails, "check_grounding", lambda *a: None)
    seen = {}

    def converse(prompt, *args, **kwargs):
        seen["prompt"] = prompt
        return (
            "Your mapped AAPL exposure is 14%, including direct and VTI holdings. [1]"
        )

    monkeypatch.setattr(bedrock, "converse", converse)
    result = advisor.answer(
        USER,
        "Explain my Apple exposure",
        grounded=True,
        context=PageContext(page="advisor", metric="exposure", symbol="AAPL"),
    )
    assert "14.0000%" in seen["prompt"] and "unknown, not zero" in seen["prompt"]
    assert (
        result["sources"][0]["kind"] == "exposure"
        and result["safety"]["grounding"] == "checked"
    )


def test_large_unicode_sources_stay_under_dynamodb_limit():
    import json

    rows = [row(asset=f"X{i}", weight=0.05, name="例" * 160) for i in range(1100)]
    result = exposure.normalize_fund("VTI", rows)
    assert len(json.dumps(result).encode("utf-8")) < 310_000
    assert 0 < len(result["holdings"]) < 1000
    assert result["coveragePct"] == pytest.approx(len(result["holdings"]) * 0.05)


def test_zero_balance_fund_does_not_add_false_overlap(aws):
    cache_fund("VTI", [row()])
    data = portfolio()
    data["holdings"][0]["value"] = 0
    data["totalValue"] = 6000
    result = exposure.analyze(data)
    assert result["overlapCount"] == 0
    assert all(f["symbol"] != "VTI" for f in result["funds"])


def test_missing_exposure_does_not_fall_back_to_general_portfolio(aws, monkeypatch):
    db.put(db.user_pk(USER), "HOLDINGS", portfolio())
    monkeypatch.setattr(guardrails, "mask_input", lambda text: text)
    monkeypatch.setattr(
        bedrock,
        "converse",
        lambda *a, **kw: pytest.fail("Missing source must not invoke a model"),
    )
    result = advisor.answer(
        USER,
        "Explain my Microsoft exposure",
        grounded=True,
        context=PageContext(page="advisor", metric="exposure", symbol="MSFT"),
    )
    assert result["safety"]["grounding"] == "unavailable"
    assert "unknown, not zero" in result["reply"]
