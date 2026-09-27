"""Portfolio look-through calculated from owned positions and validated public fund caches."""

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, db, exposure
from clearvest.errors import NotLinked

router = Router()


@router.get("/portfolio/exposure")
def portfolio_exposure():
    holdings = db.get(db.user_pk(api.user_id(router)), "HOLDINGS")
    if not holdings:
        raise NotLinked("Load your linked portfolio first")
    return exposure.analyze(holdings)
