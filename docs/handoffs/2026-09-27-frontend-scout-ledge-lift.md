# Raise Scout slightly above the glass ledge

- **Date:** 2026-09-27
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done locally
- **PR / issue:** Related draft #42; no remote update
- **Branch:** `feat/advisor-companion`
- **Follows:** [Glass ledge](2026-09-27-frontend-scout-glass-ledge.md)

## What changed

Raised the floating Scout artwork by 4px relative to its launcher, as requested.

## How to run / verify it

Open `http://localhost:5176/portfolio`. Chrome geometry checks passed at 1440px and 320px: artwork is 4px above its original position and the glass bar retains the companion's bottom anchor. `git diff --check` passed.

## Decisions & why

Use relative `top: -4px` on the mascot wrapper so the greeting animation's transform remains independent. The glass bar, popup and launcher hit area keep their existing positions.

## Gotchas

Apply the offset to the floating mascot wrapper, not the shared Scout component or the companion container; the latter would also move the ledge.

## Next steps

1. Review the small lift locally.
2. Carry forward the glass-ledge handoff's remaining tasks.
3. Include this handoff in a later authorized PR, use `team:frontend`, and require green `ci-ok`.

## Open questions / blockers

None. Nothing committed, pushed, or deployed.
