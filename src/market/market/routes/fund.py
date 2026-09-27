"""GET /market/fund: a beginner "what is this?" explainer for an ETF, mutual fund or stock.

Every number in the response (expenseRatio, holdingsCount, topHoldings weights) comes straight
from yfinance. The model (Nova Micro, MarketFn's only Bedrock permission - see template.yaml)
is used for exactly one thing: rewriting the provider's business summary into one beginner
sentence. Guardrails reject anything that smells like it invented a number.
"""

import os
import re
from datetime import UTC, datetime

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, cache
from clearvest.errors import UpstreamError
from clearvest.providers import bedrock

from market.providers import yahoo
from market.routes.history import parse_symbols

router = Router()
TTL = 7 * 24 * 3600
DEFAULT_FUND_MODEL_ID = "us.amazon.nova-micro-v1:0"
MAX_SUMMARY_WORDS = 30
_FUND_KINDS = ("etf", "mutual_fund")
_NOUN = {"etf": "ETF", "mutual_fund": "mutual fund"}
_DIGIT_RE = re.compile(r"\d")

SYSTEM_PROMPT = (
    "Rewrite this fund description for a complete beginner in ONE sentence of at most 25 words. "
    "Plain words, no numbers, no percentages, no tickers, no advice. Then on a new line write "
    "TRACKS: <the exact index name as written in the text, or NONE>."
)


def _fund_template(symbol: str, kind: str, is_index: bool) -> str:
    noun = _NOUN.get(kind, "fund")
    phrase = f"index {noun}" if is_index else noun
    article = "an" if phrase[0].lower() in "aeiou" else "a"
    return f"{symbol} is {article} {phrase} that holds a basket of many investments in one."


def _stock_template(symbol: str) -> str:
    return f"{symbol} is one company's stock: owning a share means owning a small piece of that business."


def _template_summary(symbol: str, kind: str, is_index: bool) -> str:
    return _stock_template(symbol) if kind == "stock" else _fund_template(symbol, kind, is_index)


def _parse_reply(text: str) -> tuple[str, str | None]:
    """The model replies with the beginner sentence, then a `TRACKS: <name|NONE>` line."""
    sentence_lines: list[str] = []
    tracks = None
    for line in text.strip().splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.upper().startswith("TRACKS:"):
            tracks = stripped.split(":", 1)[1].strip()
        else:
            sentence_lines.append(stripped)
    if tracks and tracks.upper() == "NONE":
        tracks = None
    return " ".join(sentence_lines).strip(), tracks


def _sentence_ok(sentence: str) -> bool:
    if not sentence or _DIGIT_RE.search(sentence) or "%" in sentence:
        return False
    return len(sentence.split()) <= MAX_SUMMARY_WORDS


def _verbatim_tracks(tracks: str | None, source_text: str) -> str | None:
    """Only trust a tracked-index name the model could not have invented: it must appear,
    case-insensitively, verbatim in the provider's own text."""
    if not tracks or not source_text:
        return None
    return tracks if tracks.casefold() in source_text.casefold() else None


def _summarize(symbol: str, kind: str, is_index: bool, source_text: str) -> tuple[str, str, str | None]:
    template = _template_summary(symbol, kind, is_index)
    if not source_text:
        return template, "template", None
    model_id = os.environ.get("FUND_MODEL_ID", DEFAULT_FUND_MODEL_ID)
    user = f"```\n{source_text}\n```"
    try:
        reply = bedrock.converse(
            SYSTEM_PROMPT, [{"role": "user", "content": [{"text": user}]}], max_tokens=120, model_id=model_id,
        )
    except UpstreamError:
        return template, "template", None
    sentence, tracks_raw = _parse_reply(reply)
    if not _sentence_ok(sentence):
        return template, "template", None
    return sentence, "model", _verbatim_tracks(tracks_raw, source_text)


@router.get("/market/fund")
def get_fund():
    api.user_id(router)
    symbol = parse_symbols(router.current_event.get_query_string_value("symbol"), 1, 1)[0]

    def fetch():
        profile = yahoo.fund_profile(symbol)
        kind = profile["kind"]
        is_fund = kind in _FUND_KINDS
        name = profile["name"] or symbol
        description = profile["description"] or ""
        is_index = is_fund and "index" in f"{name} {description}".casefold()
        summary, summary_source, tracks = _summarize(symbol, kind, is_index, description)
        return {
            "symbol": symbol,
            "name": name,
            "kind": kind,
            "isIndexFund": is_index,
            "tracks": tracks,
            "expenseRatio": profile["expenseRatio"] if is_fund else None,
            "holdingsCount": profile["holdingsCount"] if is_fund else None,
            "topHoldings": profile["topHoldings"] if is_fund else [],
            "fundFamily": profile["fundFamily"],
            "category": profile["category"],
            "sector": profile["sector"],
            "summary": summary,
            "summarySource": summary_source,
            "fetchedAt": datetime.now(UTC).isoformat(),
        }

    value, stale = cache.get_or_fetch("fund", symbol, TTL, fetch)
    body = {key: val for key, val in value.items() if key != "fetchedAt"}
    body["asOf"] = value["fetchedAt"][:10]
    body["stale"] = stale
    return body
