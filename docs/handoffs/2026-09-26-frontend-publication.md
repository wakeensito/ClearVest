# Frontend workspace ready for review

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done (implementation and local verification)
- **PR / issue:** Frontend PR from `feat/frontend` to `main`; label `team:frontend`.
- **Branch:** `feat/frontend`
- **Follows:** [Profile form](2026-09-26-frontend-profile-form.md), [Initial scaffold](2026-09-26-frontend-scaffold-design-system.md)

## What changed

- Published the React/TypeScript/Vite frontend and root npm workspace as one reviewable branch change, including its original scaffold and subsequent design refinements.
- Added the light SamsungOne brokerage workspace, portfolio research charts, Markets, Learn, advisor context, branded footer and illustrated onboarding.
- Added local-time greetings, optional balance privacy, accessible chart alternatives, profile selection controls, cancellation and clear API-state handling.
- Included font licenses, image provenance, design documentation, browser checks and the frontend handoff trail.

## How to run / verify it

```bash
npm ci
npm run mock
# In another terminal:
npm run dev
# Local/CI checks:
npm run lint
npm run typecheck
npm test
npm run build
# With Vite running and Playwright Chromium installed:
npm run test:browser -w frontend
```

Local lint, typecheck, all 21 tests, build and browser smoke passed before publication. Browser checks cover responsive layouts, charts, profile cancellation/save/retry, onboarding, advisor prefill and loading/error/empty data states. `ci-ok` must pass on the PR before merging; publication does not authorize a merge.

## Decisions & why

- Commit the root workspace manifest/lockfile and Dependabot configuration with the app so the existing CI Node job activates correctly.
- This branch is the first frontend commit; scaffold files are necessary dependencies of the requested redesign.
- DESIGN.md and the later handoffs supersede the original dark/editorial scaffold direction. SamsungOne is now bundled locally and Markets/Learn are implemented.

## Gotchas

- The default API remains the Prism contract mock on port 4010. Its short price examples do not represent real 1Y/5Y/10Y history. Configure `VITE_API_BASE_URL` for real backend data.
- Plaid and advisor integration checks against real services remain separate from fixture-based browser verification.
- Hosting still needs an SPA fallback; this branch does not deploy a site.
- Generated output, node_modules, local environment files and browser screenshots are ignored and excluded from the commit.

## Next steps

1. Review the frontend PR and require green `ci-ok` before merging.
2. Point a review environment at the deployed API and exercise profile, account linking, price history and advisor requests.
3. Coordinate frontend hosting and SPA fallback with DevOps.

## Open questions / blockers

No implementation blockers for publication. Live-service verification and hosting remain follow-up integration work.
