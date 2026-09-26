# Automatic local-time greeting

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done (local implementation)
- **PR / issue:** Not opened; include in the frontend PR with `team:frontend`.
- **Branch:** `feat/frontend`
- **Follows:** [Dark branded footer](2026-09-26-frontend-branded-footer.md), [Inclusive investing experience](2026-09-26-frontend-inclusive-investing-experience.md)

## What changed

- Replaced seven-second welcome phrase rotation with the appropriate local-time greeting.
- Removed pause/resume controls, returning-user phrases, saved greeting preferences and fade animation.
- Updated design documentation and the existing browser smoke check for morning, afternoon and evening transitions.

## How to run / verify it

From `frontend/`:

```bash
npm run dev
# In another terminal:
npm run lint
npm run typecheck
npm test
npm run build
npm run test:browser
```

All checks passed: 21 unit tests, production build, and browser smoke including 320/390/768px layouts and clock-driven greeting transitions. If the default Playwright browser is unavailable, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chromium executable. When using Windows Node from WSL, set this variable inside the Windows process.

## Decisions & why

- Use device local time: morning 05:00–11:59, afternoon 12:00–17:59, evening otherwise. The requested automatic behavior follows time of day rather than randomly displaying an inappropriate greeting.
- Refresh every minute and when the tab becomes visible. No motion or user controls are necessary.
- Keep the stable accessible page heading “Your portfolio”.

## Gotchas

- Old `cv-visited` and `cv-greeting-paused` values may remain in browser storage but are no longer read or written.
- Browser smoke uses contract fixtures; it does not verify live market data.
- Preserve existing uncommitted work when assembling the frontend PR.

## Next steps

1. Include this handoff with the frontend PR and label it `team:frontend`.
2. Require green `ci-ok` before merging into protected main.

## Open questions / blockers

None for this greeting change. PR assembly remains separate.
