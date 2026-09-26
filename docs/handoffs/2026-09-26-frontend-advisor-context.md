# Advisor context panel redesign

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done (local implementation)
- **PR / issue:** Not opened; include in the frontend PR with `team:frontend`.
- **Branch:** `feat/frontend`
- **Follows:** [Automatic local-time greeting](2026-09-26-frontend-local-time-greeting.md)

## What changed

- Replaced the plain advisor context list with a contained white SamsungOne summary, structured profile facts, goal labels and a portfolio section.
- Added a neutral, accessible risk meter and a distinct economic-source footer with the supplied data date.
- Moved Edit profile next to the profile heading and made context a native disclosure, initially collapsed on smaller screens.
- Distinguished pending/unavailable holdings from an explicitly unlinked account. Extracted ContextRail from AdvisorPage and documented its design.

## How to run / verify it

From `frontend/`:

```bash
npm run dev
# In a second terminal:
npm run lint
npm run typecheck
npm run build
npm run test:browser
```

Lint, typecheck, production build and the updated browser smoke check passed. Browser coverage includes desktop expansion, mobile initial collapse, keyboard Enter toggling, profile edit destination, risk meter visibility, and no overflow at 320px. Desktop and expanded mobile screenshots were visually reviewed; artifacts live in `frontend/node_modules/.cache/clearvest-review/advisor-context-{desktop,mobile}.png`.

## Decisions & why

- Use one panel with profile, portfolio and source sections rather than separate cards for every metric.
- Goals are non-interactive labels. The risk scale uses neutral colors and a cobalt position marker, not success/loss colors or a progress bar.
- Native details/summary supplies keyboard interaction and expanded state. Initial expansion follows viewport width; after mounting the user controls expansion.
- Preserve the existing profile edit route and query hooks; no chat submission behavior changed.

## Gotchas

- Browser tests use API contract fixtures and do not verify live advisor or market data.
- Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if the default Playwright browser is unavailable. Windows Node invoked from WSL needs that variable inside its Windows process.
- Existing uncommitted changes predate this task; preserve them when assembling the PR.

## Next steps

1. Include this handoff in the frontend PR and label it `team:frontend`.
2. Require green `ci-ok` before merging into protected main.

## Open questions / blockers

None for this panel redesign. PR assembly remains separate.
