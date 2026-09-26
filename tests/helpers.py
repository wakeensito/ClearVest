"""Builders for API Gateway HTTP API (v2) events and a fake Lambda context."""

import json
from dataclasses import dataclass

USER = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f"


@dataclass
class FakeContext:
    function_name: str = "test"
    memory_limit_in_mb: int = 512
    invoked_function_arn: str = "arn:aws:lambda:us-east-1:123456789012:function:test"
    aws_request_id: str = "req-123"


def ctx() -> FakeContext:
    return FakeContext()


def http_event(method, path, body=None, headers=None, query=None, user="default"):
    """Minimal HTTP API v2 event. user="default" sends USER; user=None omits the header."""
    hdrs = {"content-type": "application/json"}
    if user == "default":
        hdrs["x-user-id"] = USER
    elif user is not None:
        hdrs["x-user-id"] = user
    hdrs.update(headers or {})
    raw_body = body if isinstance(body, str) or body is None else json.dumps(body)
    return {
        "version": "2.0",
        "routeKey": "$default",
        "rawPath": path,
        "rawQueryString": "&".join(f"{k}={v}" for k, v in (query or {}).items()),
        "headers": hdrs,
        "queryStringParameters": query,
        "requestContext": {
            "http": {"method": method, "path": path, "sourceIp": "127.0.0.1"},
            "requestId": "api-req-1",
            "stage": "$default",
        },
        "body": raw_body,
        "isBase64Encoded": False,
    }


def call(handler, *args, **kwargs):
    """Invoke a Lambda handler with http_event(*args, **kwargs); return (status, parsed body or None)."""
    resp = handler(http_event(*args, **kwargs), ctx())
    body = resp.get("body")
    return resp["statusCode"], (json.loads(body) if body else None)
