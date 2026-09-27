# Simplify Scout and connect explanations to their source views

- **Date:** 2026-09-27
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done locally
- **PR / issue:** Related draft #42; no remote update
- **Branch:** `feat/advisor-companion`
- **Follows:** [Learning flow](2026-09-27-frontend-scout-learning-flow.md), [Ledge lift](2026-09-27-frontend-scout-ledge-lift.md), [Ownership and Advisor](2026-09-27-frontend-scout-ownership-advisor.md)

## What changed

- Removed the notebook completely at the user’s request: route, components, save controls, navigation, storage module and dedicated tests. It is absent from source and production assets.
- Simplified the floating panel into a short introduction, explicit “Use page details” switch, and three aligned starter actions. Removed the workspace link and repeated explanatory paragraphs. Opening an empty thread now starts at its top.
- Raised the active/listening, thinking and answering SVGs an additional 6 CSS pixels. The existing mascot-wrapper offset remains -8px; the shared Advisor mascot, ledge and launcher geometry are unchanged.
- Retained the requested “Explain this” controls for holdings, risk, company figures and dated chart observations. Selections open editable drafts; answers retain their originating context, including voice replies. “Show me” returns to the matching highlighted tool, holding, research step or chart date.
- Added exact-date price evidence and selected-holding evidence on the server; updated OpenAPI and generated types. A selected chart observation stays pinned while opening Scout or returning from an answer.

## How to run / verify it

```bash
npm run dev -w frontend -- --host 0.0.0.0 --port 5176 --strictPort
npm run lint -w frontend
npm run typecheck -w frontend
npm run test -w frontend
npm run build -w frontend
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 PLAYWRIGHT_CHANNEL=chrome npm run test:scout-actions -w frontend
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 PLAYWRIGHT_CHANNEL=chrome npm run test:scout-workspace -w frontend
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 PLAYWRIGHT_CHANNEL=chrome npm run test:scout-voice -w frontend
/tmp/clearvest-venv/bin/pytest tests/layer/test_scout_context.py tests/layer/test_advisor.py tests/advisor/test_routes.py tests/voice/test_voice.py -q
npm run preview -w frontend -- --host 0.0.0.0 --port 5177 --strictPort
CLEARVEST_PRODUCTION_URL=http://127.0.0.1:5177 PLAYWRIGHT_CHANNEL=chrome npm run test:bundle -w frontend
```

Lint, typecheck, 99 frontend unit tests, 84 targeted backend tests and production build passed. Actions, workspace and voice Chrome suites passed using API fixtures. Reviewed desktop and 320px screenshots; the actions suite also checks 390px, Escape, reduced motion, page-data opt-out, pinned date/holding context and same-route scenario handoff. Production home JavaScript is 448,391 bytes; estimated gzip 145,489 bytes, within the existing budgets. No notebook strings remain in frontend source or production output. `git diff --check` passed.

## Decisions & why

- Applied the frontend-design skill. Retained the established navy glass identity: navy #10233F, surface #253951, yellow #F6CF68, white #F0F4FA and muted blue #BBC8D9. SamsungOne carries a restrained hierarchy; left-aligned text and consistent action rows reduce scanning effort. Removed secondary copy rather than adding more cards or labels.
- Scope the new 6px lift to the floating mascot’s non-peek SVG. This keeps it independent of the wrapper’s existing lift and greeting animation.
- Show-me destinations are constructed by application code from validated identifiers, never from model-generated URLs. Source evidence still resolves server-side; browser-supplied financial amounts are not accepted.
- Chart clicks/arrows pin an observation, and dated deep links start pinned. Hover cannot silently replace that selection when Scout closes.
- Preserved the repository’s existing dirty worktree. Nothing was committed, pushed or deployed.

## Gotchas

- Windows Node is used through WSL. Set browser-test environment variables inside Node (`process.env...`) before requiring a script; arbitrary WSL env variables do not automatically propagate. Shell calls needed escalation because of the known WSL mount/sandbox issue.
- Browser tests use synthetic APIs. Real model/provider responses and deployment of the new optional API fields were not exercised.
- Old chat replies without context can only offer the available portfolio fallback action. “Show me” is limited to replies with passed safety status.
- Historical cached chart dates may become unavailable later. The chart reports a missing requested observation; server evidence never substitutes another date.

## Next steps

1. Review Scout on `http://localhost:5176/learn` or `/portfolio`, including the active pose above the glass ledge.
2. Exercise Explain this on a holding or chart date, then use Show me from the reply.
3. If remote work is authorized, include this handoff, apply `team:frontend`, require green `ci-ok`, and verify the new context fields with the deployed backend before release.

## Open questions / blockers

No local blocker. The notebook is intentionally removed. Live provider/model verification remains separate from the completed fixture-based checks.
