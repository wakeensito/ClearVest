# Square advisor tab underlines and simpler submission story

- **Date:** 2026-09-27
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done locally
- **PR / issue:** Related draft #42; no remote update
- **Branch:** `feat/advisor-companion`
- **Follows:** [Scout learning flow](2026-09-27-frontend-scout-learning-flow.md), [Submission thumbnail](2026-09-27-frontend-submission-thumbnail.md)

## What changed

- Advisor view buttons now explicitly use `border-radius: 0`, producing rectangular active underlines for Ask Scout, What I own, Risk check and Research.
- Saved a shorter, simpler seven-section submission story in `output/submission/project-story.md`.

## How to run / verify it

Open `http://localhost:5176/advisor` and select each of the four tabs. Chrome verification checked computed corner radii of 0px, a 2px gold bottom border, and the active state at 1440px and 320px. API requests were mocked unavailable for this styling-only check. `git diff --check` passed. No new test files were added for this small CSS change.

## Decisions & why

The global button style supplies rounded corners. Override it only on advisor selection tabs, retaining other button treatments and the existing underline color and thickness. The story retains the submission form's seven sections with brief, plain-language paragraphs.

## Gotchas

A bottom border follows the button's corner radius even when the button has no background. Resetting the radius on the tab selector removes that curve. Local command execution still requires the known sandbox mount workaround.

## Next steps

1. Review the tab underlines locally and paste the simplified project story into the submission form.
2. Carry forward the learning-flow handoff's testing and provider-verification tasks.
3. Include this handoff if a PR update is later authorized; use `team:frontend` and require green `ci-ok`.

## Open questions / blockers

None. Nothing committed, pushed, or deployed.
