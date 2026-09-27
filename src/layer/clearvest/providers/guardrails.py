"""Fail-closed Bedrock policies. Never log assessments: they can contain matched PII."""

import math
import os

from botocore.exceptions import BotoCoreError, ClientError

from clearvest import api, aws
from clearvest.errors import UpstreamError


class Intervention(Exception):
    """A policy withheld content; distinct from a provider outage."""


class Ungrounded(Intervention):
    """A standalone answer could not be supported by its supplied source."""


def config(prefix: str = "ADVISOR") -> dict:
    identifier = os.environ.get(f"{prefix}_GUARDRAIL_ID", "")
    version = os.environ.get(f"{prefix}_GUARDRAIL_VERSION", "")
    if not identifier or not version.isdigit() or int(version) < 1:
        raise UpstreamError("bedrock", "published guardrail configuration unavailable")
    return {"guardrailIdentifier": identifier, "guardrailVersion": version}


def _apply(source: str, content: list[dict], prefix: str = "ADVISOR") -> dict:
    settings = config(prefix)
    if api.remaining_seconds() < 5:
        raise UpstreamError("bedrock", "insufficient time for safety check")
    try:
        result = aws.guardrails().apply_guardrail(
            **settings, source=source, content=content,
            # Successful grounding assessments must be present too, not only interventions.
            outputScope="FULL" if prefix == "GROUNDING" else "INTERVENTIONS",
        )
    except (ClientError, BotoCoreError) as err:
        # Provider error messages can echo request data. Keep only the exception type.
        raise UpstreamError("bedrock", f"guardrail unavailable: {type(err).__name__}") from err
    if result.get("action") not in {"NONE", "GUARDRAIL_INTERVENED"}:
        raise UpstreamError("bedrock", "invalid guardrail response")
    return result


def _actions(value):
    if isinstance(value, dict):
        if "action" in value:
            yield value["action"]
        for nested in value.values():
            yield from _actions(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from _actions(nested)


def mask_input(text: str) -> str:
    """Screen the question before inference or persistence; only accept explicit masking."""
    result = _apply("INPUT", [{"text": {"text": text}}])
    if result["action"] == "NONE":
        return text
    actions = set(_actions(result.get("assessments", [])))
    if actions and "ANONYMIZED" in actions and actions <= {"ANONYMIZED", "NONE"}:
        masked = "\n".join(item.get("text", "") for item in result.get("outputs", [])).strip()
        if masked:
            return masked
    raise Intervention()


def check_grounding(reference: str, question: str, reply: str) -> None:
    """Source-based single-turn QA only; do not use this to certify conversational chat."""
    result = _apply("OUTPUT", [
        {"text": {"text": reference, "qualifiers": ["grounding_source"]}},
        {"text": {"text": question, "qualifiers": ["query"]}},
        {"text": {"text": reply, "qualifiers": ["guard_content"]}},
    ], "GROUNDING")
    if result["action"] != "NONE":
        raise Ungrounded()
    filters = [f for a in result.get("assessments", [])
               for f in a.get("contextualGroundingPolicy", {}).get("filters", [])]
    passed = set()
    for item in filters:
        score, threshold = item.get("score"), item.get("threshold")
        if (item.get("action") != "NONE" or not isinstance(score, (int, float))
                or not isinstance(threshold, (int, float))
                or not math.isfinite(score) or not 0 <= threshold < 1 or score < threshold):
            raise Ungrounded()
        passed.add(item.get("type"))
    if not {"GROUNDING", "RELEVANCE"} <= passed:
        raise UpstreamError("bedrock", "grounding assessment missing")
