"""Dated FMP fund constituents, normalized before being shared across users."""

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, cache, exposure

from market.providers import fmp
from market.routes.history import parse_symbols

router = Router()


@router.get("/market/fund-holdings")
def fund_holdings():
    api.user_id(router)
    symbol = parse_symbols(router.current_event.get_query_string_value("symbol"), 1, 1)[
        0
    ]
    data, stale = cache.get_or_fetch(
        "fmp",
        exposure.CACHE_PREFIX + symbol,
        24 * 3600,
        lambda: exposure.normalize_fund(symbol, fmp.fund_holdings(symbol)),
    )
    return {**data, "stale": stale}
