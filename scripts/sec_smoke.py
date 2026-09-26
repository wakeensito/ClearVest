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


def main(symbol: str) -> int:
    """Resolve the ticker and print latest FY revenue, latest 10-K, and a full-text hit count."""
    session = requests.Session()
    session.headers.update({"User-Agent": user_agent(), "Accept-Encoding": "gzip, deflate"})

    tickers = session.get(TICKERS_URL, timeout=30).json()
    match = next((row for row in tickers.values() if row["ticker"] == symbol), None)
    if match is None:
        print(f"{symbol}: not in SEC ticker list")
        return 1
    cik = f"{match['cik_str']:010d}"
    print(f"{symbol}: CIK {cik} ({match['title']})")

    facts = session.get(FACTS_URL.format(cik=cik), timeout=30).json()["facts"].get("us-gaap", {})
    tag = next((t for t in REVENUE_TAGS if t in facts), None)
    if tag:
        annual = [u for u in facts[tag]["units"]["USD"] if u.get("form") == "10-K" and u.get("fp") == "FY"]
        if annual:
            latest = annual[-1]
            print(f"{symbol}: FY revenue ending {latest['end']}: {latest['val']:,} USD ({tag})")

    recent = session.get(SUBMISSIONS_URL.format(cik=cik), timeout=30).json()["filings"]["recent"]
    if "10-K" in recent["form"]:
        i = recent["form"].index("10-K")
        print(f"{symbol}: latest 10-K filed {recent['filingDate'][i]}, doc {recent['primaryDocument'][i]}")

    hits = session.get(
        FULLTEXT_URL, params={"q": '"supply chain"', "forms": "10-K", "ciks": cik}, timeout=30
    ).json()
    print(f"{symbol}: 10-K full-text hits for \"supply chain\": {hits['hits']['total']['value']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "NVDA"))
