"""Bedrock Converse on Nova. The model id is an env var (a cross-region inference profile)."""

import os
import re

from botocore.exceptions import BotoCoreError, ClientError

from clearvest import api, aws
from clearvest.errors import UpstreamError
from clearvest.providers import guardrails

_LIST_ITEM_RE = re.compile(r"^\s*(?:[-*+]|\d+\.)\s+")
_DELIM_CHARS_RE = re.compile(r"^[\s|:-]+$")
_SENTENCE_ENDS = (".", "!", "?")


def _is_table_delimiter(line: str) -> bool:
    """A GFM header separator row, e.g. '| --- | --- |'."""
    return bool(_DELIM_CHARS_RE.match(line)) and "-" in line and "|" in line


def _trim_truncated(text: str) -> str:
    """A maxTokens cutoff can land mid-word, mid-sentence, mid-table-row, or mid-bold-span. Cut to the
    last complete unit."""
    lines = text.split("\n")
    while lines and not lines[-1].strip():
        lines.pop()
    if not lines:
        raise UpstreamError("bedrock", "truncated reply was empty")
    last = lines[-1].rstrip()
    is_table_row = last.endswith("|")
    is_list_item = bool(_LIST_ITEM_RE.match(lines[-1]))
    # A list item or table row with an odd number of "**" has an unterminated bold span: it only
    # looks complete. Treat it the same as an unfinished paragraph.
    balanced_bold = last.count("**") % 2 == 0
    if not ((is_table_row or is_list_item) and balanced_bold):
        cut = max(last.rfind(c) for c in _SENTENCE_ENDS)
        if cut == -1:
            lines.pop()
        else:
            lines[-1] = last[: cut + 1]
    # A table header + delimiter with zero surviving body rows isn't a table at all: drop it too.
    while lines:
        while lines and not lines[-1].strip():
            lines.pop()
        if len(lines) >= 2 and _is_table_delimiter(lines[-1]) and "|" in lines[-2]:
            lines.pop()
            lines.pop()
            continue
        break
    trimmed = "\n".join(lines).rstrip()
    if not trimmed:
        raise UpstreamError("bedrock", "truncated reply was empty after trimming")
    return trimmed


def converse(system: str, messages: list[dict], max_tokens: int = 600, model_id: str | None = None) -> str:
    policy = guardrails.config()
    timeout = int(os.environ.get("BEDROCK_READ_TIMEOUT", "12"))
    attempts = int(os.environ.get("BEDROCK_MAX_ATTEMPTS", "2"))
    if api.remaining_seconds() < (timeout + 3) * attempts + 1:
        raise UpstreamError("bedrock", "insufficient time for guarded inference")
    try:
        resp = aws.bedrock().converse(
            modelId=model_id or os.environ["MODEL_ID"],
            guardrailConfig={**policy, "trace": "disabled"},
            system=[{"text": system}],
            # Explicit guard_content also enables prompt-attack evaluation on user text.
            messages=[{**m, "content": [
                {"guardContent": {"text": {"text": block["text"], "qualifiers": ["guard_content"]}}}
                if "text" in block else block for block in m["content"]
            ]} for m in messages],
            inferenceConfig={"maxTokens": max_tokens, "temperature": 0.3},
        )
        if resp.get("stopReason") in {"guardrail_intervened", "content_filtered"}:
            raise guardrails.Intervention()
        text = "\n".join(block["text"] for block in resp["output"]["message"]["content"] if "text" in block).strip()
        stop_reason = resp.get("stopReason")
    except (ClientError, BotoCoreError, KeyError, IndexError) as err:
        raise UpstreamError("bedrock", type(err).__name__) from err
    if not text:
        raise UpstreamError("bedrock", "empty response")
    if stop_reason == "max_tokens":
        text = _trim_truncated(text)
    return text
