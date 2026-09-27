# Scout feature ready for review

- **Date:** 2026-09-27
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done locally; remote CI pending
- **PR / issue:** New draft PR to supersede closed design proposal #42
- **Branch:** `feat/advisor-companion`
- **Follows:** [Teammate integration](2026-09-27-frontend-teammate-sync.md), [Panel and actions](2026-09-27-frontend-scout-panel-and-actions.md)

## What changed

- Prepared the integrated Scout implementation for the user's requested feature-branch push: contextual conversation and voice, portfolio ownership and scenarios, source evidence, lesson suggestions and comprehension checks.
- Included the simplified companion panel, square Advisor tab underlines, glass ledge and raised active mascot. Notebook functionality has been removed at the user's request.
- Included API contracts, backend guardrails, infrastructure changes, generated mascot assets, regression coverage and the accumulated design/handoff records.
- Retained teammates' main-branch work via merge. Local submission exports under `output/` remain outside the commit.

## How to run / verify it

```bash
npm run lint -w frontend
npm run typecheck -w frontend
npm run test -w frontend
npm run build -w frontend
ruff check .
pytest -q
```

All passed after integration: 422 frontend tests and 418 backend tests, plus 24 focused backend tests following the date-validation adjustment. Scout actions, portfolio X-ray, markets/advisor and production bundle browser checks passed; exact commands and Windows environment details are in the preceding handoff. Initial home JavaScript measured 470,262 bytes, estimated gzip 154,274 bytes. Diff whitespace and credential-pattern review passed; numeric matches were synthetic UUID fixtures, not account identifiers.

## Decisions & why

- Publish on the existing feature branch with a normal push, preserving shared history. Main remains protected and must receive changes through a PR with green `ci-ok`.
- The old design-only PR #42 is closed without merging. Use a new draft PR describing the implemented feature instead of reopening an obsolete proposal.
- Keep the pre-integration recovery stash until the published changes have been verified.

## Gotchas

- Remote CI has not yet run for this feature commit. Local browser checks use fixture APIs; live provider/model behavior and deployment are not verified by those checks.
- Backend and infrastructure changes ship together: guarded inference needs the guardrail environment variables and permissions in the updated template.
- Initial gzip budget has only 726 bytes of headroom. Recheck route requests before adding more shared imports.
- Windows GitHub CLI is installed but unauthenticated. Repository Git transport and the connected GitHub tools are available.

## Next steps

1. Push the reviewed feature commit and open its draft PR with `team:frontend`.
2. Review remote CI and require green `ci-ok` before merge.
3. Review the UI and perform deployed provider/model checks in the team's normal deployment workflow.

## Open questions / blockers

No local implementation blocker. Remote CI, review and deployment remain outstanding at handoff creation.
