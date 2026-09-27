"""SQS consumer for price-history refreshes (batch size one in SAM)."""

import json
import time
import uuid

from botocore.exceptions import ClientError
from clearvest import aws, cache
from clearvest.api import logger

from market import history_refresh as refresh
from market.routes.history import SYMBOL, YEARS, _fetch


def process(record: dict) -> None:
    payload = json.loads(record["body"])
    symbol, rng, job_id = payload["symbol"], payload["range"], payload["jobId"]
    if not isinstance(symbol, str) or not SYMBOL.fullmatch(symbol) or rng not in YEARS:
        raise ValueError("Invalid history refresh job")
    if str(uuid.UUID(job_id)) != job_id:
        raise ValueError("Invalid refresh identifier")
    current = refresh.job(symbol, rng)
    if not current or current["jobId"] != job_id or current["state"] == "complete":
        return  # duplicate completion or an obsolete reservation
    if current["state"] == "failed":
        raise RuntimeError("Refresh exhausted or submission failed")
    now = int(time.time())
    if current["leaseUntil"] <= now:
        return  # expired queue message; only a new reservation may do work
    owner = str(uuid.uuid4())
    values = {":id": job_id, ":now": now, ":until": now + refresh.WORK_SECONDS, ":owner": owner, ":pending": "pending",
              ":jobUntil": now + refresh.JOB_SECONDS}
    try:
        aws.table().update_item(
            Key=refresh.job_key(symbol, rng),
            UpdateExpression="SET workUntil = :until, workOwner = :owner, leaseUntil = :jobUntil",
            ConditionExpression="jobId = :id AND leaseUntil > :now AND "
                                "#state = :pending AND (attribute_not_exists(workUntil) OR workUntil <= :now)",
            ExpressionAttributeNames={"#state": "state"},
            ExpressionAttributeValues=values,
        )
    except ClientError as err:
        if refresh.conditional_failure(err):
            # Another delivery is working, or the lease was replaced. Retry;
            # acknowledging a live duplicate could lose work after a crash.
            raise RuntimeError("Refresh already running or superseded") from err
        raise
    try:
        row = refresh.snapshot(symbol, rng)
        if row and row["expiresAt"] > time.time():
            points = row["value"]
            fetched_at = row["fetchedAt"]
        else:
            points = _fetch(symbol, YEARS[rng])
            fetched_at = time.time()
        data = {"value": points, "fetchedAt": fetched_at, "expiresAt": fetched_at + refresh.CACHE_SECONDS}
        encoded = json.dumps(data)
        if len(encoded.encode("utf-8")) > cache.MAX_ITEM_BYTES:
            raise ValueError("History snapshot exceeds cache item budget")
        # Cache publication and completion are atomic and fenced by both job and
        # execution tokens. A delayed/expired worker cannot overwrite newer data.
        table = aws.table()
        table.meta.client.transact_write_items(TransactItems=[
            {"Put": {"TableName": table.name, "Item": {
                "pk": "CACHE#history", "sk": f"{symbol}:{rng}", "data": encoded,
                "ttl": int(data["expiresAt"] + refresh.STALE_SECONDS),
            }}},
            {"Update": {
                "TableName": table.name, "Key": refresh.job_key(symbol, rng),
                "UpdateExpression": "SET #state = :done REMOVE workUntil, workOwner",
                "ConditionExpression": "jobId = :id AND workOwner = :owner AND workUntil > :now AND #state = :pending",
                "ExpressionAttributeNames": {"#state": "state"},
                "ExpressionAttributeValues": {
                    ":done": "complete", ":id": job_id, ":owner": owner, ":now": int(time.time()),
                    ":pending": "pending",
                },
            }},
        ])
        logger.info("history refresh completed", extra={"symbol": symbol, "range": rng, "jobId": job_id})
    except Exception:
        last_attempt = int(record.get("attributes", {}).get("ApproximateReceiveCount", "1")) >= refresh.MAX_RECEIVES
        updates = "REMOVE workUntil, workOwner"
        attrs = {":id": job_id, ":owner": owner}
        names = {}
        if last_attempt:
            updates = "SET #state = :failed, leaseUntil = :until " + updates
            attrs.update({":failed": "failed", ":until": int(time.time()) + refresh.FAILURE_COOLDOWN})
            names = {"ExpressionAttributeNames": {"#state": "state"}}
        try:
            aws.table().update_item(
                Key=refresh.job_key(symbol, rng), UpdateExpression=updates,
                ConditionExpression="jobId = :id AND workOwner = :owner",
                ExpressionAttributeValues=attrs, **names,
            )
        except ClientError as err:
            if not refresh.conditional_failure(err):
                raise
        raise


@logger.inject_lambda_context(clear_state=True)
def handler(event, context):
    failures = []
    for record in event["Records"]:
        try:
            process(record)
        except Exception as err:  # noqa: BLE001 - isolate each SQS failure without logging secrets
            # Provider exception strings may contain credentials. Log only type.
            logger.warning("history refresh failed", extra={
                "messageId": record["messageId"], "errorType": type(err).__name__,
            })
            failures.append({"itemIdentifier": record["messageId"]})
    return {"batchItemFailures": failures}
