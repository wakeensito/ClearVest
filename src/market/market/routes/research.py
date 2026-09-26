"""Company learning data: independent caches preserve useful sections during outages."""

import math
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, cache
from clearvest.errors import InvalidInput, UpstreamError

from market.providers import fmp
from market.routes.history import SYMBOL, parse_symbols

router = Router()
SECTIONS = ("profile", "income", "valuation", "history")
TTL = 24 * 3600


def _number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return value if math.isfinite(value) else None


def _text(value, limit=2000):
    return value.strip()[:limit] if isinstance(value, str) and value.strip() else None


def _currency(value):
    return value if isinstance(value, str) and re.fullmatch(r"[A-Z]{3}", value) else None


def _date(value):
    try:
        return date.fromisoformat(value).isoformat() if isinstance(value, str) else None
    except ValueError:
        return None


def _normalize(symbol, section, rows):
    valid = [r for r in rows if isinstance(r, dict) and str(r.get("symbol", "")).upper() == symbol]
    if rows and not valid:
        raise UpstreamError("fmp", "unusable company research payload")
    if section == "profile":
        if not valid:
            return None
        row = valid[0]
        if not _text(row.get("companyName")):
            raise UpstreamError("fmp", "missing company name")
        return {"name": _text(row.get("companyName")), "description": _text(row.get("description")),
                "sector": _text(row.get("sector")), "industry": _text(row.get("industry")),
                "currency": _currency(row.get("currency")),
                "isFund": row.get("isEtf") is True or row.get("isFund") is True}
    if section == "valuation":
        if not valid:
            return None
        row = valid[0]
        return {"pe": _number(row.get("priceToEarningsRatioTTM")),
                "eps": _number(row.get("netIncomePerShareTTM")),
                "ps": _number(row.get("priceToSalesRatioTTM"))}
    result, seen = [], set()
    for row in sorted(valid, key=lambda r: str(r.get("date", "")), reverse=True):
        end = _date(row.get("date"))
        year = str(row.get("fiscalYear") or "")
        if not end or row.get("period") != "FY" or not re.fullmatch(r"\d{4}", year) or year in seen:
            continue
        if section == "income":
            currency = _currency(row.get("reportedCurrency"))
            result.append({"date": end, "year": year, "currency": currency,
                           **{key: _number(row.get(key)) for key in (
                               "revenue", "costOfRevenue", "grossProfit", "operatingIncome", "netIncome", "epsDiluted")}})
        else:
            result.append({"date": end, "year": year, "pe": _number(row.get("priceToEarningsRatio"))})
        seen.add(year)
    if valid and not result:
        raise UpstreamError("fmp", "no usable annual company data")
    return result[:5]


def _section(symbol, section):
    def fetch():
        return {"value": _normalize(symbol, section, fmp.research_section(symbol, section)),
                "fetchedAt": datetime.now(UTC).isoformat()}
    try:
        snapshot, stale = cache.get_or_fetch("fmp", f"research:v1:{symbol}:{section}", TTL, fetch)
        return section, snapshot, stale
    except UpstreamError:
        return section, None, False


@router.get("/market/company-research")
def research():
    api.user_id(router)
    symbol = parse_symbols(router.current_event.get_query_string_value("symbol"), 1, 1)[0]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda section: _section(symbol, section), SECTIONS))
    if all(snapshot is None for _, snapshot, _ in results):
        raise UpstreamError("fmp", "company research unavailable")
    body = {"symbol": symbol, "profile": None, "income": [], "valuation": None,
            "history": [], "unavailable": [], "sources": []}
    for section, snapshot, stale in results:
        if snapshot is None:
            body["unavailable"].append(section)
        else:
            body[section] = snapshot["value"]
            body["sources"].append({"section": section, "provider": "FMP",
                                    "fetchedAt": snapshot["fetchedAt"], "stale": stale})
    return body


@router.get("/market/search")
def search():
    api.user_id(router)
    query = (router.current_event.get_query_string_value("query") or "").strip()
    if not 1 <= len(query) <= 80 or any(ord(char) < 32 for char in query):
        raise InvalidInput("query: enter a company name or ticker, up to 80 characters")

    def fetch():
        def lookup(by_symbol):
            try:
                return fmp.search_companies(query, by_symbol)
            except UpstreamError:
                return None
        with ThreadPoolExecutor(max_workers=2) as pool:
            batches = list(pool.map(lookup, (True, False)))
        if all(batch is None for batch in batches):
            raise UpstreamError("fmp", "company search unavailable")
        results, seen = [], set()
        for row in [r for batch in batches if batch for r in batch]:
            if not isinstance(row, dict):
                continue
            symbol = str(row.get("symbol", "")).upper()
            name = _text(row.get("name"))
            if not SYMBOL.fullmatch(symbol) or not name or symbol in seen:
                continue
            seen.add(symbol)
            results.append({"symbol": symbol, "name": name, "exchange": _text(row.get("exchangeShortName"))})
        results.sort(key=lambda row: row["symbol"] != query.upper())
        return {"results": results[:8]}
    data, stale = cache.get_or_fetch("fmp", f"search:v1:{query.casefold()}", TTL, fetch)
    return {**data, "stale": stale}
