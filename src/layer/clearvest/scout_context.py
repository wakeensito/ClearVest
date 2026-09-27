"""Small, validated screen identifiers; financial facts are always retrieved server-side."""

import json
import math
import time
from datetime import UTC, date, datetime
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, StrictInt, model_validator

from clearvest import db, exposure

SYMBOL = r"^[A-Z0-9.^-]{1,12}$"


class Scenario(BaseModel):
    model_config = ConfigDict(extra="forbid")
    symbol: str = Field(pattern=SYMBOL)
    dropPct: StrictInt = Field(ge=0, le=60)


class PageContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page: Literal["home", "portfolio", "markets", "learn", "advisor"]
    symbol: str | None = Field(default=None, pattern=SYMBOL)
    range: Literal["1y", "5y", "10y"] | None = None
    lessonId: str | None = Field(default=None, pattern=r"^[a-z0-9-]{1,60}$")
    metric: Literal["business", "revenue", "profit", "valuation", "risk", "price", "exposure", "holding"] | None = None
    scenario: Scenario | None = None
    priceDate: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")

    @model_validator(mode="after")
    def validate_selection(self):
        if self.priceDate:
            date.fromisoformat(self.priceDate)
            if not self.symbol or not self.range or self.metric != "price" or self.scenario or self.lessonId:
                raise ValueError("A price observation needs a symbol, range and price metric only")
        return self


def scenario_result(holdings: dict | None, scenario: Scenario) -> dict | None:
    """A price-shock illustration, not a forecast, allocation recommendation or risk score."""
    if not holdings:
        return None
    rows = holdings["holdings"]
    total = holdings["totalValue"]
    if (not math.isfinite(total) or total <= 0 or any(
            not math.isfinite(h["value"]) or h["value"] < 0 or h["type"] == "derivative" for h in rows)):
        return None
    selected = [h for h in rows if h["symbol"] == scenario.symbol and h["type"] != "cash"]
    value = sum(Decimal(str(h["value"])) for h in selected)
    if not selected or value <= 0 or value > Decimal(str(total)):
        return None
    loss = (value * Decimal(scenario.dropPct) / 100).quantize(Decimal(".01"), rounding=ROUND_HALF_UP)
    after = (Decimal(str(total)) - loss).quantize(Decimal(".01"), rounding=ROUND_HALF_UP)
    return {"symbol": scenario.symbol, "dropPct": scenario.dropPct, "loss": float(loss),
            "after": float(after), "before": total, "positionValue": float(value),
            "portfolioDropPct": float(loss / Decimal(str(total)) * 100), "asOf": holdings["asOf"]}


def _fresh(key: str, provider: str = "fmp") -> dict | None:
    row = db.get(f"CACHE#{provider}", key)
    return row["value"] if row and row.get("expiresAt", 0) > time.time() else None


def _web_url(value: str) -> bool:
    try:
        parsed = urlsplit(value)
        return parsed.scheme in {"https", "http"} and bool(parsed.hostname) and not parsed.username and not parsed.password
    except (ValueError, TypeError):
        return False


def evidence(context: PageContext | None, holdings: dict | None) -> list[dict]:
    if context is None:
        return []
    if context.metric == "exposure":
        return exposure.evidence(holdings, context.symbol)
    sources = []
    if context.metric == "holding":
        rows = [h for h in (holdings or {}).get("holdings", []) if h["symbol"] == context.symbol]
        if rows:
            sources.append({"label": f"{context.symbol} · saved holding", "kind": "portfolio", "asOf": holdings["asOf"],
                            "text": json.dumps(rows, default=str) + ". Saved account holdings, not a live price or a recommendation."})
        return sources
    if context.priceDate:
        row = db.get("CACHE#history", f"{context.symbol}:{context.range}")
        if row and row.get("expiresAt", 0) > time.time():
            point = next((p for p in row.get("value", []) if p[0] == context.priceDate), None)
            if point and math.isfinite(point[1]) and point[1] > 0:
                sources.append({"label": f"{context.symbol} · closing price on {context.priceDate}", "kind": "price",
                                "asOf": context.priceDate,
                                "retrievedAt": datetime.fromtimestamp(row["fetchedAt"], UTC).isoformat(),
                                "text": f"Selected observation: {context.symbol} closed at {point[1]:.4f} on {context.priceDate}. "
                                        "Security quote currency; not portfolio value. This observation alone cannot explain why the price moved. "
                                        "Saved price-history pipeline snapshot; individual provider provenance is not recorded. Not a forecast."})
        # Never substitute the latest close when the requested observation is missing.
        return sources
    if context.scenario:
        result = scenario_result(holdings, context.scenario)
        if result:
            sources.append({"label": "Calculated portfolio scenario", "asOf": result["asOf"], "kind": "scenario",
                            "text": (f"Hypothetical {result['dropPct']}% price fall in {result['symbol']}. "
                                     f"Position value {result['positionValue']:.2f}; portfolio before {result['before']:.2f}; "
                                     f"loss {result['loss']:.2f}; portfolio after {result['after']:.2f}; "
                                     f"portfolio decline {result['portfolioDropPct']:.2f}%. "
                                     "All other holdings unchanged. Same portfolio currency. No trades, taxes, fees, "
                                     "dividends or correlations modeled. Not a prediction or a new risk score.")})
        # A missing/unsupported scenario must not silently fall back to unrelated facts.
        return sources
    if context.lessonId:
        lessons = json.loads((Path(__file__).parent / "data" / "scout_lessons.json").read_text())
        lesson = lessons.get(context.lessonId)
        if lesson:
            sources.append({"label": lesson["title"], "asOf": "ClearVest Learn", "kind": "lesson",
                            "url": f"/learn/{context.lessonId}",
                            "text": "\n".join(f"{c['heading']}: {c['body']} {c.get('example', '')}" for c in lesson["cards"])})
    if not context.symbol:
        return sources
    symbol = context.symbol
    if context.range:
        row = db.get("CACHE#history", f"{symbol}:{context.range}")
        if row and row.get("expiresAt", 0) > time.time() and row.get("value"):
            points = row["value"]
            first, last = points[0], points[-1]
            if first[1] > 0 and all(math.isfinite(p[1]) for p in [first, last]):
                change = (last[1] / first[1] - 1) * 100
                sources.append({"label": f"{symbol} · saved {context.range} price history", "kind": "price",
                                "asOf": datetime.fromtimestamp(row["fetchedAt"], UTC).isoformat(),
                                "text": f"First available close: {first[1]:.4f} on {first[0]}. Last available close: {last[1]:.4f} on {last[0]}. "
                                        f"Price change between these observations: {change:.2f}%. "
                                        "Security quote currency; not account performance, total return, an explanation of causation, or a forecast. "
                                        "Snapshot is from ClearVest's price-history pipeline; individual provider provenance is not recorded."})
    for section in ["profile", "income", "valuation"]:
        row = _fresh(f"research:v2:{symbol}:{section}")
        if not row or not row.get("value"):
            continue
        value = row["value"]
        if section == "income":
            facts_text = "\n".join(
                f"FY {v['year']}, period ended {v['date']}, currency {v.get('currency') or 'unavailable'}: "
                f"sales {v.get('revenue')}; net profit {v.get('netIncome')}; diluted earnings per share {v.get('epsDiluted')}."
                for v in value[:2])
        elif section == "profile":
            facts_text = f"{value['name']}. {value.get('description') or ''} Sector: {value.get('sector') or 'unavailable'}."
        else:
            facts_text = f"Trailing twelve-month P/E: {value.get('pe')}; earnings per share: {value.get('eps')}; price/sales: {value.get('ps')}; dividend yield (fraction): {value.get('dividendYield')}. A nonpositive P/E is not a meaningful positive earnings multiple."
        sources.append({"label": f"{symbol} · FMP {section}", "asOf": row["fetchedAt"], "kind": "company",
                        "text": f"Retrieved {row['fetchedAt']}; retrieval time is not the fiscal period. Missing/None values are unavailable, not zero.\n" + facts_text})
    news = _fresh(f"news:{symbol}", "yahoo")
    if news:
        for article in news.get("articles", [])[:3]:
            if article.get("symbol") != symbol or not _web_url(article.get("url")):
                continue
            sources.append({"label": f"{article['publisher']} · {article['title'][:180]}",
                            "asOf": article.get("publishedAt") or "Publication date unavailable",
                            "retrievedAt": news["fetchedAt"], "kind": "news", "url": article["url"],
                            "text": f"Publisher headline only; full article was not retrieved. {article['title'][:500]}. "
                                    f"Published {article.get('publishedAt') or 'date unknown'}; retrieved {news['fetchedAt']}. "
                                    "A headline does not prove future returns or an effect on a portfolio."})
    return sources
