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
# A number the sentence is allowed to use only if that exact digit run also appears in the
# provider's own text (e.g. "500" in "...tracks the Standard & Poor's 500 Index..." is fine;
# an invented "0.03" or "2" is not). "%" is always rejected outright - a beginner sentence
# never needs one, and it's the easiest signal that a number got smuggled in.
# `[.,]\d+` (not `[.,]*`) so a comma/period that's just sentence punctuation after the number
# ("...the S&P 500, a group...") isn't swept into the token; only digit groups actually joined
# by a separator ("1,000.50") count as one number.
_NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)*")
_FUND_WORD_RE = re.compile(r"\bfund\b", re.IGNORECASE)
_TRACKS_RE = re.compile(r"TRACKS\s*:\s*(.+)", re.IGNORECASE)
_TRACKS_STRIP_CHARS = "\"'‘’“”.,;:!? "

FUND_SYSTEM_PROMPT = (
    "Rewrite this fund description for a complete beginner in ONE sentence of at most 25 words. "
    "Plain words, no numbers, no percentages, no tickers, no advice. Then on a new line write "
    "TRACKS: <the exact index name as written in the text, or NONE>."
)
STOCK_SYSTEM_PROMPT = (
    "In ONE sentence of at most 25 words, say what this company sells or does, for a complete "
    "beginner. Plain words, no numbers, no advice."
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


def _clean_tracks(raw: str) -> str | None:
    value = raw.strip().strip(_TRACKS_STRIP_CHARS)
    if not value or value.upper() == "NONE":
        return None
    return value


def _parse_reply(text: str) -> tuple[str, str | None]:
    """The model replies with the beginner sentence, then (for funds) a `TRACKS: <name|NONE>`
    marker. In practice it doesn't reliably put TRACKS on its own line - it can trail the
    sentence on the same line - so this searches the whole reply rather than line-by-line, and
    treats everything before the marker as the sentence."""
    match = _TRACKS_RE.search(text)
    tracks = _clean_tracks(match.group(1)) if match else None
    sentence_part = text[: match.start()] if match else text
    sentence = " ".join(line.strip() for line in sentence_part.strip().splitlines() if line.strip())
    return sentence, tracks


def _numbers_are_verbatim(sentence: str, source_text: str) -> bool:
    """Every number the sentence uses must be a digit run that also appears in the provider's
    own text - lets a sentence say "...tracks the S&P 500..." (real index name) but rejects one
    that invents a figure ("charges 0.03%", "up 2%") the provider text never stated."""
    return all(token in source_text for token in _NUMBER_RE.findall(sentence))


def _sentence_ok(sentence: str, source_text: str) -> bool:
    if not sentence or "%" in sentence:
        return False
    if len(sentence.split()) > MAX_SUMMARY_WORDS:
        return False
    return _numbers_are_verbatim(sentence, source_text)


def _verbatim_tracks(tracks: str | None, source_text: str) -> str | None:
    """Only trust a tracked-index name the model could not have invented: it must appear,
    case-insensitively, verbatim in the provider's own text. Validated independently of the
    sentence guardrail below, so a real tracked index still surfaces even when the sentence
    itself gets rejected and falls back to the template."""
    if not tracks or not source_text:
        return None
    return tracks if tracks.casefold() in source_text.casefold() else None


def _summarize(symbol: str, kind: str, is_index: bool, source_text: str) -> tuple[str, str, str | None]:
    is_stock = kind == "stock"
    template = _template_summary(symbol, kind, is_index)
    if not source_text:
        return template, "template", None
    model_id = os.environ.get("FUND_MODEL_ID", DEFAULT_FUND_MODEL_ID)
    system_prompt = STOCK_SYSTEM_PROMPT if is_stock else FUND_SYSTEM_PROMPT
    user = f"```\n{source_text}\n```"
    try:
        reply = bedrock.converse(
            system_prompt, [{"role": "user", "content": [{"text": user}]}], max_tokens=120, model_id=model_id,
        )
    except UpstreamError:
        return template, "template", None

    sentence, tracks_raw = _parse_reply(reply)
    tracks = None if is_stock else _verbatim_tracks(tracks_raw, source_text)

    ok = _sentence_ok(sentence, source_text)
    if is_stock and ok and _mentions_fund(sentence):
        ok = False  # a stock explainer that says "fund" almost certainly reused the fund prompt's wording
    if not ok:
        return template, "template", tracks
    return sentence, "model", tracks


def _mentions_fund(sentence: str) -> bool:
    return bool(_FUND_WORD_RE.search(sentence))


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
