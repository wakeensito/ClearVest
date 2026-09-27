# Scout selected and added to Advisor

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done (mascot selection and initial Advisor integration)
- **PR / issue:** Related draft #42; these changes are local only and have not been pushed.
- **Branch:** `feat/advisor-companion`
- **Follows:** [Companion exploration](2026-09-26-frontend-advisor-companion-exploration.md)

## What changed

- The user selected Scout. Removed the otter and Pebble PNGs and their prompts from active design assets, and updated the proposal. The previous handoff remains historical.
- Added `frontend/src/components/companion/Scout.tsx` and its CSS module: layered vector artwork with separate eyes, head and wings.
- Scout appears beside “Ask about your money.” Its button focuses the existing composer without sending a request. Real text/voice request state drives the thinking pose; typing/recording drives attentiveness; a reply gives a short nod; errors settle to a neutral pose.
- Idle motion runs one quiet sequence, then stops. Hidden tabs pause animations; reduced motion disables animations and hover lift. The existing chat/voice flows and backend are unchanged.

## How to run / verify it

```bash
# From repository root, using the installed Node/npm toolchain:
npm run lint
npm run typecheck
npm run build
npm run dev
# Open /advisor. Click Scout, type, submit, and check a reply and failure.
git diff --check
python3 -m json.tool docs/design/advisor-companion/prompts.json >/dev/null
```

Lint, TypeScript and production build passed. Build retains a large-chunk advisory.
An ad hoc Playwright check with mocked API responses passed click/keyboard focus,
no automatic sending, attentive/thinking/ready/error states, reduced motion,
320px overflow and no page errors. Desktop/mobile captures are local ignored
artifacts under `frontend/node_modules/.cache/clearvest-review/`. No live AI call
or deployed behavior was tested. Browser checks used installed Chrome because
this environment lacks the Playwright version's bundled browser.

## Decisions & why

- Scout is the chosen direction, not one of several remaining alternatives.
- Use a flat SVG interpretation of the reference sheet so expression layers can animate independently without a runtime dependency.
- The mascot SVG is decorative; its containing button has an accessible name. The actual heading remains plain text for navigation and screen readers.
- Follow the user's explicit instruction: no push or remote PR updates until the user asks. This overrides the generic handoff guidance to push before stopping.

## Gotchas

- The bottom-left floating panel, page context, sourced research and model improvements are still proposed, not delivered by this mascot milestone.
- Existing conversation history may show the ready pose when entering Advisor; its motion is a finite acknowledgment, not a new-message notification.
- The old exploration handoff and remote draft still describe the earlier concepts. Do not rewrite historical handoffs or update the remote without authorization.

## Next steps

1. Review Scout's vector interpretation in the actual Advisor heading.
2. Add the shared floating companion presentation on Home, Portfolio, Learn and Markets, with the planned keyboard/mobile behavior and shared conversation lifecycle.
3. Implement validated, per-turn page context, then dated evidence and AI evaluation as described in the proposal.
4. Push and update draft #42 only when explicitly instructed; require green `ci-ok` before merge.

## Open questions / blockers

No blocker for mascot selection and initial integration. Floating-panel behavior,
compact voice timing and research budget remain subsequent work. These changes
are uncommitted and local for user review.
