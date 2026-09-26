"""Provider response cache in DynamoDB.

Required, not an optimization: Alpha Vantage's free tier is 25 calls/day. Expired
rows are kept for STALE_KEEP_SECONDS so a provider outage can still serve the
last good value with stale=True.
"""

import json
import time
from collections.abc import Callable
from typing import Any

from clearvest import db
from clearvest.api import logger
from clearvest.errors import UpstreamError

STALE_KEEP_SECONDS = 7 * 24 * 3600
MAX_ITEM_BYTES = 350_000  # DynamoDB items cap at 400 KB; leave room for keys


def _pk(provider: str) -> str:
    return f"CACHE#{provider}"


def get_or_fetch(provider: str, key: str, ttl_seconds: int, fetch: Callable[[], Any]) -> tuple[Any, bool]:
    now = time.time()
    row = db.get(_pk(provider), key)
    if row and row["expiresAt"] > now:
        return row["value"], False
    try:
        value = fetch()
    except UpstreamError as err:
        if row:
            logger.warning("serving stale cache", extra={"provider": provider, "key": key, "detail": err.detail})
            return row["value"], True
        raise
    _put(provider, key, value, ttl_seconds, now)
    return value, False


def peek(provider: str, key: str) -> Any | None:
    row = db.get(_pk(provider), key)
    return row["value"] if row else None


def _put(provider: str, key: str, value: Any, ttl_seconds: int, now: float) -> None:
    data = {"value": value, "expiresAt": now + ttl_seconds, "fetchedAt": now}
    if len(json.dumps(data)) > MAX_ITEM_BYTES:
        logger.warning("value too large to cache", extra={"provider": provider, "key": key})
        return
    db.put(_pk(provider), key, data, ttl=int(now + ttl_seconds + STALE_KEEP_SECONDS))
