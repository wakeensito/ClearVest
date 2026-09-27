# Subtle glass ledge beneath Scout

- **Date:** 2026-09-27
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done locally
- **PR / issue:** Related draft #42; no remote update
- **Branch:** `feat/advisor-companion`
- **Follows:** [Square advisor tabs](2026-09-27-frontend-square-advisor-tabs.md), [Scout learning flow](2026-09-27-frontend-scout-learning-flow.md)

## What changed

Added a near-transparent, full-width rectangular glass ledge behind the floating Scout's paws. It is 14px high on desktop and 10px on mobile, with a faint edge highlight and 3px background blur.

## How to run / verify it

Open `http://localhost:5176/portfolio`. Chrome checks confirmed full viewport width, square corners, matching Scout/bar bottom offsets, `pointer-events: none`, and no horizontal overflow at 1440px and 320px. Screenshots at both widths were visually reviewed under ignored `frontend/node_modules/.cache/clearvest-review/scout-glass-bar-*.png`. `git diff --check` passed. No new test files were added for this decorative CSS change.

## Decisions & why

Use a CSS pseudo-element on the existing companion so it follows the same route visibility and bottom offset. The ledge stays beneath Scout and his conversation panel, while pointer events pass through to underlying content. Mobile positioning clears the tab bar and follows the companion's keyboard offset. Existing mascot artwork is unchanged.

## Gotchas

The pseudo-element is fixed to the viewport, not constrained to the mascot's width. Its bottom inherits the companion's computed offset. Keep launcher/panel stacking above the ledge. Reduced-transparency or increased-contrast preferences remove the decorative tint and blur.

## Next steps

1. Review the ledge against the current page on desktop and mobile.
2. Carry forward the prior handoffs' learning-study and provider-verification tasks.
3. Include this handoff in any later authorized PR update, use `team:frontend`, and require green `ci-ok`.

## Open questions / blockers

None. Nothing committed, pushed, or deployed.
