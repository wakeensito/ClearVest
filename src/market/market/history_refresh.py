"""Shared history snapshots and durable refresh reservations.

The HTTP path never calls a data provider. A reservation covers queue retention
plus the worker deadline; a shorter execution lease protects against duplicate
SQS delivery. Expiration is checked explicitly, never entrusted to DynamoDB TTL.
"""

import json
import os
import time
import uuid

from botocore.exceptions import BotoCoreError, ClientError
from clearvest import aws, db
from clearvest.api import logger

CACHE_SECONDS = 24 * 3600
STALE_SECONDS = 7 * 24 * 3600
DISPATCH_SECONDS = 30  # recover a producer crash between reservation and SQS send
JOB_SECONDS = 3720  # queue retention (3600) + margin for an in-flight worker
WORK_SECONDS = 90  # strictly longer than the 60-second Lambda timeout
FAILURE_COOLDOWN = 300
MAX_RECEIVES = 5


def job_key(symbol: str, rng: str) -> dict:
    return {"pk": f"REFRESH#history#{symbol}", "sk": rng}


def snapshot(symbol: str, rng: str) -> dict | None:
    row = db.get("CACHE#history", f"{symbol}:{rng}")
    if row and row["expiresAt"] + STALE_SECONDS > time.time():
        return row
    return None


def job(symbol: str, rng: str) -> dict | None:
    return aws.table().get_item(Key=job_key(symbol, rng), ConsistentRead=True).get("Item")


def conditional_failure(err: ClientError) -> bool:
    return err.response["Error"]["Code"] == "ConditionalCheckFailedException"


def request_refresh(symbol: str, rng: str) -> dict:
    now = int(time.time())
    item = {
        **job_key(symbol, rng), "jobId": str(uuid.uuid4()), "state": "pending",
        "requestedAt": now, "leaseUntil": now + DISPATCH_SECONDS, "ttl": now + 86400,
    }
    try:
        aws.table().put_item(
            Item=item, ConditionExpression="attribute_not_exists(pk) OR leaseUntil <= :now",
            ExpressionAttributeValues={":now": now},
        )
    except ClientError as err:
        if not conditional_failure(err):
            raise
        current = job(symbol, rng)
        # A completed worker may race with the API's cache read. The next poll
        # will observe its snapshot; do not enqueue another refresh here.
        return current or item
    try:
        aws.sqs().send_message(
            QueueUrl=os.environ["MARKET_REFRESH_QUEUE_URL"],
            MessageBody=json.dumps({"symbol": symbol, "range": rng, "jobId": item["jobId"]}),
        )
    except (BotoCoreError, ClientError, KeyError):
        # Includes ambiguous send failures: fence the old token before allowing
        # another job. A late delivery cannot write over the replacement job.
        try:
            aws.table().update_item(
                Key=job_key(symbol, rng),
                UpdateExpression="SET #state = :failed, leaseUntil = :until",
                ConditionExpression="jobId = :id AND attribute_not_exists(workOwner) AND #state = :pending",
                ExpressionAttributeNames={"#state": "state"},
                ExpressionAttributeValues={
                    ":failed": "failed", ":pending": "pending",
                    ":until": now + FAILURE_COOLDOWN, ":id": item["jobId"],
                },
            )
        except ClientError as err:
            if not conditional_failure(err):
                raise
            return job(symbol, rng) or item  # ambiguous send already reached a worker
        logger.warning("history refresh submission failed", extra={"symbol": symbol, "range": rng})
        return {**item, "state": "failed"}
    try:
        aws.table().update_item(
            Key=job_key(symbol, rng), UpdateExpression="SET leaseUntil = :until",
            ConditionExpression="jobId = :id AND #state = :pending",
            ExpressionAttributeNames={"#state": "state"},
            ExpressionAttributeValues={":until": now + JOB_SECONDS, ":id": item["jobId"], ":pending": "pending"},
        )
    except ClientError as err:
        if not conditional_failure(err):
            raise
        return job(symbol, rng) or item
    logger.info("history refresh queued", extra={"symbol": symbol, "range": rng, "jobId": item["jobId"]})
    return item
