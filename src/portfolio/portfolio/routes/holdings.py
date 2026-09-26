"""GET /portfolio/holdings. The snapshot lives at USER#<id>/HOLDINGS and is refetched after an hour."""

import time
from datetime import UTC, datetime

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, db
from clearvest.errors import NotLinked, UpstreamError
from clearvest.providers import plaid

router = Router()
FRESH_SECONDS = 3600


def load_holdings(user_id: str) -> dict:
    pk = db.user_pk(user_id)
    items = db.query(pk, "PLAID#", consistent=True)
    if not items:
        raise NotLinked("Link an account first")
    snapshot = db.get(pk, "HOLDINGS")
    if snapshot and time.time() - snapshot["fetchedAt"] < FRESH_SECONDS:
        return _public(snapshot)
    try:
        normalized = plaid.normalize([plaid.holdings(i["accessToken"]) for i in items])
    except UpstreamError:
        if snapshot:
            return {**_public(snapshot), "stale": True}
        raise
    snapshot = {"asOf": datetime.now(UTC).isoformat(timespec="seconds"), **normalized, "fetchedAt": time.time()}
    db.put(pk, "HOLDINGS", snapshot)
    return _public(snapshot)


def _public(snapshot: dict) -> dict:
    return {k: v for k, v in snapshot.items() if k != "fetchedAt"}


@router.get("/portfolio/holdings")
def get_holdings():
    return load_holdings(api.user_id(router))
