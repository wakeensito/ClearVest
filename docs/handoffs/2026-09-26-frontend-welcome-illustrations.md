# Illustrated welcome introduction

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done (local implementation)
- **PR / issue:** Not opened; include in the frontend PR with `team:frontend`.
- **Branch:** `feat/frontend`
- **Follows:** [Advisor context redesign](2026-09-26-frontend-advisor-context.md)

## What changed

- Replaced 01/02/03 with three original SVG illustrations: goals, linked account records, and a conversation with data.
- Removed the repeated ClearVest label above the welcome headline; kept the header wordmark.
- Updated responsive illustration spacing and allowed the introduction to grow with its content.
- Recorded the visual direction in DESIGN.md and the frontend design notes.

## How to run / verify it

From `frontend/`:

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

Open `/welcome?edit=1` and `/welcome`. Lint, typecheck and build passed. A targeted Chromium check verified that all three illustrations load, the duplicate brand label is absent, the populated edit form is preserved, and layouts fit 1440/1024/390/320px widths. Desktop and mobile screenshots were visually reviewed in `frontend/node_modules/.cache/clearvest-review/welcome-illustrated-*.png`.

## Decisions & why

- Original code-authored SVG assets are crisp, small and local; no raster generation or external image service is required.
- Empty alt attributes avoid repeating the explanatory text. The list is unordered; the real form progress indicator is unchanged.
- Reuse navy, cobalt, pale blue and white for comfortable illustrations that fit the brokerage design.

## Gotchas

- The global `ul[role=list]` reset sets padding to zero; the scoped `.points[role=list]` rule deliberately takes precedence for space below the divider.
- The introductory panel follows the form on mobile, preserving the existing task-first layout.
- Other uncommitted repo work predates this change; preserve it during PR assembly.

## Next steps

1. Include this handoff in the frontend PR and apply `team:frontend`.
2. Require green `ci-ok` before merging into protected main.

## Open questions / blockers

None for this change. PR assembly remains separate.
