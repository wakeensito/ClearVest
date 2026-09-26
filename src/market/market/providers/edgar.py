"""SEC EDGAR filed revenue, ported from the data team's scripts/sec_smoke.py (#16).

Revenue tags change over time and later 10-Ks restate earlier years, so for each
fiscal year take the value from the latest filing, across both tags.
"""

from clearvest import cache, config, http

TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
REVENUE_TAGS = ("Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax")
WEEK = 7 * 24 * 3600


def _get(url: str) -> dict:
    headers = {"User-Agent": config.get_secret("SEC_USER_AGENT_PARAM"), "Accept-Encoding": "gzip, deflate"}
    return http.request_json("GET", url, provider="edgar", headers=headers, timeout=8)


def _cik(symbol: str) -> str | None:
    def fetch():
        # The ticker map is ~1 MB (too big to cache whole), so cache only this symbol's CIK.
        match = next((r for r in _get(TICKERS_URL).values() if r["ticker"] == symbol.upper()), None)
        return f"{match['cik_str']:010d}" if match else ""
    cik, _ = cache.get_or_fetch("edgar", f"cik:{symbol.upper()}", WEEK, fetch)
    return cik or None  # ETFs aren't in the map (VOO, QQQ): no filed revenue


def annual_revenues(facts: dict) -> list[tuple[str, float]]:
    """(period end, value) per fiscal year, oldest first, restated values winning."""
    best: dict[str, dict] = {}
    for tag in REVENUE_TAGS:
        for u in facts.get(tag, {}).get("units", {}).get("USD", []):
            if u.get("form") != "10-K" or u.get("fp") != "FY" or not u.get("start"):
                continue
            if u["end"] not in best or u["filed"] > best[u["end"]]["filed"]:
                best[u["end"]] = u
    return [(end, best[end]["val"]) for end in sorted(best)]


def revenue_growth(symbol: str) -> float | None:
    def fetch():
        cik = _cik(symbol)
        if not cik:
            return None
        facts = _get(FACTS_URL.format(cik=cik))["facts"].get("us-gaap", {})
        revs = annual_revenues(facts)
        if len(revs) < 2 or not revs[-2][1]:
            return None
        return revs[-1][1] / revs[-2][1] - 1
    value, _ = cache.get_or_fetch("edgar", f"growth:{symbol.upper()}", WEEK, fetch)
    return value
