"""Tests for clearvest.db (single-table DynamoDB access) and clearvest.cache (stale-on-failure cache)."""

import pytest
from clearvest import cache, db
from clearvest.errors import UpstreamError


def test_put_get_query_delete(aws):
    pk = db.user_pk("u1")
    db.put(pk, "PROFILE", {"age": 30})
    assert db.get(pk, "PROFILE") == {"age": 30}
    assert db.get(pk, "MISSING") is None
    for i in range(3):
        db.put(pk, f"CHAT#{i}", {"n": i})
    assert [r["n"] for r in db.query(pk, "CHAT#")] == [0, 1, 2]
    assert [r["n"] for r in db.query(pk, "CHAT#", limit=2, newest_first=True)] == [2, 1]
    assert db.delete_prefix(pk, "CHAT#") == 3
    assert db.query(pk, "CHAT#") == []


def test_cache_fetches_then_serves_fresh(aws):
    calls = []
    fetch = lambda: calls.append(1) or {"v": 1}
    assert cache.get_or_fetch("p", "k", 60, fetch) == ({"v": 1}, False)
    assert cache.get_or_fetch("p", "k", 60, fetch) == ({"v": 1}, False)
    assert len(calls) == 1


def test_cache_serves_stale_when_provider_fails(aws, monkeypatch):
    cache.get_or_fetch("p", "k", 60, lambda: {"v": 1})
    monkeypatch.setattr(cache.time, "time", lambda: 10**12)  # far future: row expired

    def boom():
        raise UpstreamError("p", "down")

    assert cache.get_or_fetch("p", "k", 60, boom) == ({"v": 1}, True)


def test_cache_raises_when_no_row_and_provider_fails(aws):
    def boom():
        raise UpstreamError("p", "down")

    with pytest.raises(UpstreamError):
        cache.get_or_fetch("p", "nothing", 60, boom)


def test_oversized_value_is_returned_but_not_cached(aws):
    big = {"blob": "x" * (cache.MAX_ITEM_BYTES + 10)}
    assert cache.get_or_fetch("p", "big", 60, lambda: big) == (big, False)
    assert cache.peek("p", "big") is None


def test_peek_returns_value_even_if_expired(aws, monkeypatch):
    cache.get_or_fetch("p", "k", 60, lambda: [1, 2])
    monkeypatch.setattr(cache.time, "time", lambda: 10**12)
    assert cache.peek("p", "k") == [1, 2]
