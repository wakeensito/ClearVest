"""Bedrock Converse on Nova. The model id is an env var (a cross-region inference profile)."""

import os

from botocore.exceptions import BotoCoreError, ClientError

from clearvest import aws
from clearvest.errors import UpstreamError


def converse(system: str, messages: list[dict], max_tokens: int = 600) -> str:
    try:
        resp = aws.bedrock().converse(
            modelId=os.environ["MODEL_ID"],
            system=[{"text": system}],
            messages=messages,
            inferenceConfig={"maxTokens": max_tokens, "temperature": 0.3},
        )
        text = resp["output"]["message"]["content"][0]["text"].strip()
    except (ClientError, BotoCoreError, KeyError, IndexError) as err:
        raise UpstreamError("bedrock", f"{type(err).__name__}: {err}") from err
    if not text:
        raise UpstreamError("bedrock", "empty response")
    return text
