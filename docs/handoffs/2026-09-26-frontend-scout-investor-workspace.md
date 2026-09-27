# Scout page awareness and the Advisor investor workspace

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend (with shared advisor/backend changes)
- **Status:** done locally; deployment and live evaluation pending
- **PR / issue:** Related draft #42; no remote update for this milestone
- **Branch:** `feat/advisor-companion`
- **Follows:** [Scout guardrails and BETA](2026-09-26-ai-scout-guardrails-beta.md)

## What changed

- Thinking pupils/eyelids are still; opening dips down, rises up and settles. Removed the workspace slogan strip. Advisor now has a deep-navy, responsive workbench with Portfolio lab, Company brief and Your context beside the shared chat.
- Scout sends validated page/symbol/range/lesson identifiers, shows the selected context, supports selection-sharing opt-out and carries explicit selections into Advisor. Backend evidence is retrieved independently; selection never implies ownership. Failed text retries retain original context. Voice carries active context and source metadata too.
- Portfolio lab calculates a hypothetical single-holding loss immediately and again server-side before Scout explains it. Company brief combines existing research/news endpoints with fiscal periods, retrieval dates, stale/missing states and publisher links.
- Standalone source QA extends the existing grounding path to scenario, company, lesson, price-history and news evidence. Ordinary replies show context receipts without a grounding claim. The existing published grounding version description becomes `source-grounding-v2`; no new provider or retrieval endpoint is required.
- Added [implementation assessment, further ideas and a 90-second demo](../design/advisor-companion/scout-investor-workspace.md), generated server lesson cards, API contract changes, unit tests and a browser workspace flow.

## How to run / verify it

```bash
python -m pytest -q
ruff check .
npm run lint -w frontend
npm run typecheck -w frontend
npm test -w frontend
npm run build -w frontend
sam validate --lint --template-file template.yaml
sam build
# Regenerate after changing public Learn lesson cards:
node scripts/sync-scout-lessons.cjs
# With the frontend running against the local mock API base:
PLAYWRIGHT_CHANNEL=chrome CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:scout -w frontend
PLAYWRIGHT_CHANNEL=chrome CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:scout-safety -w frontend
PLAYWRIGHT_CHANNEL=chrome CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:scout-workspace -w frontend
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:browser -w frontend
```

282 backend tests and 88 frontend tests passed. Ruff, frontend lint/typecheck/build, SAM validation/build, Scout motion, safety, workspace and full-app browser smoke suites passed. Workspace tests cover selection sharing, chart range, lesson context, scenario arithmetic/handoff, source links/dates, missing holdings and 320px layout. Desktop/mobile screenshots were reviewed. The production frontend build retains its existing >500 kB chunk advisory. Tests use service doubles/Moto and browser API fixtures, not live Nova, AWS policy classification or market entitlements.

## Decisions & why

- The browser supplies identifiers, never source financial figures. `clearvest.scout_context` validates them and reads fresh cache entries or caller holdings. Extra context fields are rejected. No screenshot capture or arbitrary DOM inspection occurs.
- Portfolio loss is a code calculation, not an LLM estimate or a new risk score. Duplicate holdings aggregate; unsupported short/derivative portfolios cannot produce a misleading simplified result. Source receipts preserve the date and assumptions.
- Grounding applies only to explicit standalone QA with server-owned reference text and no free-form history/profile goals. Ordinary conversation and voice are finance/privacy guarded but not source-QA certified. Invalid source indices withhold the standalone answer.
- Cached headlines are not full articles. Expired company/news/history entries are excluded from new evidence. No unrelated portfolio fallback is allowed when selected-company or scenario facts are missing.
- Existing shared chat/draft/voice behavior remains; tool actions wait during recording/in-flight voice or text. Current-context labels can be reset after an explicit tool discussion. Popup BETA and subtitle stay as requested.
- Follow the user's instruction: no push until explicitly requested. Work remains uncommitted; no deployment or remote PR update occurred.

## Gotchas

- Source evidence uses `CACHE#fmp` keys `research:v1:<symbol>:<section>` and `news:<symbol>`, plus `CACHE#history` `<symbol>:<range>`. Research/news panes warm those normal cached endpoints; Advisor does not make an unbounded provider retrieval loop.
- The history cache lacks per-snapshot upstream provider provenance. Its receipt says so. A range selects the available first/last observations; it is not necessarily complete coverage or dividend-adjusted total return.
- `src/layer/clearvest/data/scout_lessons.json` is generated from the public frontend lessons. Regenerate it when cards change. Only lesson IDs are accepted from clients, not lesson prose. Exact lesson-card/quiz-step focus and company comparison sets are not tracked yet.
- Scenario/client numbers may come from a saved snapshot; server explanation uses the caller's latest saved holdings. Check receipt timestamps. General selection opt-out controls page identifiers, not existing authorized profile/portfolio context.
- Earlier handoffs describe voice turns as session-only. Screened voice turns now return safety/source metadata and can persist like screened text; raw unchecked transcripts are still excluded. Other audio/profile/history retention boundaries remain separate.
- Before future deployment, follow the previous guardrails handoff: update bootstrap IAM, rebuild/deploy backend and frontend together, and evaluate the actual published guardrail/model. Demo UUID identity still needs real authentication before personal-account production use.
- WSL sandbox mount failures required approved local command escalation. Windows Node/Chrome ran frontend checks. Python tooling is under `/tmp/clearvest-venv`. SAM built successfully with `PATH=/tmp/clearvest-venv/bin:$PATH` and `--no-cached --build-dir /tmp/clearvest-scout-workspace-build`; use Linux `/tmp` to avoid slow NTFS dependency copying. A stopped Vite preview caused one browser connection-refused run; restarting it resolved that environment issue.

## Next steps

1. Review the local desktop/mobile Advisor and run the report's demo with explicitly labeled sandbox data.
2. Once deployment is authorized, rebuild/deploy and evaluate actual responses, source support, policy false refusals, latency and cost. Do not present fixture answers as live model results.
3. Add the report's top follow-up: a dated “What changed since my last visit?” briefing using previous/current snapshots and verified ownership relevance. Then consider a research notebook with supporting/contrary filing evidence.
4. Push/update draft #42 only when the user explicitly requests it; apply the relevant `team:*` labels and require green `ci-ok` before merging.

## Open questions / blockers

No local implementation blocker. Live deployment, provider access/freshness and guardrail behavior remain unverified. Additional ideas in the report are proposals, not implemented capabilities. The user has reserved permission to push.
