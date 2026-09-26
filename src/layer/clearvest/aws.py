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
    return boto3.client(
        "bedrock-runtime",
        config=Config(retries={"mode": "adaptive", "max_attempts": 4}, read_timeout=25, connect_timeout=3),
    )


@cache
def table():
    return boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])


def reset() -> None:
    for fn in (ssm, s3, bedrock, table):
        fn.cache_clear()
