"""The full API -> DynamoDB reservation -> SQS -> worker -> snapshot flow, offline."""

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor

import pytest
from botocore.exceptions import EndpointConnectionError
from clearvest import aws as clients
from clearvest import cache, db
from clearvest.errors import UpstreamError
from market.app import handler

from market import history_refresh as refresh
from market import refresh_worker as worker
from tests.contract import assert_matches
from tests.helpers import call, ctx
from tests.market.test_history import SERIES


def history(symbols="VOO"):
    return call(handler, "GET", "/market/history", query={"symbols": symbols, "range": "1y"})


def records():
    messages = clients.sqs().receive_message(
        QueueUrl=os.environ["MARKET_REFRESH_QUEUE_URL"], MaxNumberOfMessages=10,
        MessageSystemAttributeNames=["ApproximateReceiveCount"],
    ).get("Messages", [])
    return [{"messageId": m["MessageId"], "body": m["Body"], "attributes": m["Attributes"]} for m in messages]


def run(items):
    return worker.handler({"Records": items}, ctx())["batchItemFailures"]


def test_cold_request_queues_once_and_worker_populates_history(aws, monkeypatch):
    calls = []
    monkeypatch.setattr(worker, "_fetch", lambda symbol, years: calls.append(symbol) or SERIES)
    status, body = history()
    assert status == 202 and body["series"] == [] and body["refreshing"]
    assert_matches("/market/history", "get", 202, body)
    assert calls == []  # no providers on HTTP path
    assert history()[0] == 202
    queued = records()
    assert len(queued) == 1
    assert run(queued) == []
    status, body = history()
    assert status == 200 and body["refreshing"] is False and body["stale"] is False
    assert body["series"][0]["points"][0]["close"] == 100
    assert body["refresh"][0]["fetchedAt"]
    assert_matches("/market/history", "get", 200, body)
    assert run(queued) == []  # duplicate SQS delivery is a no-op
    assert calls == ["VOO"]


def test_stale_snapshot_is_immediate_and_survives_failed_attempt(aws, monkeypatch):
    cache._put("history", "VOO:1y", SERIES, 86400, time.time() - 86401)
    status, body = history()
    assert status == 200 and body["stale"] and body["refreshing"]
    assert body["series"][0]["symbol"] == "VOO"
    def fail(*args):
        raise UpstreamError("test", "offline")
    monkeypatch.setattr(worker, "_fetch", fail)
    queued = records()
    assert run(queued) == [{"itemIdentifier": queued[0]["messageId"]}]
    assert refresh.snapshot("VOO", "1y")["value"][0][1] == 100
    assert refresh.job("VOO", "1y")["state"] == "pending"
    monkeypatch.setattr(worker, "_fetch", lambda *args: SERIES)
    assert run(queued) == []
    assert history()[1]["stale"] is False


def test_concurrent_requests_share_one_reservation(aws):
    # Initialize clients before the threads; boto3 Session creation isn't thread-safe.
    clients.table()
    clients.sqs()
    with ThreadPoolExecutor(max_workers=8) as pool:
        jobs = list(pool.map(lambda _: refresh.request_refresh("VOO", "1y"), range(8)))
    assert len({j["jobId"] for j in jobs}) == 1
    assert len(records()) == 1


def test_failed_submission_has_cooldown_and_preserves_old_snapshot(aws, monkeypatch):
    def fail(**kwargs):
        raise EndpointConnectionError(endpoint_url="https://sqs.example.test")
    monkeypatch.setattr(clients.sqs(), "send_message", fail)
    assert history()[0] == 502
    assert refresh.job("VOO", "1y")["state"] == "failed"
    cache._put("history", "VOO:1y", SERIES, 86400, time.time() - 86401)
    status, body = history()
    assert status == 200 and body["stale"] and not body["refreshing"]
    assert body["refresh"][0]["status"] == "failed"


def test_mixed_cached_and_pending_symbols_are_not_dropped(aws):
    cache._put("history", "VOO:1y", SERIES, 86400, time.time())
    status, body = history("VOO,QQQ")
    assert status == 202
    assert [s["symbol"] for s in body["series"]] == ["VOO"]
    assert [r["status"] for r in body["refresh"]] == ["ready", "pending"]
    assert_matches("/market/history", "get", 202, body)


def test_expired_stale_retention_is_enforced_without_ttl_deletion(aws):
    cache._put("history", "VOO:1y", SERIES, 86400, time.time() - 9 * 86400)
    assert db.get("CACHE#history", "VOO:1y")  # row still physically exists
    assert history()[0] == 202


def test_live_execution_lease_blocks_duplicate_then_recovers_after_crash(aws, monkeypatch):
    history()
    queued = records()
    clients.table().update_item(
        Key=refresh.job_key("VOO", "1y"), UpdateExpression="SET workUntil = :until, workOwner = :owner",
        ExpressionAttributeValues={":until": int(time.time()) + 90, ":owner": "other"},
    )
    calls = []
    monkeypatch.setattr(worker, "_fetch", lambda *args: calls.append(True) or SERIES)
    assert run(queued) and not calls
    clients.table().update_item(
        Key=refresh.job_key("VOO", "1y"), UpdateExpression="SET workUntil = :until",
        ExpressionAttributeValues={":until": int(time.time()) - 1},
    )
    assert run(queued) == [] and calls == [True]


def test_old_worker_cannot_publish_over_replacement_job(aws, monkeypatch):
    history()
    queued = records()
    def replace_during_fetch(*args):
        clients.table().update_item(
            Key=refresh.job_key("VOO", "1y"), UpdateExpression="SET leaseUntil = :expired",
            ExpressionAttributeValues={":expired": 0},
        )
        refresh.request_refresh("VOO", "1y")
        return SERIES
    monkeypatch.setattr(worker, "_fetch", replace_during_fetch)
    assert run(queued)
    assert refresh.snapshot("VOO", "1y") is None
    assert refresh.job("VOO", "1y")["jobId"] != json.loads(queued[0]["body"])["jobId"]
    assert run(queued) == []  # obsolete delivery acknowledged without touching new job


def test_final_failure_is_reported_for_dlq_and_blocks_poll_reenqueue(aws, monkeypatch):
    history()
    queued = records()
    queued[0]["attributes"]["ApproximateReceiveCount"] = "5"
    def fail(*args):
        raise UpstreamError("test", "offline")
    monkeypatch.setattr(worker, "_fetch", fail)
    assert run(queued)
    assert refresh.job("VOO", "1y")["state"] == "failed"
    assert history()[0] == 502
    assert records() == []


def test_partial_failure_does_not_retry_completed_messages(aws, monkeypatch):
    history("VOO,QQQ")
    queued = records()
    def fetch(symbol, years):
        if symbol == "QQQ":
            raise UpstreamError("test", "offline")
        return SERIES
    monkeypatch.setattr(worker, "_fetch", fetch)
    failed_id = next(r["messageId"] for r in queued if json.loads(r["body"])["symbol"] == "QQQ")
    assert run(queued) == [{"itemIdentifier": failed_id}]
    assert refresh.snapshot("VOO", "1y") is not None


@pytest.mark.parametrize("body", ['not json', '{}', '{"symbol":"../","range":"1y","jobId":"bad"}'])
def test_malformed_jobs_fail_without_provider_calls(aws, monkeypatch, body):
    monkeypatch.setattr(worker, "_fetch", lambda *args: pytest.fail("Unexpected provider call"))
    assert run([{"messageId": "bad", "body": body}]) == [{"itemIdentifier": "bad"}]


def test_abandoned_submission_reservation_expires_without_waiting_for_ttl(aws):
    # Simulate a producer crash after its conditional PutItem, before SendMessage.
    clients.table().put_item(Item={
        **refresh.job_key("VOO", "1y"), "jobId": "abandoned", "state": "pending",
        "requestedAt": int(time.time()) - 31, "leaseUntil": int(time.time()) - 1,
        "ttl": int(time.time()) + 86400,
    })
    assert history()[0] == 202
    assert len(records()) == 1
    assert refresh.job("VOO", "1y")["jobId"] != "abandoned"


def test_ambiguous_send_does_not_mark_completed_worker_failed(aws, monkeypatch):
    send = clients.sqs().send_message
    monkeypatch.setattr(worker, "_fetch", lambda *args: SERIES)
    def delivered_but_connection_failed(**kwargs):
        send(**kwargs)
        assert run(records()) == []
        raise EndpointConnectionError(endpoint_url="https://sqs.example.test")
    monkeypatch.setattr(clients.sqs(), "send_message", delivered_but_connection_failed)
    history()
    assert refresh.job("VOO", "1y")["state"] == "complete"
    assert history()[0] == 200


def test_failed_refresh_can_be_requeued_after_cooldown(aws, monkeypatch):
    send = clients.sqs().send_message
    def fail(**kwargs):
        raise EndpointConnectionError(endpoint_url="https://sqs.example.test")
    monkeypatch.setattr(clients.sqs(), "send_message", fail)
    assert history()[0] == 502
    old = refresh.job("VOO", "1y")["jobId"]
    clients.table().update_item(
        Key=refresh.job_key("VOO", "1y"), UpdateExpression="SET leaseUntil = :until",
        ExpressionAttributeValues={":until": int(time.time()) - 1},
    )
    monkeypatch.setattr(clients.sqs(), "send_message", send)
    assert history()[0] == 202
    assert refresh.job("VOO", "1y")["jobId"] != old
    assert len(records()) == 1
