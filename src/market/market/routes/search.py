"""GET /market/search: unified security search for beginners.

Merges Financial Modeling Prep's `search-symbol`/`search-name` (keyed, quota-limited) with
Yahoo Finance's keyless `yf.Search` (fast but noisy for bare category words - the frontend's
curated map handles those; this route is the "type a name" tier - see the unified-search
handoff, docs/handoffs/2026-09-27-data-unified-search.md).

Provider-call gating keeps FMP quota in check: a 1-character query never calls a provider; a
2+ character ticker-shaped query (no spaces) calls FMP `search-symbol` + Yahoo; a 3+ character
ticker-shaped query also calls FMP `search-name`; anything else (a name with a space, e.g.
"apple inc") calls FMP `search-name` + Yahoo only - `search-symbol` on a multi-word string
would never return anything useful.

FMP's `/stable` search endpoints return the listing's `exchange` field, NOT
`exchangeShortName` - the latter doesn't exist in that response and reading it always produced
`exchange: null` (the bug this route fixes; the old code lived at routes/research.py:138).
"""

import re
from concurrent.futures import ThreadPoolExecutor

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, cache
from clearvest.errors import InvalidInput, UpstreamError

from market.providers import fmp, yahoo
from market.routes.fund import LEVERAGED_RE
from market.routes.history import SYMBOL

router = Router()
TTL = 24 * 3600
CACHE_KEY_VERSION = "v2"
MAX_RESULTS = 8
MIN_TICKER_CALL_CHARS = 2
MIN_NAME_CALL_CHARS = 3

# Shape check only, not a semantic one: "apple" is just as "ticker-like" as "aapl" here (both are
# a single run of ticker-safe characters with no spaces) - see the "Name that looks like a
# ticker" edge case (B12). A query containing a space, or any character outside this set, is
# never ticker-like and only ever reaches FMP's name search.
_TICKER_LIKE_RE = re.compile(r"^[A-Za-z0-9.^-]{1,12}$")
# A real ticker with a share-class suffix (BRK.B, GOOG... no - BF.B, BRK.B) uses a single-letter
# A/B suffix; a foreign-listing suffix (AAPL.L, VFV.TO, AAPL.MX) is an exchange code, never A/B
# alone in practice for a US primary listing. Only the class-share shape is rewritten to the
# dash form Yahoo/FMP's history endpoints already expect; anything else with a remaining "." is
# a foreign listing and gets dropped entirely (v1 scope - see the edge-case register, B4).
_CLASS_SHARE_RE = re.compile(r"^([A-Z]{1,5})\.([AB])$")
_US_EXCHANGES = frozenset({
    "NASDAQ", "NYSE", "AMEX", "NYSE ARCA", "BATS", "CBOE", "NMS", "NGM", "NYQ", "PCX",
})
_ETF_NAME_RE = re.compile(r"\b(ETF|Trust)\b", re.IGNORECASE)
# Heuristic only (B13): a 5-letter symbol ending in X is the common US mutual-fund ticker shape
# (FXAIX, VFIAX, SWPPX); real yfinance/FMP data corrects a wrong guess after the user picks it.
_MUTUAL_FUND_SYMBOL_RE = re.compile(r"^[A-Z]{4}X$")
_FUND_KINDS = frozenset({"etf", "mutual_fund"})
_YAHOO_KINDS = frozenset({"etf", "mutual_fund", "stock", "index", "crypto"})


def _text(value, limit=200):
    return value.strip()[:limit] if isinstance(value, str) and value.strip() else None


def _normalize_symbol(raw) -> str | None:
    symbol = str(raw or "").strip().upper()
    match = _CLASS_SHARE_RE.fullmatch(symbol)
    if match:
        symbol = f"{match.group(1)}-{match.group(2)}"
    if "." in symbol or "=" in symbol or not SYMBOL.fullmatch(symbol):
        return None
    return symbol


def _kind_heuristic(symbol: str, name: str) -> str:
    if _ETF_NAME_RE.search(name):
        return "etf"
    if _MUTUAL_FUND_SYMBOL_RE.fullmatch(symbol):
        return "mutual_fund"
    return "stock"


def _leveraged(kind: str, name: str) -> bool:
    return kind in _FUND_KINDS and bool(LEVERAGED_RE.search(name))


def _fmp_row(row) -> dict | None:
    if not isinstance(row, dict):
        return None
    symbol = _normalize_symbol(row.get("symbol"))
    name = _text(row.get("name"))
    if not symbol or not name:
        return None
    kind = _kind_heuristic(symbol, name)
    return {
        "symbol": symbol, "name": name, "exchange": _text(row.get("exchange")),
        "kind": kind, "leveraged": _leveraged(kind, name), "source": "fmp",
    }


def _yahoo_row(row) -> dict | None:
    if not isinstance(row, dict):
        return None
    symbol = _normalize_symbol(row.get("symbol"))
    name = _text(row.get("name"))
    kind = row.get("kind")
    if not symbol or not name or kind not in _YAHOO_KINDS:
        return None
    return {
        "symbol": symbol, "name": name, "exchange": _text(row.get("exchange")),
        "kind": kind, "leveraged": _leveraged(kind, name), "source": "yahoo",
    }


def _jobs_for(query: str) -> dict:
    """Which provider calls this query is worth making. Keys are used only to route results
    back to the right provider bucket (fmp_symbol/fmp_name both count as "fmp").

    A share-class query ("brk.b") is normalized to the dash form ("BRK-B") *before* it's sent
    to either provider, not just in the results afterwards - live Yahoo search only recognizes
    the dash form for this ticker shape (verified: `yf.Search("brk.b")` never returns BRK-B,
    `yf.Search("brk-b")` does). Gating itself (call it at all? which jobs?) still looks at the
    query exactly as the user typed it - the dash form is just what reaches the provider.
    """
    if len(query) < MIN_TICKER_CALL_CHARS:
        return {}
    ticker_like = bool(_TICKER_LIKE_RE.fullmatch(query))
    lookup = (_normalize_symbol(query) or query) if ticker_like else query
    jobs: dict = {"yahoo": lambda: yahoo.search(lookup)}
    if ticker_like:
        jobs["fmp_symbol"] = lambda: fmp.search_companies(lookup, True)
        if len(query) >= MIN_NAME_CALL_CHARS:
            jobs["fmp_name"] = lambda: fmp.search_companies(lookup, False)
    else:
        jobs["fmp_name"] = lambda: fmp.search_companies(lookup, False)
    return jobs


def _run(name_job):
    name, job = name_job
    try:
        return name, job(), None
    except UpstreamError as err:
        return name, None, err.provider


def _merge(rows: list[dict]) -> list[dict]:
    """Yahoo rows are placed first by the caller so its `kind` wins a duplicate symbol; FMP fills
    in a missing `exchange` and either source's leveraged flag sticks."""
    merged: dict[str, dict] = {}
    order: list[str] = []
    for row in rows:
        symbol = row["symbol"]
        if symbol not in merged:
            merged[symbol] = dict(row)
            order.append(symbol)
            continue
        existing = merged[symbol]
        if existing["exchange"] is None and row["exchange"] is not None:
            existing["exchange"] = row["exchange"]
        if existing["source"] != row["source"]:
            existing["source"] = "both"
        existing["leveraged"] = existing["leveraged"] or row["leveraged"]
    return [merged[symbol] for symbol in order]


def _rank(rows: list[dict], query: str) -> list[dict]:
    # A query typed with a dot ("brk.b") must still recognize a normalized "BRK-B" result row
    # as the exact match - fall back to a plain upper() only when the query isn't itself a
    # normalizable ticker shape (e.g. a company name).
    exact = _normalize_symbol(query) or query.strip().upper()
    prefix = query.strip().casefold()
    return sorted(rows, key=lambda row: (
        row["symbol"] != exact,
        row["exchange"] not in _US_EXCHANGES,
        not row["name"].casefold().startswith(prefix),
    ))


@router.get("/market/search")
def search():
    api.user_id(router)
    query = (router.current_event.get_query_string_value("query") or "").strip()
    if not 1 <= len(query) <= 80 or any(ord(char) < 32 for char in query):
        raise InvalidInput("query: enter a company, fund or ticker, up to 80 characters")

    def fetch():
        jobs = _jobs_for(query)
        if not jobs:
            return {"results": [], "unavailable": []}
        with ThreadPoolExecutor(max_workers=3) as pool:
            outcomes = list(pool.map(_run, jobs.items()))

        fmp_rows, yahoo_rows = [], []
        fmp_attempted = fmp_ok = yahoo_attempted = yahoo_ok = False
        for name, rows, _failed_provider in outcomes:
            if name == "yahoo":
                yahoo_attempted = True
                if rows is not None:
                    yahoo_ok = True
                    yahoo_rows.extend(r for r in (_yahoo_row(row) for row in rows) if r)
            else:
                fmp_attempted = True
                if rows is not None:
                    fmp_ok = True
                    fmp_rows.extend(r for r in (_fmp_row(row) for row in rows) if r)

        if fmp_attempted and yahoo_attempted and not fmp_ok and not yahoo_ok:
            raise UpstreamError("search", "fmp and yahoo both unavailable")

        unavailable = []
        if fmp_attempted and not fmp_ok:
            unavailable.append("fmp")
        if yahoo_attempted and not yahoo_ok:
            unavailable.append("yahoo")

        merged = _merge(yahoo_rows + fmp_rows)
        return {"results": _rank(merged, query)[:MAX_RESULTS], "unavailable": sorted(unavailable)}

    data, stale = cache.get_or_fetch("search", f"search:{CACHE_KEY_VERSION}:{query.casefold()}", TTL, fetch)
    return {**data, "stale": stale}
