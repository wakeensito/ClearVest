# Advisor companion concept and implementation proposal

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend (with AI/backend planning)
- **Status:** done (brainstorm and image exploration); application implementation not started
- **PR / issue:** Design proposal PR for `feat/advisor-companion` → `main`; label `team:frontend`.
- **Branch:** `feat/advisor-companion`
- **Follows:** [Advisor context](2026-09-26-frontend-advisor-context.md), [Advisor replies](2026-09-26-ai-advisor-reply-format.md), [Voice](2026-09-26-frontend-voice-button.md), [Learn/research integration](2026-09-26-frontend-learn-research-integration.md), [Market refresh](2026-09-26-backend-market-background-refresh.md)

## What changed

- Created a fresh feature branch from main after the market-refresh merge.
- Added [the companion proposal](../design/advisor-companion/README.md), covering interaction, motion, page context, grounded answers, model evaluation, transport limits, delivery slices and acceptance criteria.
- Generated and saved three mascot concept sheets (Cove, Scout, Pebble) plus their exact prompts. Pebble is a provisional recommendation, not a final selection.
- No frontend behavior, API, model, dependencies or deployed infrastructure changed in this milestone.

## How to run / verify it

```bash
git diff --check
python3 -m json.tool docs/design/advisor-companion/prompts.json >/dev/null
# Read docs/design/advisor-companion/README.md and open its three linked PNGs.
```

Reviewed the current advisor/provider/context code and relevant frontend states.
Verified grounding, model reasoning and streaming capabilities against linked AWS
primary documentation. Visually reviewed the generated concept sheets. There are
no application tests to run for this docs/assets-only milestone; no live model
quality, latency, cost, provider, or AWS deployment claims are established.

## Decisions & why

- Use application state as page context, with a visible disclosure and server validation, rather than continuously capturing screenshots.
- One shared conversation across floating and full Advisor presentations; mount the companion outside the pathname-keyed page subtree.
- Improve grounding and contextual relevance before selecting a larger model. Current Nova 2 Lite already has optional capabilities the adapter does not use.
- Generate static concept sheets now; create vector animation layers only after choosing a direction. The PNGs are not production rigs or sprites.

## Gotchas

- Current chat requests contain only a message, and the prompt forbids naming tickers outside the user's holdings. Both need deliberate changes for contextual research.
- Market news currently supplies headlines, not full articles. Do not claim full-article knowledge or live market prices from cached history.
- Current Bedrock parsing reads only the first text block. Grounding needs structured citations preserved through the API and frontend.
- Current HTTP API/29-second Lambda path needs a deliberate transport change for streaming or long research. Voice must retain its separate shorter response/deadline behavior.
- Concept images include illustrative title strips; extra quotation marks and plush rendering should not become literal production UI.
- The existing demo identity is not authorization for real-account context. Production personal-account use needs authenticated context enforcement.

## Next steps

1. Discuss/select a mascot direction and refine small-size silhouette and eye/head layers. Use the proposal's motion states and quiet default.
2. Build the shared companion shell and inline Advisor variant behind a feature flag, preserving current chat and voice behavior.
3. Add typed page-context registration and per-turn frozen context with API/server validation.
4. Add dated evidence/source UI and a beginner evaluation set; compare model configurations before changing the default model.
5. Require green `ci-ok` for implementation PRs and update the handoff with the selected visual and measured outcomes.

## Open questions / blockers

- No blocker for the requested brainstorm and mascot exploration; these deliverables are complete.
- Mascot/name selection, idle-motion preference, research budget and compact-panel voice timing remain product decisions. The proposal provides defaults for discussion.
