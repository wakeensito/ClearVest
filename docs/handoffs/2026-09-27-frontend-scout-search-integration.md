# Integrate the new unified search into Scout

- **Date:** 2026-09-27
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done locally; remote CI pending
- **PR / issue:** #54
- **Branch:** `feat/advisor-companion`
- **Follows:** [Scout publication](2026-09-27-frontend-scout-publication.md), [Unified search frontend](2026-09-27-frontend-unified-search.md), [Unified search backend](2026-09-27-data-unified-search.md)

## What changed

- Pushed Scout implementation commit `01a27ef` and opened draft PR #54, labeled `team:frontend`. The old design proposal #42 was closed without merging.
- Main advanced to `3e19d5f` through teammate PR #53 after the earlier sync. Integrated that new unified-search work with a merge, preserving published feature history.
- Resolved four overlapping files by keeping Scout's selected price/range context and the new search comparison links, dialog focus/URL behavior, and backend search route alongside both fund routes.
- Allowed the new unified-search browser suite to select installed Chrome through `PLAYWRIGHT_CHANNEL`, retaining its default Chromium launch otherwise.

## How to run / verify it

```bash
npm run lint -w frontend
npm run typecheck -w frontend
npm run test -w frontend
npm run build -w frontend
ruff check .
pytest -q
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 PLAYWRIGHT_CHANNEL=chrome npm run test:security-search -w frontend
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 PLAYWRIGHT_CHANNEL=chrome npm run test:scout-actions -w frontend
CLEARVEST_PRODUCTION_URL=http://127.0.0.1:5177 PLAYWRIGHT_CHANNEL=chrome npm run test:bundle -w frontend
```

Passed: frontend lint/typecheck/build, 511 frontend tests, Python lint, unified-search browser checks at 320/375/393 pixels, Scout actions, and production bundle/recovery checks. All 489 backend tests passed. Browser APIs are fixtures. Cold home JavaScript is 470,307 bytes, estimated gzip 154,301 bytes, still within the existing budget.

## Decisions & why

- A normal merge and push retains teammates' published history without rebasing or force-pushing.
- Shared research components now accept both Scout range callbacks and search comparison callbacks. Do not discard one while simplifying the other.
- Kept the existing draft status: green CI and team review are required before merging into protected main.

## Gotchas

- WSL Git has no credential helper; the existing Windows Git executable uses the user's configured credential manager. No credentials were copied into the repo.
- Local submission exports under `output/` remain untracked. The earlier recovery stash is retained and must not be blindly reapplied.
- Estimated initial gzip headroom is now 699 bytes. Future shared imports should be measured against this budget.
- Windows Node browser tests set `process.env` inside Node because arbitrary WSL environment variables are not inherited.

## Next steps

1. Publish the validated merge to the existing feature branch.
2. Review `ci-ok` on PR #54 before merge.
3. Perform live provider/model checks through the team's deployment workflow.

## Open questions / blockers

No unresolved merge conflicts. Remote CI and deployed provider/model checks remain outstanding.
