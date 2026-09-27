# Connect Scout to learning and load pages on demand

- **Date:** 2026-09-27
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done locally; not committed, pushed, or deployed
- **PR / issue:** Related draft #42; no remote update
- **Branch:** `feat/advisor-companion`
- **Follows:** [Advisor conversation restoration](2026-09-27-frontend-advisor-conversation-restore.md), [Shared voice](2026-09-27-frontend-scout-shared-voice.md)

## What changed

- The latest suitable Scout answer now offers a relevant existing lesson and an expandable quick check in both full Advisor and the floating companion. Recommendations prefer an allowlisted lesson receipt, then match curated concepts. Unknown, refused, unavailable and unrelated answers receive no recommendation.
- Quick checks reuse existing lesson questions and explanations. An optional written exercise asks the learner to explain the idea, give an example and mention a limitation; it reveals lesson content for self-review. Writing stays in component memory and is never sent or stored. This is explicitly not an AI grade.
- Learn displays first-attempt practice results and self-review choices separately from completed lessons. Results are scoped to the demo user, survive reload when storage works, fall back to memory when blocked, and have their own reset. Repeated answers do not inflate the first-attempt score.
- Lessons opened from Scout have a return-to-conversation link. Chat and draft survive. A companion lesson link closes the popup so the lesson is readable. Scout is larger beside the Advisor heading, and image decoding handles cached SVG-image remounts.
- Routes load page code on demand; interactive practice loads only when opened. Added loading feedback and route-load recovery. Cold home-route JavaScript fell from about 584 kB to 445 kB including shared chunks. Added production budget checks and a [human comprehension-study protocol](../design/learning-flow/beginner-check.md).

## How to run / verify it

```bash
npm run lint -w frontend
npm run typecheck -w frontend
npm test -w frontend
npm run build -w frontend
npm run dev -w frontend -- --host 0.0.0.0 --port 5176 --strictPort
# Separate terminal; synthetic API fixtures, no live model/audio calls:
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 PLAYWRIGHT_CHANNEL=chrome npm run test:scout-learning -w frontend
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 PLAYWRIGHT_CHANNEL=chrome npm run test:scout -w frontend
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 PLAYWRIGHT_CHANNEL=chrome npm run test:scout-voice -w frontend
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 PLAYWRIGHT_CHROMIUM_EXECUTABLE='/path/to/chrome' npm run test:browser -w frontend
npm run preview -w frontend -- --host 0.0.0.0 --port 5177 --strictPort
# Separate terminal; requires the production preview, not the dev server:
CLEARVEST_PRODUCTION_URL=http://127.0.0.1:5177 PLAYWRIGHT_CHANNEL=chrome npm run test:bundle -w frontend
```

Lint, typecheck, all 96 unit tests, and build passed. New learning browser suite, existing full-site/Scout/shared-voice browser suites and production bundle/loading/recovery checks passed. New browser coverage includes cold/cached mascot visibility, editable chat-draft continuity through lessons, correct/incorrect first attempts, no persistence or upload of writing, practice reset, blocked storage, refused answers, and 320px layout. Desktop/mobile screenshots reviewed.

Measured cold home JS: 444,646 bytes (~24% below the previous 583,820-byte eager entry). Local gzip sum: 143,719 bytes (~22% below the prior ~184,100). The main entry is ~332 kB; no chunk exceeds 500 kB. These are JavaScript byte counts, not a measured loading-time or total-page-bandwidth claim. PNG/font costs remain. Ignored `frontend/node_modules/.cache/clearvest-review/bundle-report.json` lists every requested production JS chunk.

## Decisions & why

- Reuse lesson content instead of asking the model to invent a quiz or grade writing. Curated matching produces at most one learning suggestion per latest answer, avoiding repeated cards in the thread.
- Record only one first attempt per lesson question. A learner can try again, but seeing the answer does not retroactively improve a first-attempt score. Self-review is a separate field, not evidence of mastery.
- Keep lesson completion unchanged and independent. A single quick check does not complete a lesson. Practice records are bounded by known lesson IDs and actual quiz slots; parsing strips extra fields.
- Preserve ChatProvider/VoiceProvider above the router and keep the companion outside the route outlet. Lazy routes must not discard the shared conversation or spawn a new voice controller.
- Use route-based splitting and a real initial-request budget instead of suppressing Vite's bundle warning. The budget includes shared chunks and tests that page/chart/practice chunks are absent on the home route.
- Preserve extensive pre-existing local work. No backend/API behavior, financial lesson facts, image artwork, remote PR or deployment changed.

## Gotchas

- A response needs safety status `passed` before it gets learning suggestions; old stored replies or fixtures without that status will not show them.
- Written self-explanations are deliberately ephemeral. Collapsing practice, switching routes, or receiving a new reply can discard them. Only the learner's self-review choice and first quiz results persist.
- `?from=scout` controls the lesson return link; it contains no written answers or portfolio information. Return goes to full Advisor.
- Existing UI checks must await lazy navigation. The holdings-research browser check now waits for the selected symbol in the destination URL rather than assuming an immediate change.
- The known WSL sandbox mount failure required local-command escalation. Windows Node does not receive arbitrary WSL env vars automatically, so actual browser invocations set `process.env` before requiring scripts. Production preview is at port 5177, dev preview at 5176.
- The practice module has an explicit load-failure fallback. A failed route chunk offers Reload/Return home. Human comprehension has not been validated; automated tests cannot establish learning outcomes.

## Next steps

1. Review `/advisor`: ask about diversification, open Keep learning → Try a quick check, try an incorrect answer, write an explanation and self-review. Open the lesson and return to the saved chat draft.
2. Check Learn's practice review and separate reset; try a phone and blocked storage.
3. Run the five-participant [study protocol](../design/learning-flow/beginner-check.md), recording pre/post and delayed explanations separately from confidence. No participant outreach has been performed.
4. Keep the production JS budget check when extending the app. Consider separately optimizing existing mascot/font assets after measuring total-page traffic on slower devices.
5. If remote work is authorized, include this handoff in the PR, use `team:frontend`, and require green `ci-ok`; retain the earlier live provider/model/deployment verification tasks.

## Open questions / blockers

No local implementation blocker. The new learning bridge and UI behavior are verified with synthetic API fixtures. Actual learner improvement, real device keyboard behavior and live provider/model correctness remain unmeasured. A teach-back self-review should never be relabeled as an automatic correctness or mastery score.
