"""Health endpoint needs no X-User-Id and reports a version string."""

from portfolio.app import handler

from tests.helpers import call


def test_health_needs_no_user_id():
    assert call(handler, "GET", "/health", user=None) == (200, {"status": "ok", "version": "test"})
