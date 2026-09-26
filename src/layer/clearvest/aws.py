"""Cached boto3 clients. Created lazily so tests can swap in moto, and reused across warm invocations."""

import os
from functools import cache

import boto3
from botocore.config import Config


@cache
def ssm():
    return boto3.client("ssm")


@cache
def s3():
    # Regional endpoint + SigV4: presigned URLs from the global endpoint redirect,
    # and browsers drop CORS headers on redirects.
    region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
    return boto3.client(
        "s3",
        region_name=region,
        endpoint_url=f"https://s3.{region}.amazonaws.com",
        config=Config(signature_version="s3v4"),
    )


@cache
def bedrock():
    # Lambda's hard timeout is 29s (API Gateway's is 30s), so total_attempts * read_timeout
    # must stay under that with room for everything else in the handler (S3, ElevenLabs,
    # ...). BEDROCK_MAX_ATTEMPTS is the TOTAL number of attempts (initial + retries) --
    # botocore's own `max_attempts` config key counts retries only, so we pass it as
    # `total_max_attempts` instead to get the semantics we want. Advisor: default 2 total
    # attempts * 12s = 24s. Voice sets BEDROCK_MAX_ATTEMPTS=1 (one Nova attempt, no retry)
    # since it also spends up to ~12s on ElevenLabs STT before this call: 12 + 12 = 24s.
    read_timeout = int(os.environ.get("BEDROCK_READ_TIMEOUT", "12"))
    total_max_attempts = int(os.environ.get("BEDROCK_MAX_ATTEMPTS", "2"))
    return boto3.client(
        "bedrock-runtime",
        config=Config(
            retries={"mode": "adaptive", "total_max_attempts": total_max_attempts},
            read_timeout=read_timeout, connect_timeout=3,
        ),
    )


@cache
def table():
    return boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])


def reset() -> None:
    for fn in (ssm, s3, bedrock, table):
        fn.cache_clear()
