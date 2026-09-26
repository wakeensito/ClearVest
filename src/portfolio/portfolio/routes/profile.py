"""GET/PUT /profile: age, horizon, goals, risk tolerance. The advisor and risk score read this."""

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, db
from clearvest.errors import NotFound

from portfolio.models import Profile

router = Router()


@router.get("/profile")
def get_profile():
    profile = db.get(db.user_pk(api.user_id(router)), "PROFILE")
    if profile is None:
        raise NotFound("No profile yet")
    return profile


@router.put("/profile")
def put_profile():
    uid = api.user_id(router)
    profile = api.parse(Profile, api.json_body(router)).model_dump()
    db.put(db.user_pk(uid), "PROFILE", profile)
    return profile
