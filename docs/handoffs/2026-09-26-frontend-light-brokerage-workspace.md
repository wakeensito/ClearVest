# Light brokerage workspace and TradingView research

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done (local implementation; PR and production font setup remain)
- **PR / issue:** Not opened. Include this handoff in the frontend PR and apply `team:frontend`.
- **Branch:** `feat/frontend`
- **Follows:** [Frontend scaffold and design system](2026-09-26-frontend-scaffold-design-system.md)

## What changed

- Replaced the editorial/dark-theme system with a light brokerage workspace: cool canvas, white surfaces, navy text, modest radii, sans headings and refreshed navigation. All routes stay light even with an old dark preference.
- Added TradingView Lightweight Charts v5 security research to Portfolio and a working Markets page. Range selection, symbol validation, exact-value keyboard/pointer inspection, cached/error/empty states and a table alternative use the existing history API. Charts load as a separate bundle.
- Reorganized account value, holdings and allocation; added holdings search and research links, expandable risk factors, and contextual advisor prompts. Preserved account/profile/chat behavior.
- Replaced DESIGN.md with the v2 specification, retaining API units and error-state rules. The token drift test still enforces the matching CSS block. Added `docs/frontend-design-direction.md` with alternatives, critique and a product backlog.
- SamsungOne is first in the font stack and resolves installed 400/700 faces. A self-hosted IBM Plex Sans fallback remains; old Newsreader and Plex Mono dependencies are removed. Added chart input tests and a reproducible browser smoke script with contract fixtures.

## How to run / verify it

```bash
npm ci
npm run mock                         # terminal 1: API examples on 4010
npm run dev                          # terminal 2: frontend on 5173
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium      # browser setup, once
npm run test:browser -w frontend      # with Vite running; API is intercepted by the script
```

Set `VITE_API_BASE_URL` only when testing against a deployed backend. Browser smoke assumes the default
4010 API origin. Optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE` selects an already installed Chromium.
Screenshots are written to `frontend/node_modules/.cache/clearvest-review/` (gitignored).

Validation: lint, TypeScript, 19 unit tests and production build; browser checks cover light-only mode
under a dark OS/stored preference, chart/table/keyboard/range controls, holdings filtering and links,
invalid symbols, provider error and retry, stale and empty history, 320/390/768 portfolio layouts,
advisor prefill without auto-send, onboarding and empty/unlinked accounts. Advisor, Welcome, Learn and Markets also pass the 320px overflow check. API data in screenshots
comes from OpenAPI examples, which contain only three history observations; no synthetic chart data
was added to the app. Live Plaid and deployed-provider integration were not exercised.

## Decisions & why

- Security history is explicitly separate from account performance. Holdings lack cost basis, daily P&L,
  contribution history and actual portfolio returns; do not fabricate these for a richer-looking chart.
- History supports only 1y/5y/10y and the backend ticker syntax. Show available dates. The backend may
  downsample or fall back to weekly data, and it does not return source/currency metadata; no claim
  of daily resolution, a specific provider, or USD for arbitrary symbols is made in the chart.
- History normalization sorts and deduplicates observations, rejects invalid dates and non-positive or
  non-finite prices, and avoids crashing Lightweight Charts on malformed upstream values.
- A single blue chart line and a separate signed return keep movement distinct from brand color.
  TradingView logo and NOTICE attribution/link remain visible.
- Samsung font binaries were not supplied. Local font lookup is intentional, not proof that SamsungOne
  renders on every machine. No font files were copied from Samsung websites.

## Gotchas

- This work builds on the pre-existing uncommitted frontend scaffold on `feat/frontend`. It was not
  committed or pushed; preserve the other contributor's README/Dependabot changes when assembling PRs.
- DESIGN.md v2 supersedes the previous handoff's serif, square-corner, Recharts and theme guidance.
- The browser smoke script uses contract fixtures and a separately running Vite server, never live data.
  It requires the default API base URL. Playwright is a dev dependency; browser binaries are separate.
- The local environment uses Windows Node from WSL. The standard sandbox and image viewer failed on
  a host mount alias; shell commands used the approved escalation path, and screenshots were read via
  the shell. On a normal machine use the npm commands above.
- Learn remains the existing placeholder. Comparison charts and voice were outside this redesign.

## Next steps

1. Review the local preview, include both frontend handoffs in the PR, label `team:frontend`, and require
   green `ci-ok` before merging. Do not commit directly to protected `main`.
2. Supply licensed SamsungOne WOFF2 assets and add URL sources in `frontend/src/styles/fonts.css` for
   consistent Samsung typography on devices without the font installed.
3. Verify the deployed API with profile → account link → portfolio → research → advisor.
4. Add security metadata (quote currency, source, frequency, adjustment policy) and actual portfolio
   performance to the backend before exposing richer return comparisons.
5. Prioritize benchmark comparison and account grouping from the design-direction backlog.

## Open questions / blockers

- @AK1F5 / frontend owner: provide the SamsungOne webfont assets and applicable web-use license.
- Backend/data team: history metadata and portfolio performance require contract additions.
- DevOps: hosting and SPA fallback remain as described in the preceding handoff.
