"""GET /market/compare-companies: size-adjusted comparison (ratios, per-share), never raw dollars."""

import math

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, cache
from clearvest.errors import UpstreamError

from market.providers import edgar, fmp
from market.routes.history import fetch_all, parse_symbols

router = Router()
TTL = 24 * 3600
NOTES = ("Compared with ratios and per-share figures so a $3T company and a $300B company can be "
         "judged side by side: P/E and P/S show what you pay per dollar of earnings and sales, margins "
         "and growth show business quality, and debt-to-equity shows balance-sheet risk.")


def _company(symbol: str) -> tuple[dict, bool]:
    ratios, stale = cache.get_or_fetch("fmp", f"ratios:{symbol}", TTL, lambda: fmp.ratios_ttm(symbol))
    try:
        growth = edgar.revenue_growth(symbol)
    except UpstreamError:
        growth = None  # EDGAR down never breaks the comparison; FMP growth stands in
    if growth is None:
        growth, growth_stale = cache.get_or_fetch("fmp", f"growth:{symbol}", TTL, lambda: fmp.revenue_growth(symbol))
        stale |= growth_stale
    ratios = {key: value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else None for key, value in ratios.items()}
    growth = growth if isinstance(growth, (int, float)) and not isinstance(growth, bool) and math.isfinite(growth) else None
    pe = ratios.get("priceToEarningsRatioTTM")
    eps = ratios.get("netIncomePerShareTTM")
    return {
        "symbol": symbol,
        "pe": pe if pe is not None and pe > 0 and (eps is None or eps > 0) else None,
        "ps": ratios.get("priceToSalesRatioTTM"),
        "grossMargin": ratios.get("grossProfitMarginTTM"),
        "revenueGrowth": growth,
        "epsTTM": ratios.get("netIncomePerShareTTM"),
        "fcfPerShare": ratios.get("freeCashFlowPerShareTTM"),
        "debtToEquity": ratios.get("debtToEquityRatioTTM"),
    }, stale


@router.get("/market/compare-companies")
def compare():
    api.user_id(router)
    rows, any_stale = [], False
    for row, stale in fetch_all(parse_symbols(router.current_event.get_query_string_value("symbols"), 2, 4), _company):
        rows.append(row)
        any_stale |= stale
    return {"companies": rows, "notes": NOTES, "stale": any_stale}
