# Clearer profile questions and edit controls

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done (local implementation)
- **PR / issue:** Not opened; include in the frontend PR with `team:frontend`.
- **Branch:** `feat/frontend`
- **Follows:** [Illustrated welcome introduction](2026-09-26-frontend-welcome-illustrations.md)

## What changed

- Replaced jargon labels with questions and made the three time ranges the primary horizon labels.
- Added visible native radio controls alongside the selected card styles and tightened form spacing.
- Added Cancel beside Save profile when editing. It discards local edits without writing to the API.
- Profile entry links now retain the originating app route; Cancel and successful Save return there, with Portfolio as the direct-entry fallback.
- Updated design documentation and browser coverage for editing, cancellation and save retry.

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

Lint, typecheck, all 21 unit tests, production build and browser smoke passed. Browser checks cover native radio arrow-key selection, selected initial values, Cancel without PUT, discarded draft values, return to Advisor, direct-entry fallback, save failure preserving edits, explicit retry, unchanged API enums, and no horizontal overflow at 320px. Desktop and mobile screenshots were visually reviewed in `frontend/node_modules/.cache/clearvest-review/profile-edit-*.png`.

## Decisions & why

- Keep `short`, `medium`, `long` and risk enum values unchanged; this is a clearer presentation of the same profile data.
- Use native radio inputs for keyboard semantics and a selection cue independent of color.
- Cancel is a non-submit button, disabled while saving so it cannot appear to abort an in-flight write. It requires no confirmation for these unsaved local edits.
- Return destinations are restricted to known app routes. New-user onboarding retains Continue and the account-link step.

## Gotchas

- Field.tsx radio controls are shared; currently WelcomePage is their only consumer.
- Native fieldset legends require their own bottom margin because the grid gap does not separate them from the options.
- Browser checks intercept API calls with contract fixtures; save/retry coverage does not write a real profile.
- Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` inside the Windows Node process when using the installed Windows browser from WSL.
- Preserve unrelated uncommitted repo work when assembling the PR.

## Next steps

1. Include this handoff in the frontend PR and label it `team:frontend`.
2. Require green `ci-ok` before merging into protected main.

## Open questions / blockers

None for these four improvements. PR assembly remains separate.
