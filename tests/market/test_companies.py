"""Tests for GET /market/compare-companies: FMP ratios plus EDGAR/FMP revenue growth."""

import responses
from market.app import handler
from market.providers import edgar, fmp

from tests.contract import assert_matches
from tests.helpers import call

RATIOS = {"priceToEarningsRatioTTM": 95.1, "priceToSalesRatioTTM": 11.2, "grossProfitMarginTTM": 0.532,
          "netIncomePerShareTTM": 1.9, "freeCashFlowPerShareTTM": 4.1, "debtToEquityRatioTTM": 0.06}


def test_compare_uses_ratios_and_edgar_growth(aws, monkeypatch):
    monkeypatch.setattr(fmp, "ratios_ttm", lambda s: RATIOS)
    monkeypatch.setattr(edgar, "revenue_growth", lambda s: 0.343)
    monkeypatch.setattr(fmp, "revenue_growth", lambda s: 0.99)
    status, body = call(handler, "GET", "/market/compare-companies", query={"symbols": "AMD,NVDA"})
    assert status == 200 and body["companies"][0] == {
        "symbol": "AMD", "pe": 95.1, "ps": 11.2, "grossMargin": 0.532, "revenueGrowth": 0.343,
        "epsTTM": 1.9, "fcfPerShare": 4.1, "debtToEquity": 0.06,
    }
    assert "ratios" in body["notes"].lower()
    assert_matches("/market/compare-companies", "get", 200, body)


def test_growth_falls_back_to_fmp(aws, monkeypatch):
    monkeypatch.setattr(fmp, "ratios_ttm", lambda s: RATIOS)
    monkeypatch.setattr(edgar, "revenue_growth", lambda s: None)
    monkeypatch.setattr(fmp, "revenue_growth", lambda s: 0.2)
    body = call(handler, "GET", "/market/compare-companies", query={"symbols": "AMD,NVDA"})[1]
    assert body["companies"][1]["revenueGrowth"] == 0.2


def test_needs_two_to_four_symbols(aws):
    assert call(handler, "GET", "/market/compare-companies", query={"symbols": "AMD"})[0] == 400


def test_edgar_latest_annual_rule():
    # Apple-style tag switch + restatement: latest period end wins, then latest filing.
    facts = {
        "Revenues": {"units": {"USD": [
            {"start": "2017-10-01", "end": "2018-09-29", "val": 265, "form": "10-K", "fp": "FY", "filed": "2018-11-05"},
        ]}},
        "RevenueFromContractWithCustomerExcludingAssessedTax": {"units": {"USD": [
            {"start": "2023-10-01", "end": "2024-09-28", "val": 391, "form": "10-K", "fp": "FY", "filed": "2024-11-01"},
            {"start": "2024-09-29", "end": "2025-09-27", "val": 416, "form": "10-K", "fp": "FY", "filed": "2025-10-31"},
            {"start": "2023-10-01", "end": "2024-09-28", "val": 390, "form": "10-K", "fp": "FY", "filed": "2025-10-31"},
            {"start": "2025-06-29", "end": "2025-09-27", "val": 102, "form": "10-Q", "fp": "Q4", "filed": "2025-10-31"},
        ]}},
    }
    assert edgar.annual_revenues(facts)[-2:] == [("2024-09-28", 390), ("2025-09-27", 416)]


@responses.activate
def test_edgar_revenue_growth_end_to_end(aws):
    responses.get("https://www.sec.gov/files/company_tickers.json",
                  json={"0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."}})
    responses.get("https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json", json={"facts": {"us-gaap": {
        "Revenues": {"units": {"USD": [
            {"start": "2023-10-01", "end": "2024-09-28", "val": 400, "form": "10-K", "fp": "FY", "filed": "2024-11-01"},
            {"start": "2024-09-29", "end": "2025-09-27", "val": 440, "form": "10-K", "fp": "FY", "filed": "2025-10-31"},
        ]}}}}})
    assert round(edgar.revenue_growth("AAPL"), 4) == 0.1
    assert responses.calls[0].request.headers["User-Agent"] == "ClearVest test@example.com"
