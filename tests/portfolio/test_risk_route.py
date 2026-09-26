"""Contract tests for GET /portfolio/risk."""

from clearvest import db
from portfolio.app import handler

from tests.contract import assert_matches
from tests.helpers import USER, call


def test_risk_requires_link(aws):
    assert call(handler, "GET", "/portfolio/risk")[0] == 409


def test_risk_from_snapshot(aws):
    import time

    pk = db.user_pk(USER)
    db.put(pk, "PLAID#i", {"itemId": "i", "accessToken": "a"})
    db.put(pk, "HOLDINGS", {"asOf": "2026-09-26T00:00:00+00:00", "totalValue": 1000.0, "fetchedAt": time.time(),
                            "holdings": [{"symbol": "VTI", "name": "VTI", "type": "etf", "quantity": 1.0,
                                          "price": 1000.0, "value": 1000.0, "weight": 1.0}]})
    db.put(pk, "PROFILE", {"age": 63, "horizon": "short", "goals": [], "riskTolerance": "low"})
    status, body = call(handler, "GET", "/portfolio/risk")
    assert status == 200 and body["score"] == 62
    assert_matches("/portfolio/risk", "get", 200, body)
