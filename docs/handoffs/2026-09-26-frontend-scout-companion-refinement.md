# Reference-based Scout and persistent bottom-right conversation

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done (artwork and companion interaction milestone)
- **PR / issue:** Related draft #42; this milestone is local and uncommitted, with no remote updates.
- **Branch:** `feat/advisor-companion`
- **Follows:** [Initial Scout mascot](2026-09-26-frontend-scout-mascot.md), [Companion exploration](2026-09-26-frontend-advisor-companion-exploration.md)

## What changed

- Replaced the rejected flat vector mascot with a transparent six-pose raster atlas preserving the supplied Scout reference's soft rendering, rounded head, white face, golden beak and wings. Built-in image generation created the artwork; the exact prompt is in [prompts.json](../design/advisor-companion/prompts.json).
- Added a persistent bottom-right Scout on Home, Portfolio, Markets, Learn and lesson routes, outside the pathname-keyed outlet. The latest user correction supersedes the earlier bottom-left proposal. Advisor retains its inline character without a floating duplicate.
- Clicking lifts Scout and opens a nonmodal panel above/left, connected to the existing chat provider. The panel and full Advisor share messages, pending requests, retries and an in-memory draft. Navigation and closing do not cancel a pending reply.
- Added finite glances/blinks, thinking and ready poses, hidden-tab pause, reduced motion, persistent quiet/minimize preferences, Escape/focus restoration, and mobile visual-viewport sizing. Added a [standalone motion preview](../design/advisor-companion/scout-preview.html).
- Added `frontend/scripts/scout-smoke.cjs` and `npm run test:scout -w frontend` for placement, shared conversation and keyboard/mobile regressions.

## How to run / verify it

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run dev
# In another terminal, with the frontend and default mock API base configured:
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5173 npm run test:scout -w frontend
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5173 npm run test:browser -w frontend
python3 -m json.tool docs/design/advisor-companion/prompts.json >/dev/null
git diff --check
```

The browser scripts intercept the mock API with fixtures; a real AI service is
not required. `test:scout` accepts `PLAYWRIGHT_CHANNEL` (for example, an installed
Chrome) or `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. The existing app-wide script accepts
the latter. In this WSL environment npm runs through Windows `cmd.exe /c`.

Passed: lint, TypeScript, 82 frontend tests, production build, Scout browser
checks and the existing app-wide browser smoke. Scout checks include all target
routes and a lesson, persistent DOM/draft/thread, full Advisor transition,
request deduplication, failure/retry, quiet/minimize persistence, keyboard focus,
reduced motion, 320px geometry and a simulated 420px keyboard visual viewport.
No browser page errors. Build retains its large-chunk advisory.

Reviewed the artwork over the app background and desktop/mobile screenshots.
The PNG has actual alpha transparency (verified), not a baked checkerboard.
Screenshots are ignored local artifacts in
`frontend/node_modules/.cache/clearvest-review/`. The local app preview used
port 5176. No live-provider AI quality or physical-phone keyboard claims.

## Decisions & why

- Preserve the reference's soft shading with matched raster poses. This is an initial pose-based animation pass, not a layered eye/wing rig. Continuous eye motion would require more art preparation; do not replace it with another simplified vector approximation.
- The atlas is 1536×1024, arranged in three columns and two rows. CSS compensates for the second row's approximately 43px baseline offset. Preserve this alignment if replacing the asset.
- Mobile and desktop panels are explicitly nonmodal. The page remains accessible; Escape returns focus. No misleading focus trap or `aria-modal=true` claim.
- Keep the existing backend contract. Copy asks users to mention a company/topic, without claiming automatic screen awareness.
- The user's explicit local-only instruction overrides generic handoff push guidance. Do not push or update remote PR #42 until asked.

## Gotchas

- Automatic stock/lesson/risk context, sourced news and model improvements remain future work. `/advisor/chat` still receives the typed message only.
- Voice remains on full Advisor. The compact panel offers text and a link to the full workspace.
- The PNG is about 1.8 MB and fetched as one shared asset. Further delivery optimization should preserve transparency and appearance.
- The browser's visual viewport is handled and simulated in tests; still review an actual iOS/Android keyboard before production rollout.
- Minimize leaves a small “Ask Scout” control so the user can restore the character. Drafts are memory-only; quiet/minimized preferences persist locally.
- Prior handoffs describe superseded decisions and are intentionally unchanged.

## Next steps

1. Review Scout's actual corner size, likeness and motion in the local app or standalone preview.
2. Add typed page-context registration and validated per-turn snapshots, including context disclosure and retry consistency.
3. Add dated evidence/source metadata and evaluate model configurations using the existing proposal.
4. If smoother gaze/wing motion is needed, prepare consistent independent raster layers from this reference and validate at small sizes.
5. Push/update the draft PR only on explicit user instruction; require green `ci-ok` before merge.

## Open questions / blockers

No blocker for this artwork/interaction milestone. The remaining intelligence
work needs the context contract and evidence/evaluation implementation described
in the proposal. The user has not authorized a push.
