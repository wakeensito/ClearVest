# Guardrails switched off for the demo

- **Date:** 2026-09-27
- **Author:** @wakeensito
- **Team:** ai
- **Follows:** 2026-09-27-devops-guardrail-topic-limits.md

## What changed
- New env switch `GUARDRAILS_ENABLED` (`src/layer/clearvest/providers/guardrails.py`, `enabled()`). Defaults to on; `template.yaml` sets it to `'false'` on AdvisorFn and VoiceFn.
- When off: no input masking, no `guardrailConfig`/`guardContent` on Converse, no grounding check, no citation-range check.
- The `bedrock:GuardrailIdentifier` condition on `bedrock:InvokeModel` is removed from AdvisorFn and VoiceFn, otherwise unguarded inference is denied.
- Guardrail resources stay deployed, so re-enabling is a one-line change.

## Why
The `SpecificTradingRecommendations` topic (Classic tier) blocked neutral holding explanations, e.g. "Explain my saved QQQ holding, including its value and weight". Verified with ApplyGuardrail: the question passes, a neutral answer is BLOCKED. Scout answered with the canned SAFE_REPLY. Turned off for a same-day demo.

## How to re-enable
Set `GUARDRAILS_ENABLED: 'true'` on both functions and restore the InvokeModel `Condition` (see git history of `template.yaml`) and its assertion in `tests/test_template.py`.

## Next steps
1. Reword the topic (drop "hold"; target directives like "you should buy/sell"), consider `TopicsTierConfig: STANDARD`.
2. Add live eval cases: "explain my QQQ holding" must pass; "buy NVDA with your savings" must block.
3. Re-enable guardrails before any real-money or public launch.

## Gotchas
- With guardrails off, Scout can give specific buy/sell advice and PII is not masked in stored chat history.
