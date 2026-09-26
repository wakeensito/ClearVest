"""Tests for GET /market/templates: bundled portfolio templates."""

from market.app import handler

from tests.contract import assert_matches
from tests.helpers import call


def test_templates_are_sourced_and_sum_to_one(aws):
    status, body = call(handler, "GET", "/market/templates")
    assert status == 200 and len(body) >= 5
    for t in body:
        assert t["source"].startswith("http")
        assert abs(sum(a["weight"] for a in t["allocations"]) - 1.0) < 1e-6
    assert_matches("/market/templates", "get", 200, body)
