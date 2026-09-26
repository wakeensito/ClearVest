"""Plaid Link flow. /plaid/sandbox-link lets the backend be tested with no frontend."""

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, db
from clearvest.providers import plaid

from portfolio.models import ExchangeRequest

router = Router()


def _store(user_id: str, item_id: str, access_token: str) -> None:
    db.put(db.user_pk(user_id), f"PLAID#{item_id}", {"itemId": item_id, "accessToken": access_token})


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
