from advisor.app import handler
from clearvest import db
from clearvest.errors import UpstreamError
from clearvest.providers import bedrock

from tests.contract import assert_matches
from tests.helpers import USER, call


def test_chat(aws, monkeypatch):
    monkeypatch.setattr(bedrock, "converse", lambda s, m, max_tokens=600: "Consider a Roth IRA.")
    status, body = call(handler, "POST", "/advisor/chat", {"message": "I'm 24, what account?"})
    assert status == 200 and body["reply"] == "Consider a Roth IRA."
    assert_matches("/advisor/chat", "post", 200, body)


def test_chat_validates_message(aws):
    assert call(handler, "POST", "/advisor/chat", {"message": ""})[0] == 400
    assert call(handler, "POST", "/advisor/chat", {"message": "x" * 2001})[0] == 400


def test_delete_history(aws, monkeypatch):
    monkeypatch.setattr(bedrock, "converse", lambda s, m, max_tokens=600: "ok")
    call(handler, "POST", "/advisor/chat", {"message": "hi"})
    status, _ = call(handler, "DELETE", "/advisor/history")
    assert status == 204 and db.query(db.user_pk(USER), "CHAT#") == []


def test_retirement_accounts_static_facts_and_fallback(aws, monkeypatch):
    def boom(*_a, **_k):
        raise UpstreamError("bedrock", "down")

    monkeypatch.setattr(bedrock, "converse", boom)
    db.put(db.user_pk(USER), "PROFILE", {"age": 24, "horizon": "long", "goals": [], "riskTolerance": "medium"})
    status, body = call(handler, "GET", "/advisor/retirement-accounts")
    assert status == 200
    assert {a["id"] for a in body["accounts"]} == {"traditional-401k", "roth-401k", "roth-ira", "tsp"}
    assert "Roth" in body["personalized"]  # rule-based fallback for a 24-year-old
    assert_matches("/advisor/retirement-accounts", "get", 200, body)


def test_retirement_without_profile(aws):
    body = call(handler, "GET", "/advisor/retirement-accounts")[1]
    assert "profile" in body["personalized"].lower()
