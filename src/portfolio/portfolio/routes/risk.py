"""GET /portfolio/risk: the deterministic score over the user's current holdings and profile."""

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, db, risk

from portfolio.routes.holdings import load_holdings

router = Router()


@router.get("/portfolio/risk")
def get_risk():
    uid = api.user_id(router)
    holdings = load_holdings(uid)
    return risk.score(holdings["holdings"], db.get(db.user_pk(uid), "PROFILE"))
