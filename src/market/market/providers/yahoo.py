"""Yahoo Finance via yfinance: the primary price source (data team, #15). No key needed."""

import math
from datetime import date

from clearvest.errors import UpstreamError

_QUOTE_KIND = {
    "ETF": "etf", "MUTUALFUND": "mutual_fund", "EQUITY": "stock",
    "INDEX": "index", "CRYPTOCURRENCY": "crypto",
}
_FUND_KINDS = ("etf", "mutual_fund")
# > 20% is almost certainly bad/misparsed data, not a real fund fee.
_MAX_EXPENSE_RATIO = 0.2
_MAX_TOP_HOLDINGS = 10


def history(symbol: str, start: date) -> list[tuple[str, float]]:
    import yfinance as yf  # heavy (pandas); import only when a request needs it

    # Lambda's filesystem is read-only except /tmp; yfinance caches timezones on disk.
    yf.set_tz_cache_location("/tmp/yfinance")
    try:
        # timeout=4: yfinance defaults to 10s, and Yahoo is only the first of three sources
        # that must all fit inside API Gateway's 30s limit.
        frame = yf.Ticker(symbol).history(start=start.isoformat(), interval="1d", auto_adjust=True, timeout=4)
    except Exception as err:  # yfinance raises many types; all mean "Yahoo failed"
        raise UpstreamError("yahoo", f"{type(err).__name__}: {err}") from err
    if frame is None or frame.empty:
        raise UpstreamError("yahoo", f"no data for {symbol}")
    return [(ts.strftime("%Y-%m-%d"), round(float(close), 4)) for ts, close in frame["Close"].items()]


def _text(value) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _expense_ratio(info: dict) -> float | None:
    """netExpenseRatio is a PERCENT (0.03 means 0.03%); annualReportExpenseRatio is already a
    FRACTION (0.0004 means 0.04%). Prefer netExpenseRatio (the more current figure) when present."""
    net = info.get("netExpenseRatio")
    if isinstance(net, (int, float)) and not isinstance(net, bool):
        ratio = net / 100
    else:
        annual = info.get("annualReportExpenseRatio")
        if not isinstance(annual, (int, float)) or isinstance(annual, bool):
            return None
        ratio = annual
    if not math.isfinite(ratio) or ratio < 0 or ratio > _MAX_EXPENSE_RATIO:
        return None
    return round(ratio, 6)


def _top_holdings(frame) -> list[dict]:
    rows = []
    for symbol, row in frame.iterrows():
        weight = row.get("Holding Percent")
        if not isinstance(weight, (int, float)) or isinstance(weight, bool) or not math.isfinite(weight):
            continue
        name = _text(row.get("Name"))
        if name is None:
            continue
        rows.append({"symbol": _text(symbol), "name": name, "weight": float(weight)})
    rows.sort(key=lambda r: r["weight"], reverse=True)
    return rows[:_MAX_TOP_HOLDINGS]


def fund_profile(symbol: str) -> dict:
    """Fund/stock/index/crypto profile for the beginner "what is this?" explainer.

    routes/fund.py turns `description` into a plain-English summary and derives isIndexFund and
    leveraged; every number here (expenseRatio, topHoldings weights) comes straight from
    yfinance so nothing numeric is ever left for the model to invent.
    """
    import yfinance as yf  # heavy (pandas); import only when a request needs it
    from yfinance.exceptions import YFDataException

    # Lambda's filesystem is read-only except /tmp; yfinance caches timezones on disk.
    yf.set_tz_cache_location("/tmp/yfinance")
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
    except Exception as err:  # yfinance raises many types; all mean "Yahoo failed"
        raise UpstreamError("yahoo", f"{type(err).__name__}: {err}") from err
    if not info or not info.get("quoteType"):
        raise UpstreamError("yahoo", f"no data for {symbol}")

    kind = _QUOTE_KIND.get(str(info.get("quoteType")).upper(), "other")
    name = _text(info.get("longName")) or _text(info.get("shortName")) or symbol
    description = _text(info.get("longBusinessSummary")) or ""

    expense_ratio = None
    fund_family = category = sector = None
    top_holdings: list[dict] = []
    if kind in _FUND_KINDS:
        expense_ratio = _expense_ratio(info)
        fund_family = _text(info.get("fundFamily"))
        category = _text(info.get("category"))
        try:
            funds_data = ticker.funds_data
        except Exception:  # noqa: BLE001 - holdings/overview are a nice-to-have; never fail the profile for them
            funds_data = None
        if funds_data is not None:
            try:
                frame = funds_data.top_holdings
            except YFDataException:
                frame = None  # not actually a fund Yahoo has holdings data for (e.g. equities)
            except Exception:  # noqa: BLE001
                frame = None
            if frame is not None and not frame.empty:
                top_holdings = _top_holdings(frame)
            # `info` doesn't always carry fundFamily/category (seen live on VFIAX); fall back to
            # the fund-profile module's own overview dict, which uses different key names.
            if fund_family is None or category is None:
                try:
                    overview = funds_data.fund_overview or {}
                except Exception:  # noqa: BLE001
                    overview = {}
                fund_family = fund_family or _text(overview.get("family"))
                category = category or _text(overview.get("categoryName"))
    elif kind == "stock":
        sector = _text(info.get("sector"))

    return {
        "name": name,
        "kind": kind,
        "expenseRatio": expense_ratio,
        "topHoldings": top_holdings,
        "fundFamily": fund_family,
        "category": category,
        "sector": sector,
        "description": description,
    }
