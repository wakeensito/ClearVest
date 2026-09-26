"""GET /market/macro: rates, inflation, labor and wages, so advice isn't given in a vacuum.

Cached 24h at CACHE#fred/macro; the advisor reads the same row as context.
"""

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, cache

from market.providers import fred

router = Router()
TTL = 24 * 3600


def _latest(series_id: str) -> tuple[str | None, float | None]:
    obs = fred.observations(series_id, 5)
    return obs[0] if obs else (None, None)


def _yoy(series_id: str) -> tuple[str | None, float | None]:
    obs = fred.observations(series_id, 13)
    if len(obs) < 13 or obs[12][1] == 0:
        return (obs[0][0] if obs else None), None
    return obs[0][0], round((obs[0][1] / obs[12][1] - 1) * 100, 2)


def _fetch() -> dict:
    dates, values = {}, {}
    for field, (fn, sid) in {
        "fedFunds": (_latest, "FEDFUNDS"), "cpiYoY": (_yoy, "CPIAUCSL"), "unemployment": (_latest, "UNRATE"),
        "wageGrowth": (_yoy, "CES0500000003"), "tenYear": (_latest, "DGS10"),
    }.items():
        dates[field], values[field] = fn(sid)
    parts = [
        f"Fed funds {values['fedFunds']}%" if values["fedFunds"] is not None else None,
        f"inflation {values['cpiYoY']}% YoY" if values["cpiYoY"] is not None else None,
        f"unemployment {values['unemployment']}%" if values["unemployment"] is not None else None,
        f"wages +{values['wageGrowth']}% YoY" if values["wageGrowth"] is not None else None,
        f"10-year Treasury {values['tenYear']}%" if values["tenYear"] is not None else None,
    ]
    known = [d for d in dates.values() if d]
    return {**values, "asOf": max(known) if known else None,
            "summary": ", ".join(p for p in parts if p) + "."}


def snapshot() -> tuple[dict, bool]:
    return cache.get_or_fetch("fred", "macro", TTL, _fetch)


@router.get("/market/macro")
def get_macro():
    api.user_id(router)
    value, stale = snapshot()
    return {**value, "stale": stale}
