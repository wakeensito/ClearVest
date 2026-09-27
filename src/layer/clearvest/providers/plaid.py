"""Plaid (sandbox by default). Access tokens never leave PortfolioFn."""

import json
import os

from clearvest import api, config, http
from clearvest.errors import UpstreamError

BASE_URLS = {"sandbox": "https://sandbox.plaid.com", "production": "https://production.plaid.com"}
# Plaid's sandbox test institution that supports the investments product.
SANDBOX_INSTITUTION = "ins_109508"
MAX_TIMEOUT = 25  # sandbox item creation alone can take 10-20s
DEADLINE_MARGIN = 2  # seconds kept back to write the response before the Lambda is killed
MIN_TIMEOUT = 3  # below this a call is more likely to time out than finish


def _post(path: str, body: dict) -> dict:
    # Timeout follows the invocation's deadline, not a fixed number, so sequential calls (sandbox
    # create -> exchange -> holdings) can't together outlive the Lambda. POSTs are never retried
    # by clearvest.http (urllib3's default allowed_methods), so a slow call is never doubled.
    timeout = min(MAX_TIMEOUT, api.remaining_seconds() - DEADLINE_MARGIN)
    if timeout < MIN_TIMEOUT:
        raise UpstreamError("plaid", "not enough time left in this request")
    base = BASE_URLS[os.environ.get("PLAID_ENV", "sandbox")]
    payload = {
        "client_id": config.get_secret("PLAID_CLIENT_ID_PARAM"),
        "secret": config.get_secret("PLAID_SECRET_PARAM"),
        **body,
    }
    return http.request_json("POST", f"{base}{path}", provider="plaid", json=payload, timeout=timeout)


def create_link_token(user_id: str) -> str:
    resp = _post("/link/token/create", {
        "user": {"client_user_id": user_id},
        "client_name": "ClearVest",
        "products": ["investments"],
        "country_codes": ["US"],
        "language": "en",
    })
    return resp["link_token"]


def exchange(public_token: str) -> tuple[str, str]:
    resp = _post("/item/public_token/exchange", {"public_token": public_token})
    return resp["item_id"], resp["access_token"]


# "Use a sample account" gets this portfolio instead of Plaid's default junk names. It overlaps
# on purpose (VOO, QQQ and VGT all hold Nvidia and Apple, which are also held directly) so
# look-through and the "Be the fund" lesson have something real to show. Prices are from
# 2026-09-26 and only need to be roughly right; Plaid keeps them as given.
SANDBOX_USER = "user_custom"
SANDBOX_HOLDINGS = [
    ("VOO", "Vanguard S&P 500 ETF", "etf", 15, 710.79),
    ("QQQ", "Invesco QQQ Trust", "etf", 6, 744.50),
    ("VGT", "Vanguard Information Technology ETF", "etf", 8, 126.17),
    ("NVDA", "NVIDIA Corp", "equity", 12, 225.07),
    ("AAPL", "Apple Inc", "equity", 10, 341.07),
]
SANDBOX_CASH = 1500


def sandbox_user_config() -> dict:
    """Plaid custom sandbox user (plaid.com/docs/sandbox/user-custom), sent as the password."""
    holdings = [{
        "quantity": quantity,
        "institution_price": price,
        "cost_basis": round(price * 0.85, 2),
        "currency": "USD",
        "security": {"ticker_symbol": symbol, "currency": "USD", "name": name, "type": kind},
    } for symbol, name, kind, quantity, price in SANDBOX_HOLDINGS]
    return {"override_accounts": [{
        "type": "investment", "subtype": "brokerage", "starting_balance": SANDBOX_CASH, "holdings": holdings,
    }]}


def sandbox_public_token() -> str:
    resp = _post("/sandbox/public_token/create", {
        "institution_id": SANDBOX_INSTITUTION,
        "initial_products": ["investments"],
        "options": {"override_username": SANDBOX_USER, "override_password": json.dumps(sandbox_user_config())},
    })
    return resp["public_token"]


def holdings(access_token: str) -> dict:
    return _post("/investments/holdings/get", {"access_token": access_token})


def normalize(raw_list: list[dict]) -> dict:
    """Merge holdings from every linked item into the contract's shape."""
    rows = []
    for raw in raw_list:
        securities = {s["security_id"]: s for s in raw.get("securities", [])}
        for h in raw.get("holdings", []):
            sec = securities.get(h["security_id"], {})
            is_cash = sec.get("is_cash_equivalent") or sec.get("type") == "cash"
            rows.append({
                "symbol": sec.get("ticker_symbol") or sec.get("name") or "UNKNOWN",
                "name": sec.get("name") or sec.get("ticker_symbol") or "Unknown security",
                "type": "cash" if is_cash else (sec.get("type") or "other"),
                "quantity": float(h.get("quantity") or 0),
                "price": float(h.get("institution_price") or 0),
                "value": float(h.get("institution_value") or 0),
            })
    total = round(sum(r["value"] for r in rows), 2)
    for r in rows:
        r["weight"] = round(r["value"] / total, 4) if total else 0.0
    rows.sort(key=lambda r: r["value"], reverse=True)
    return {"totalValue": total, "holdings": rows}
