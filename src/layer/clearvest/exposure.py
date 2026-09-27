"""One-level, source-backed fund exposure. Never infer constituents or rescale partial lists."""

import json
import math
import re
import time
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal

from clearvest import db
from clearvest.errors import UpstreamError

SYMBOL = re.compile(r"^[A-Z0-9.^-]{1,12}$")
FUND_TYPES = {"etf", "mutual fund", "mutual_fund", "fund"}
CACHE_PREFIX = "fund-holdings:v1:"
MAX_SOURCE_AGE_DAYS = 35
MAX_ROWS = 1000
SOURCE_URL = "https://site.financialmodelingprep.com/developer/docs/stable/holdings"


def _number(value):
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


def _day(value):
    try:
        return datetime.fromisoformat(value).date() if isinstance(value, str) else None
    except ValueError:
        return None


def normalize_fund(symbol: str, rows: list) -> dict:
    """FMP percentages are 0..100, not fractional weights. updatedAt is NOT a filing date."""
    if not isinstance(rows, list) or not rows:
        raise UpstreamError("fmp", "fund holdings unavailable")
    valid, seen, total, dates = [], set(), Decimal(0), []
    today = datetime.now(UTC).date()
    for row in rows:
        if not isinstance(row, dict) or row.get("symbol") != symbol:
            raise UpstreamError("fmp", "fund holdings symbol mismatch")
        weight = row.get("weightPercentage")
        if not _number(weight):
            continue
        if not 0 <= weight <= 100:
            raise UpstreamError("fmp", "unsupported fund weights")
        total += Decimal(str(weight))
        asset, name = row.get("asset"), row.get("name")
        day = _day(row.get("updatedAt"))
        if (
            weight == 0
            or not isinstance(asset, str)
            or not SYMBOL.fullmatch(asset)
            or not isinstance(name, str)
            or not name.strip()
            or not day
            or day > today
        ):
            continue
        if asset in seen:
            raise UpstreamError("fmp", "ambiguous duplicate fund holding")
        seen.add(asset)
        isin = row.get("isin")
        valid.append(
            {
                "symbol": asset,
                "name": name.strip()[:160],
                "weightPct": weight,
                "isin": isin
                if isinstance(isin, str)
                and re.fullmatch(r"[A-Z]{2}[A-Z0-9]{9}[0-9]", isin)
                else None,
                "day": day.isoformat(),
            }
        )
        dates.append(day)
    if total > Decimal("100.000001") or not valid:
        raise UpstreamError("fmp", "unusable fund weights")
    # Do not mix rows from different snapshot days; omissions remain unmapped.
    latest = max(dates).isoformat()
    valid = sorted(
        (r for r in valid if r["day"] == latest), key=lambda r: -r["weightPct"]
    )[:MAX_ROWS]
    bounded, encoded_size = [], 0
    for row in valid:
        del row["day"]
        # DynamoDB stores escaped JSON; non-ASCII names can exceed the item limit
        # even below MAX_ROWS. Truncated tails must remain unmapped.
        encoded_size += len(json.dumps(row).encode("utf-8")) + 2
        if encoded_size > 300_000:
            break
        bounded.append(row)
    valid = bounded
    return {
        "symbol": symbol,
        "provider": "FMP",
        "providerUpdatedAt": latest,
        "fetchedAt": datetime.now(UTC).isoformat(),
        "sourceUrl": SOURCE_URL,
        "coveragePct": float(sum(Decimal(str(r["weightPct"])) for r in valid)),
        "holdings": valid,
    }


def _money(value):
    return float(value.quantize(Decimal(".01"), rounding=ROUND_HALF_UP))


def analyze(holdings: dict) -> dict:
    """Read only server caches; callers never supply fund weights. Decimal arithmetic before display rounding."""
    total, positions = holdings["totalValue"], holdings["holdings"]
    result = {
        "asOf": holdings["asOf"],
        "totalValue": total if _number(total) else 0,
        "status": "unsupported",
        "mappedPct": 0,
        "unmappedValue": total if _number(total) else 0,
        "cashValue": 0,
        "overlapCount": 0,
        "exposures": [],
        "funds": [],
    }
    if (
        not _number(total)
        or total <= 0
        or any(
            not _number(h["value"]) or h["value"] < 0 or h["type"] == "derivative"
            for h in positions
        )
    ):
        return result
    value_sum = sum(Decimal(str(h["value"])) for h in positions)
    total = Decimal(str(total))
    if abs(value_sum - total) > Decimal(".01"):
        return result
    fund_values, direct, names, snapshots, identities = {}, {}, {}, {}, {}
    cash = Decimal(0)
    for h in positions:
        symbol, value = h["symbol"], Decimal(str(h["value"]))
        if value == 0:
            continue
        if h["type"] == "cash":
            cash += value
        elif h["type"] in FUND_TYPES:
            fund_values[symbol] = fund_values.get(symbol, Decimal(0)) + value
        elif h["type"] == "equity" and SYMBOL.fullmatch(symbol):
            direct[symbol] = direct.get(symbol, Decimal(0)) + value
            names[symbol] = h["name"]
    today = datetime.now(UTC).date()
    for symbol, position_value in fund_values.items():
        row = db.get("CACHE#fmp", CACHE_PREFIX + symbol, consistent=True)
        data = row["value"] if row else None
        day = _day(data.get("providerUpdatedAt")) if data else None
        usable = (
            row
            and row.get("expiresAt", 0) > time.time()
            and day
            and 0 <= (today - day).days <= MAX_SOURCE_AGE_DAYS
        )
        state = "unavailable" if not data else "outdated" if not usable else "available"
        source = {
            "symbol": symbol,
            "status": state,
            "positionValue": float(position_value),
            "coveragePct": 0,
            "providerUpdatedAt": data.get("providerUpdatedAt") if data else None,
            "fetchedAt": data.get("fetchedAt") if data else None,
            "sourceUrl": SOURCE_URL,
        }
        result["funds"].append(source)
        if not usable:
            continue
        snapshots[symbol] = data
        for holding in data["holdings"]:
            if holding["isin"]:
                identities.setdefault(holding["symbol"], set()).add(holding["isin"])
    exposures = {}

    def add(symbol, name, value, via, fund_weight=None):
        item = exposures.setdefault(
            symbol,
            {
                "symbol": symbol,
                "name": name,
                "direct": Decimal(0),
                "indirect": Decimal(0),
                "paths": [],
            },
        )
        item["direct" if via is None else "indirect"] += value
        item["paths"].append(
            {
                "via": via,
                "value": _money(value),
                "weightPct": float(value / total * 100),
                "fundWeightPct": fund_weight,
            }
        )

    for symbol, value in direct.items():
        add(symbol, names[symbol], value, None)
    mapped = cash + sum(direct.values(), Decimal(0))
    for source in result["funds"]:
        symbol = source["symbol"]
        if symbol not in snapshots:
            continue
        coverage = Decimal(0)
        for holding in snapshots[symbol]["holdings"]:
            asset = holding["symbol"]
            # Never merge conflicting security IDs or look through a known nested fund as a company.
            if asset in fund_values or len(identities.get(asset, set())) > 1:
                continue
            weight = Decimal(str(holding["weightPct"]))
            value = fund_values[symbol] * weight / 100
            coverage += weight
            mapped += value
            add(asset, holding["name"], value, symbol, holding["weightPct"])
        source["coveragePct"] = float(coverage)
        source["status"] = "available" if coverage >= Decimal("99.99") else "partial"
    for item in exposures.values():
        value = item["direct"] + item["indirect"]
        item.update(
            value=_money(value),
            weightPct=float(value / total * 100),
            directValue=_money(item.pop("direct")),
            fundValue=_money(item.pop("indirect")),
            overlap=len(item["paths"]) > 1,
        )
    ordered = sorted(exposures.values(), key=lambda x: -x["value"])
    mapped = min(
        mapped, total
    )  # Sub-cent rounding in provider totals must never create negative missing coverage.
    result.update(
        status="ready",
        mappedPct=float(mapped / total * 100),
        unmappedValue=_money(total - mapped),
        cashValue=_money(cash),
        overlapCount=sum(x["overlap"] for x in ordered),
        exposures=ordered,
    )
    return result


def evidence(holdings: dict | None, symbol: str | None = None) -> list[dict]:
    if not holdings:
        return []
    result = analyze(holdings)
    if result["status"] != "ready":
        return []
    rows = [r for r in result["exposures"] if not symbol or r["symbol"] == symbol][:12]
    if not rows:
        return []
    text = [
        f"Saved portfolio total {result['totalValue']:.2f}; {result['mappedPct']:.2f}% mapped, {result['unmappedValue']:.2f} unmapped; cash {result['cashValue']:.2f}.",
        "One level of reported fund holdings, matched by exact security ticker. Share classes not consolidated. Underlying assets are not all guaranteed to be operating companies. No trades or return predictions. Missing exposure is unknown, not zero. Amounts use the portfolio currency; dates may differ.",
    ]
    for row in rows:
        paths = "; ".join(
            f"{p['via'] or 'direct'}: {p['value']:.2f}"
            + (f" ({p['fundWeightPct']:.4f}% of fund)" if p["via"] else "")
            for p in row["paths"]
        )
        text.append(
            f"{row['symbol']} {row['name']}: {row['weightPct']:.4f}% of portfolio, {row['value']:.2f} total. {paths}."
        )
    for fund in result["funds"]:
        text.append(
            f"{fund['symbol']}: {fund['status']}, {fund['coveragePct']:.4f}% of fund mapped; FMP provider updated {fund['providerUpdatedAt']}, retrieved {fund['fetchedAt']}. Provider update date is not a filing date."
        )
    return [
        {
            "kind": "exposure",
            "label": "Calculated ownership and fund overlap",
            "asOf": holdings["asOf"],
            "text": "\n".join(text),
        }
    ]
