# Guardrail topic definitions fit the Bedrock Classic tier limit

- **Date:** 2026-09-27
- **Author:** @wakeensito
- **Team:** devops
- **Status:** done
- **PR / issue:** fixes the failed #54 deploy
- **Branch:** fix/guardrail-topic-limits
- **Follows:** (none; hotfix for #54's AdvisorGuardrail)

## What changed

- Shortened two `AdvisorGuardrail` topic definitions that were over Bedrock's 200-character Classic-tier limit, without changing what they block:
  - `SpecificTradingRecommendations`: 234 → 195 chars.
  - `IllegalFinancialConduct`: 204 → 184 chars.
- Added `test_guardrails_fit_bedrock_limits` to `tests/test_template.py`. It checks every `AWS::Bedrock::Guardrail` in the template against these limits:
  - guardrail name pattern ≤ 50
  - description ≤ 200
  - blocked messaging ≤ 500
  - topic name pattern ≤ 100
  - topic definition ≤ 200 on Classic (1000 on Standard)
  - ≤ 5 examples per topic, each ≤ 100
  - word-policy words ≤ 100
  - grounding thresholds in [0, 1)

## How to run / verify it

```bash
.venv/bin/python -m pytest -q tests/test_template.py -k guardrails
sam validate --lint
# After merge, CD deploys from main. To re-run by hand:
gh workflow run deploy.yml -R wakeensito/ClearVest --ref main
```

## Decisions & why

- **Shorten rather than switch to the Standard tier.** Standard allows 1000-character definitions, but it needs `TopicsTierConfig: STANDARD` plus a cross-region guardrail profile. That's a bigger change right before the demo. The shortened definitions keep the same scope (the same actions and the same exclusions).
- **Encode the limit in a test.** CloudFormation's schema allows 1000 characters (the Standard maximum), so `cfn-lint` and `sam validate` pass a 234-character definition. Only Bedrock rejects it, at create time, and a failed create costs a full deploy plus a rollback.

## Gotchas

- The deploy role (`ClearVest-cicd`) had to be redeployed before this. #54 added the guardrail IAM statements to `infra/cicd-role.yaml`, but the role stack wasn't updated, so the first deploy failed with AccessDenied. It was redeployed at 12:12 UTC.
- The failed deploys rolled back cleanly each time. The live site stayed on the #53 build until this lands.

## Next steps

1. Merge (owner), then confirm the CD deploy reaches `UPDATE_COMPLETE` and both guardrails exist.
2. Smoke-test the advisor on the live site (`scripts/smoke.sh <ApiUrl>`).

## Open questions / blockers

- @AK1F5: please confirm the shortened wording still matches your intent for both topics.
