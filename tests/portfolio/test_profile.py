"""Contract tests for GET/PUT /profile."""

from portfolio.app import handler

from tests.contract import assert_matches
from tests.helpers import call

PROFILE = {"age": 24, "horizon": "long", "goals": ["retire early"], "riskTolerance": "medium"}


def test_put_then_get(aws):
    assert call(handler, "PUT", "/profile", PROFILE) == (200, PROFILE)
    status, body = call(handler, "GET", "/profile")
    assert status == 200 and body == PROFILE
    assert_matches("/profile", "get", 200, body)


def test_get_without_profile_is_404(aws):
    status, body = call(handler, "GET", "/profile")
    assert status == 404 and body["error"]["code"] == "NOT_FOUND"


def test_invalid_profile_is_400(aws):
    status, body = call(handler, "PUT", "/profile", {**PROFILE, "age": 7})
    assert status == 400 and body["error"]["message"].startswith("age")
