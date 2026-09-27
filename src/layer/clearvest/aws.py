"""Cached boto3 clients. Created lazily so tests can swap in moto, and reused across warm invocations."""

import os
from functools import cache

import boto3
from botocore.config import Config


@cache
def ssm():
    return boto3.client("ssm")


@cache
def sqs():
    # Submission is on the HTTP path; do not wait the SDK's default 60 seconds.
    return boto3.client("sqs", config=Config(
        connect_timeout=1, read_timeout=2,
        retries={"mode": "standard", "total_max_attempts": 1},
    ))


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
    # API Lambdas have 29s total. SAM sets one attempt with an 8s read for Advisor
    # and 7s for Voice, leaving room for input screening, optional source checks,
    # and STT. The provider also checks the remaining invocation budget.
    # total_max_attempts includes the initial request; max_attempts would not.
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
def guardrails():
    return boto3.client("bedrock-runtime", config=Config(
        connect_timeout=1, read_timeout=3,
        retries={"mode": "standard", "total_max_attempts": 1},
    ))


@cache
def table():
    return boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])


def reset() -> None:
    for fn in (ssm, sqs, s3, bedrock, guardrails, table):
        fn.cache_clear()
