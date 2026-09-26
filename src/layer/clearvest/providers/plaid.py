"""Plaid (sandbox by default). Access tokens never leave PortfolioFn."""

import os

from clearvest import config, http

BASE_URLS = {"sandbox": "https://sandbox.plaid.com", "production": "https://production.plaid.com"}
# Plaid's sandbox test institution that supports the investments product.
SANDBOX_INSTITUTION = "ins_109508"


def _post(path: str, body: dict) -> dict:
    base = BASE_URLS[os.environ.get("PLAID_ENV", "sandbox")]
    payload = {
        "client_id": config.get_secret("PLAID_CLIENT_ID_PARAM"),
        "secret": config.get_secret("PLAID_SECRET_PARAM"),
        **body,
    }
    return http.request_json("POST", f"{base}{path}", provider="plaid", json=payload, timeout=10)


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


def sandbox_public_token() -> str:
    resp = _post("/sandbox/public_token/create", {
        "institution_id": SANDBOX_INSTITUTION,
        "initial_products": ["investments"],
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
