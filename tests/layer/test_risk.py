"""Unit tests for the deterministic portfolio risk score in clearvest.risk."""

import pytest
from clearvest.risk import score


def h(type_, weight, symbol="X"):
    return {"symbol": symbol, "type": type_, "value": weight * 1000, "weight": weight}


@pytest.mark.parametrize(
    "holdings, expected_label",
    [
        ([h("cash", 1.0)], "Conservative"),
        ([h("etf", 0.6), h("fixed income", 0.4)], "Conservative"),
        ([h("etf", 1.0)], "Moderate"),
        ([h("equity", 1.0, "NVDA")], "Aggressive"),
        ([h("cryptocurrency", 0.7, "BTC"), h("etf", 0.3)], "Aggressive"),
    ],
)
def test_labels_without_profile(holdings, expected_label):
    assert score(holdings, None)["label"] == expected_label


def test_single_stock_is_max_concentration():
    out = score([h("equity", 1.0, "NVDA")], None)
    assert out["score"] == 86  # 0.7*80 + 0.3*100
    assert any(f["name"] == "Concentration" and "NVDA" in f["detail"] for f in out["factors"])


def test_profile_shifts_score():
    base = score([h("etf", 1.0)], None)["score"]
    near_retirement = score([h("etf", 1.0)], {"age": 63, "horizon": "short"})["score"]
    young = score([h("etf", 1.0)], {"age": 22, "horizon": "long"})["score"]
    assert near_retirement == base + 20 and young == base - 10


def test_empty_portfolio():
    out = score([], None)
    assert out["score"] == 0 and out["factors"][0]["name"] == "No invested assets"


def test_score_is_clamped():
    assert score([h("derivative", 1.0)], {"age": 70, "horizon": "short"})["score"] == 100


def test_unknown_type_counts_as_other():
    assert score([h("warrant", 1.0)], None)["score"] == score([h("other", 1.0)], None)["score"]
