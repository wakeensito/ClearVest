"""Yahoo Finance via yfinance: the primary price source (data team, #15). No key needed."""

import math
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from datetime import date
from itertools import zip_longest

from clearvest.errors import UpstreamError

_QUOTE_KIND = {
    "ETF": "etf", "MUTUALFUND": "mutual_fund", "EQUITY": "stock",
    "INDEX": "index", "CRYPTOCURRENCY": "crypto",
}
_FUND_KINDS = ("etf", "mutual_fund")
# > 20% is almost certainly bad/misparsed data, not a real fund fee.
_MAX_EXPENSE_RATIO = 0.2
_MAX_TOP_HOLDINGS = 10
# Market-wide headlines come from the S&P 500 index's own news feed; no key, no paid tier.
_NEWS_MARKET_SYMBOL = "^GSPC"
# `.news` has no timeout parameter (yfinance posts with 30s) and MarketFn has 29s in total, so a
# hanging Yahoo would time out the Lambda instead of reaching the route's 502 / stale-cache path.
_NEWS_TIMEOUT = 8
# One small shared pool, never per call: a timed-out request keeps its worker until yfinance's own
# 30s cap fires, and with two workers at most two such requests can exist per Lambda container.
_NEWS_POOL = ThreadPoolExecutor(max_workers=2, thread_name_prefix="yahoo-news")


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


def search(query: str) -> list[dict]:
    """Keyless Yahoo Finance search (yfinance 1.7.0's `yf.Search`).

    Good for names ("apple" -> AAPL) but noisy for bare category words ("fidelity index" ->
    UK funds) - callers pair this with a curated map for that case (see the unified-search
    handoff). `quoteType`s with no mapping in `_QUOTE_KIND` (FUTURE, OPTION, CURRENCY, ...) are
    silently dropped rather than surfaced as an "other" kind - they're never useful search hits.
    """
    import yfinance as yf  # heavy (pandas); import only when a request needs it

    # Lambda's filesystem is read-only except /tmp; yfinance caches timezones on disk.
    yf.set_tz_cache_location("/tmp/yfinance")
    try:
        # timeout=4, no fuzzy matching: this feeds a merged multi-provider search that must fit
        # inside API Gateway's 30s limit alongside FMP, and fuzzy results are noise, not signal.
        quotes = yf.Search(
            query, max_results=8, news_count=0, lists_count=0, include_cb=False,
            enable_fuzzy_query=False, timeout=4,
        ).quotes
    except Exception as err:  # yfinance raises many types; all mean "Yahoo failed"
        raise UpstreamError("yahoo", f"{type(err).__name__}: {err}") from err
    rows = []
    for quote in quotes or []:
        if not isinstance(quote, dict):
            continue
        kind = _QUOTE_KIND.get(str(quote.get("quoteType", "")).upper())
        if kind is None:  # FUTURE/OPTION/CURRENCY/etc: never a useful search hit
            continue
        symbol = _text(quote.get("symbol"))
        name = _text(quote.get("longname")) or _text(quote.get("shortname"))
        if not symbol or not name:
            continue
        rows.append({"symbol": symbol, "name": name, "exchange": _text(quote.get("exchange")), "kind": kind})
    return rows


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


def _first(*values):
    return next((v for v in values if isinstance(v, str) and v.strip()), None)


def _news_items(yf, symbol: str) -> list:
    """`.news` has no timeout parameter, so the wait is bounded here; the request itself is bounded
    by yfinance's 30s (the session is a process-wide singleton, so it is not overridden per call)."""
    future = _NEWS_POOL.submit(lambda: yf.Ticker(symbol).news)
    try:
        return future.result(timeout=_NEWS_TIMEOUT) or []
    except FutureTimeout as err:
        raise UpstreamError("yahoo", f"news timed out after {_NEWS_TIMEOUT}s for {symbol}") from err
    except Exception as err:  # yfinance raises many types; all mean "Yahoo failed"
        raise UpstreamError("yahoo", f"{type(err).__name__}: {err}") from err


def news(symbols: list[str]) -> list[dict]:
    """Publisher headlines for one or two symbols, or market-wide when `symbols` is empty. Rows are
    normalized to the shape the news route filters (symbol, title, url, image, publisher,
    publishedDate), so the route does not care which provider fed it. FMP's news endpoints are 402
    on the free tier; Yahoo's feed needs no key."""
    import yfinance as yf  # heavy (pandas); import only when a request needs it

    yf.set_tz_cache_location("/tmp/yfinance")
    feeds: list[list[dict]] = []
    for symbol in symbols or [_NEWS_MARKET_SYMBOL]:
        items = _news_items(yf, symbol)
        rows: list[dict] = []
        feeds.append(rows)
        for item in items:
            if not isinstance(item, dict):
                continue
            # yfinance >= 0.2.50 nests everything under "content"; older releases were flat.
            content = item["content"] if isinstance(item.get("content"), dict) else item
            links = [content.get(key) for key in ("canonicalUrl", "clickThroughUrl")]
            url = _first(*(link.get("url") for link in links if isinstance(link, dict)), item.get("link"))
            provider = content.get("provider") if isinstance(content.get("provider"), dict) else {}
            thumb = content.get("thumbnail") if isinstance(content.get("thumbnail"), dict) else {}
            resolutions = thumb.get("resolutions") if isinstance(thumb.get("resolutions"), list) else []
            image = _first(thumb.get("originalUrl"), *(r.get("url") for r in resolutions if isinstance(r, dict)))
            rows.append({
                "symbol": symbol if symbols else "",
                "title": content.get("title"),
                "url": url,
                "image": image,
                "publisher": _first(provider.get("displayName"), item.get("publisher")),
                "publishedDate": _first(content.get("pubDate"), content.get("displayTime")) or "",
            })
    # Interleave the feeds so a comparison shows both companies; the route keeps only the first six.
    return [row for group in zip_longest(*feeds) for row in group if row is not None]


_INCOME_ROWS = {"revenue": "Total Revenue", "costOfRevenue": "Cost Of Revenue", "grossProfit": "Gross Profit",
                "operatingIncome": "Operating Income", "netIncome": "Net Income", "epsDiluted": "Diluted EPS"}


def _finite(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def company_rows(symbol: str, section: str) -> list[dict]:
    """FMP-shaped rows for routes/research.py when FMP is down or out of quota.

    Only profile, valuation and income are available keylessly; anything else raises so the
    caller keeps reporting that section as unavailable. Numbers pass through the route's own
    validation (_normalize), exactly as FMP rows do.
    """
    if section not in {"profile", "valuation", "income"}:
        raise UpstreamError("yahoo", f"no {section} fallback")
    import yfinance as yf  # heavy (pandas); import only when a request needs it

    yf.set_tz_cache_location("/tmp/yfinance")
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        statement = ticker.income_stmt if section == "income" else None
    except Exception as err:  # yfinance raises many types; all mean "Yahoo failed"
        raise UpstreamError("yahoo", f"{type(err).__name__}: {err}") from err
    if not info or not (info.get("longName") or info.get("shortName")):
        raise UpstreamError("yahoo", f"no company data for {symbol}")
    if section == "profile":
        quote = str(info.get("quoteType", "")).upper()
        return [{"symbol": symbol, "companyName": info.get("longName") or info.get("shortName"),
                 "description": info.get("longBusinessSummary"), "sector": info.get("sector"),
                 "industry": info.get("industry"), "currency": info.get("currency"),
                 "isEtf": quote == "ETF", "isFund": quote == "MUTUALFUND",
                 "beta": _finite(info.get("beta")), "marketCap": _finite(info.get("marketCap"))}]
    if section == "valuation":
        # trailingAnnualDividendYield is a fraction; yfinance's dividendYield is a percent.
        return [{"symbol": symbol, "priceToEarningsRatioTTM": _finite(info.get("trailingPE")),
                 "netIncomePerShareTTM": _finite(info.get("trailingEps")),
                 "priceToSalesRatioTTM": _finite(info.get("priceToSalesTrailing12Months")),
                 "dividendYieldTTM": _finite(info.get("trailingAnnualDividendYield"))}]
    rows = []
    if statement is not None and not statement.empty:
        for column in statement.columns:
            when = getattr(column, "date", lambda: None)()
            if when is None:
                continue
            row = {"symbol": symbol, "date": when.isoformat(), "fiscalYear": str(when.year), "period": "FY",
                   "reportedCurrency": info.get("financialCurrency") or info.get("currency")}
            for key, label in _INCOME_ROWS.items():
                row[key] = _finite(statement.at[label, column]) if label in statement.index else None
            rows.append(row)
    return rows
