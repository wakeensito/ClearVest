"""Tests for clearvest.db (single-table DynamoDB access) and clearvest.cache (stale-on-failure cache)."""

import time

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


def test_delete_prefix_paginates_all_items(aws, monkeypatch):
    from clearvest import aws as aws_mod

    pk = db.user_pk("u2")
    pages = [
        {"Items": [{"pk": pk, "sk": "CHAT#0"}], "LastEvaluatedKey": {"pk": pk, "sk": "CHAT#0"}},
        {"Items": [{"pk": pk, "sk": "CHAT#1"}]},
    ]
    calls = []
    deleted = []

    def fake_query(**kwargs):
        calls.append(kwargs)
        return pages.pop(0)

    class FakeBatch:
        def __enter__(self):
            return self

        def __exit__(self, *_a):
            return False

        def delete_item(self, Key):
            deleted.append(Key)

    table = aws_mod.table()
    monkeypatch.setattr(table, "query", fake_query)
    monkeypatch.setattr(table, "batch_writer", lambda: FakeBatch())

    assert db.delete_prefix(pk, "CHAT#") == 2
    assert deleted == [{"pk": pk, "sk": "CHAT#0"}, {"pk": pk, "sk": "CHAT#1"}]
    assert len(calls) == 2 and calls[1]["ExclusiveStartKey"] == {"pk": pk, "sk": "CHAT#0"}
    assert "ExclusiveStartKey" not in calls[0]


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


def test_ttl_for_overrides_ttl_seconds_for_the_cached_row(aws):
    cache.get_or_fetch("p", "k", 60, lambda: {"v": 1}, ttl_for=lambda value: 5)
    row = db.get("CACHE#p", "k")
    assert row["expiresAt"] - time.time() <= 5 + 1

    # Without ttl_for, the plain ttl_seconds is used, same as before this param existed.
    cache.get_or_fetch("p", "k2", 60, lambda: {"v": 2})
    row2 = db.get("CACHE#p", "k2")
    assert row2["expiresAt"] - time.time() > 30


def test_oversized_value_is_returned_but_not_cached(aws):
    big = {"blob": "x" * (cache.MAX_ITEM_BYTES + 10)}
    assert cache.get_or_fetch("p", "big", 60, lambda: big) == (big, False)
    assert cache.peek("p", "big") is None


def test_peek_returns_value_even_if_expired(aws, monkeypatch):
    cache.get_or_fetch("p", "k", 60, lambda: [1, 2])
    monkeypatch.setattr(cache.time, "time", lambda: 10**12)
    assert cache.peek("p", "k") == [1, 2]


def test_query_without_limit_reads_every_page(aws, monkeypatch):
    """limit=None follows LastEvaluatedKey; DynamoDB applies Limit per page, so a cap truncates silently."""
    import json as _json

    from clearvest import aws as aws_mod

    pages = [
        {"Items": [{"data": _json.dumps({"n": 1})}], "LastEvaluatedKey": {"pk": "p", "sk": "a"}},
        {"Items": [{"data": _json.dumps({"n": 2})}], "LastEvaluatedKey": {}},  # empty key = last page
    ]
    calls = []

    class FakeTable:
        def query(self, **kwargs):
            calls.append(kwargs)
            return pages[len(calls) - 1]

    monkeypatch.setattr(aws_mod, "table", lambda: FakeTable())
    assert [r["n"] for r in db.query("p", "X#", limit=None)] == [1, 2]
    assert "Limit" not in calls[0] and calls[1]["ExclusiveStartKey"] == {"pk": "p", "sk": "a"}
