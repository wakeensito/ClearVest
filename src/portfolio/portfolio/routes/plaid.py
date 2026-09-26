"""Plaid Link flow. /plaid/sandbox-link lets the backend be tested with no frontend."""

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, db
from clearvest.errors import UpstreamError
from clearvest.providers import plaid

from portfolio.models import ExchangeRequest
from portfolio.routes.holdings import load_holdings

router = Router()
# The post-link holdings refresh is best effort: only tried with enough time left for a Plaid call.
REFRESH_MIN_SECONDS = 8


def _store(user_id: str, item_id: str, access_token: str) -> None:
    pk = db.user_pk(user_id)
    db.put(pk, f"PLAID#{item_id}", {"itemId": item_id, "accessToken": access_token})
    # The old snapshot doesn't include the new item, so it's marked stale (fetchedAt: 0) and a
    # refetch is triggered now, so the advisor (which only reads the snapshot) sees these
    # holdings on the very next question. The stale row is kept, not dropped, so it still serves
    # as the fallback if the refetch below (or a later one) fails.
    snapshot = db.get(pk, "HOLDINGS")
    if snapshot:
        db.put(pk, "HOLDINGS", {**snapshot, "fetchedAt": 0})
    if api.remaining_seconds() <= REFRESH_MIN_SECONDS:
        return  # snapshot is already stale, so the next GET /portfolio/holdings refreshes it
    try:
        load_holdings(user_id)
    except UpstreamError:
        pass  # the link itself succeeded; GET /portfolio/holdings retries the fetch


@router.post("/plaid/link-token")
def link_token():
    return {"linkToken": plaid.create_link_token(api.user_id(router))}


@router.post("/plaid/exchange")
def exchange():
    uid = api.user_id(router)
    req = api.parse(ExchangeRequest, api.json_body(router))
    item_id, access_token = plaid.exchange(req.publicToken)
    _store(uid, item_id, access_token)
    return {"itemId": item_id}


@router.post("/plaid/sandbox-link")
def sandbox_link():
    uid = api.user_id(router)
    item_id, access_token = plaid.exchange(plaid.sandbox_public_token())
    _store(uid, item_id, access_token)
    return {"itemId": item_id}
