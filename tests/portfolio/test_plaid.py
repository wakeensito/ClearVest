"""Contract tests for Plaid Link flow and normalized holdings."""

import json
from pathlib import Path

import responses
from clearvest import db
from clearvest.providers import plaid
from portfolio.app import handler

from tests.contract import assert_matches
from tests.helpers import USER, call

RAW = json.loads(Path("tests/fixtures/plaid_holdings.json").read_text())
BASE = "https://sandbox.plaid.com"


def test_normalize():
    out = plaid.normalize([RAW])
    assert out["totalValue"] == 5000.0
    assert [h["symbol"] for h in out["holdings"]] == ["VTI", "AAPL", "Cash Sweep"]
    assert out["holdings"][0] == {
        "symbol": "VTI", "name": "Vanguard Total Stock Market ETF", "type": "etf",
        "quantity": 10.0, "price": 300.0, "value": 3000.0, "weight": 0.6,
    }
    assert out["holdings"][2]["type"] == "cash"


@responses.activate
def test_link_token(aws):
    responses.post(f"{BASE}/link/token/create", json={"link_token": "link-sandbox-1"})
    assert call(handler, "POST", "/plaid/link-token") == (200, {"linkToken": "link-sandbox-1"})
    sent = json.loads(responses.calls[0].request.body)
    assert sent["client_id"] == "plaid-id" and sent["user"]["client_user_id"] == USER
    assert sent["products"] == ["investments"]


@responses.activate
def test_sandbox_link_then_holdings(aws):
    responses.post(f"{BASE}/sandbox/public_token/create", json={"public_token": "public-1"})
    responses.post(f"{BASE}/item/public_token/exchange", json={"item_id": "item-1", "access_token": "access-1"})
    responses.post(f"{BASE}/investments/holdings/get", json=RAW)

    assert call(handler, "POST", "/plaid/sandbox-link") == (200, {"itemId": "item-1"})
    stored = db.get(db.user_pk(USER), "PLAID#item-1")
    assert stored["accessToken"] == "access-1"

    status, body = call(handler, "GET", "/portfolio/holdings")
    assert status == 200 and body["totalValue"] == 5000.0
    assert "accessToken" not in json.dumps(body) and "access-1" not in json.dumps(body)
    assert_matches("/portfolio/holdings", "get", 200, body)

    # Second call inside an hour is served from the snapshot: no new Plaid call.
    call(handler, "GET", "/portfolio/holdings")
    assert len([c for c in responses.calls if c.request.url.endswith("/investments/holdings/get")]) == 1


@responses.activate
def test_link_refreshes_holdings_snapshot(aws):
    # A stale snapshot from before the new item must not survive the link.
    db.put(db.user_pk(USER), "HOLDINGS", {"asOf": "x", "totalValue": 1.0, "holdings": [], "fetchedAt": 9e12})
    responses.post(f"{BASE}/sandbox/public_token/create", json={"public_token": "public-1"})
    responses.post(f"{BASE}/item/public_token/exchange", json={"item_id": "item-1", "access_token": "access-1"})
    responses.post(f"{BASE}/investments/holdings/get", json=RAW)
    assert call(handler, "POST", "/plaid/sandbox-link") == (200, {"itemId": "item-1"})
    assert db.get(db.user_pk(USER), "HOLDINGS")["totalValue"] == 5000.0


@responses.activate
def test_link_succeeds_even_if_holdings_fetch_fails(aws):
    responses.post(f"{BASE}/sandbox/public_token/create", json={"public_token": "public-1"})
    responses.post(f"{BASE}/item/public_token/exchange", json={"item_id": "item-1", "access_token": "access-1"})
    responses.post(f"{BASE}/investments/holdings/get", status=500)
    assert call(handler, "POST", "/plaid/sandbox-link") == (200, {"itemId": "item-1"})
    assert db.get(db.user_pk(USER), "PLAID#item-1")["accessToken"] == "access-1"
    assert db.get(db.user_pk(USER), "HOLDINGS") is None


@responses.activate
def test_exchange_validates_body(aws):
    status, _ = call(handler, "POST", "/plaid/exchange", {})
    assert status == 400


def test_holdings_without_link_is_409(aws):
    status, body = call(handler, "GET", "/portfolio/holdings")
    assert status == 409 and body["error"]["code"] == "NOT_LINKED"


@responses.activate
def test_plaid_down_with_snapshot_serves_stale(aws, monkeypatch):
    db.put(db.user_pk(USER), "PLAID#item-1", {"itemId": "item-1", "accessToken": "access-1"})
    db.put(db.user_pk(USER), "HOLDINGS", {"asOf": "2026-09-26T00:00:00Z", "totalValue": 1.0, "holdings": [], "fetchedAt": 0})
    responses.post(f"{BASE}/investments/holdings/get", status=500)
    status, body = call(handler, "GET", "/portfolio/holdings")
    assert status == 200 and body["stale"] is True
