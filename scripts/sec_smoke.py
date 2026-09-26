"""Smoke check for SEC EDGAR: ticker -> CIK -> XBRL facts, filings, full-text search.

Run: python scripts/sec_smoke.py [TICKER]
No API key. EDGAR returns 403 without a User-Agent that identifies you, so set
SEC_USER_AGENT in the environment or in a .env file at the repo root
(see .env.example). Limit: 10 requests/second.
"""

import os
import sys
from pathlib import Path

import requests

TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
FULLTEXT_URL = "https://efts.sec.gov/LATEST/search-index"
REVENUE_TAGS = ("Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax")


def user_agent() -> str:
    """Return SEC_USER_AGENT from the environment, falling back to the repo .env."""
    value = os.environ.get("SEC_USER_AGENT")
    if value:
        return value
    env_file = Path(__file__).resolve().parents[1] / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("SEC_USER_AGENT="):
                return line.split("=", 1)[1].strip().strip("'\"")
    sys.exit("SEC_USER_AGENT is not set. Copy .env.example to .env and fill it in.")


def get_json(session: requests.Session, url: str, params: dict | None = None) -> dict:
    """GET a JSON document, raising requests.HTTPError on any non-2xx status."""
    response = session.get(url, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def latest_annual(facts: dict, tags: tuple[str, ...]) -> dict | None:
    """Latest full-year 10-K value across several XBRL tags.

    Companies switch tags over time (Apple used Revenues through 2018, then
    RevenueFromContractWithCustomerExcludingAssessedTax), and later 10-Ks
    restate prior years, so pick by latest period end, then latest filing date.
    """
    candidates = [
        {**u, "tag": tag}
        for tag in tags
        if tag in facts
        for u in facts[tag]["units"].get("USD", [])
        if u.get("form") == "10-K" and u.get("fp") == "FY" and u.get("start")
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda u: (u["end"], u["filed"]))


def main(symbol: str) -> int:
    """Resolve the ticker and print latest FY revenue, latest 10-K, and a full-text hit count."""
    session = requests.Session()
    session.headers.update({"User-Agent": user_agent(), "Accept-Encoding": "gzip, deflate"})
    try:
        return check(session, symbol)
    except requests.HTTPError as err:
        status = err.response.status_code
        hint = " (EDGAR rejected the User-Agent; check SEC_USER_AGENT)" if status == 403 else ""
        print(f"{symbol}: HTTP {status} from {err.request.url}{hint}")
    except requests.RequestException as err:
        print(f"{symbol}: request failed: {err}")
    return 1


def check(session: requests.Session, symbol: str) -> int:
    """Run the four EDGAR calls for one ticker. Network errors propagate to main()."""
    tickers = get_json(session, TICKERS_URL)
    match = next((row for row in tickers.values() if row["ticker"] == symbol), None)
    if match is None:
        print(f"{symbol}: not in SEC ticker list")
        return 1
    cik = f"{match['cik_str']:010d}"
    print(f"{symbol}: CIK {cik} ({match['title']})")

    facts = get_json(session, FACTS_URL.format(cik=cik))["facts"].get("us-gaap", {})
    latest = latest_annual(facts, REVENUE_TAGS)
    if latest:
        print(f"{symbol}: FY revenue ending {latest['end']}: {latest['val']:,} USD ({latest['tag']})")

    recent = get_json(session, SUBMISSIONS_URL.format(cik=cik))["filings"]["recent"]
    if "10-K" in recent["form"]:
        i = recent["form"].index("10-K")
        print(f"{symbol}: latest 10-K filed {recent['filingDate'][i]}, doc {recent['primaryDocument'][i]}")

    hits = get_json(session, FULLTEXT_URL, {"q": '"supply chain"', "forms": "10-K", "ciks": cik})
    print(f"{symbol}: 10-K full-text hits for \"supply chain\": {hits['hits']['total']['value']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "NVDA"))
