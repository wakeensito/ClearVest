"""Bedrock Converse on Nova. The model id is an env var (a cross-region inference profile)."""

import os
import re

from botocore.exceptions import BotoCoreError, ClientError

from clearvest import aws
from clearvest.errors import UpstreamError

_LIST_ITEM_RE = re.compile(r"^\s*(?:[-*+]|\d+\.)\s+")
_SENTENCE_ENDS = (".", "!", "?")


def _trim_truncated(text: str) -> str:
    """A maxTokens cutoff can land mid-word, mid-sentence, or mid-table-row. Cut to the last complete unit."""
    lines = text.split("\n")
    while lines and not lines[-1].strip():
        lines.pop()
    if not lines:
        raise UpstreamError("bedrock", "truncated reply was empty")
    last = lines[-1].rstrip()
    is_table_row = last.endswith("|")
    is_list_item = bool(_LIST_ITEM_RE.match(lines[-1]))
    if not is_table_row and not is_list_item:
        cut = max(last.rfind(c) for c in _SENTENCE_ENDS)
        if cut == -1:
            lines.pop()
        else:
            lines[-1] = last[: cut + 1]
    trimmed = "\n".join(lines).rstrip()
    if not trimmed:
        raise UpstreamError("bedrock", "truncated reply was empty after trimming")
    return trimmed


def converse(system: str, messages: list[dict], max_tokens: int = 600) -> str:
    try:
        resp = aws.bedrock().converse(
            modelId=os.environ["MODEL_ID"],
            system=[{"text": system}],
            messages=messages,
            inferenceConfig={"maxTokens": max_tokens, "temperature": 0.3},
        )
        text = resp["output"]["message"]["content"][0]["text"].strip()
        stop_reason = resp.get("stopReason")
    except (ClientError, BotoCoreError, KeyError, IndexError) as err:
        raise UpstreamError("bedrock", f"{type(err).__name__}: {err}") from err
    if not text:
        raise UpstreamError("bedrock", "empty response")
    if stop_reason == "max_tokens":
        text = _trim_truncated(text)
    return text
