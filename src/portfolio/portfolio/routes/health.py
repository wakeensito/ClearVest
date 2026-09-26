"""Liveness check. No X-User-Id needed, so uptime checks and the smoke script can hit it."""

import os

from aws_lambda_powertools.event_handler.api_gateway import Router

router = Router()


@router.get("/health")
def health():
    return {"status": "ok", "version": os.environ.get("APP_VERSION", "dev")}
