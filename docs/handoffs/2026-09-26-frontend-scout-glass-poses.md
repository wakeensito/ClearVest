# Scout peek/body reveal and glass conversation panel

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done (pose and panel refinement)
- **PR / issue:** Related draft #42; this work is local and uncommitted, with no remote updates.
- **Branch:** `feat/advisor-companion`
- **Follows:** [Scout motion and UI](2026-09-26-frontend-scout-motion-ui.md)

## What changed

- Added a matched four-pose body atlas: peek with resting paws, listen with wings at the sides, think with one wing under the beak, ready with a raised wing. Built-in image generation preserved the supplied reference's identity and removed pupils for independent eye animation.
- Scout now rests in peek. Hover, opening or visible keyboard focus raises his body inside a fixed clipped frame, revealing his torso. This replaces the subtle whole-character rotation. A real reply gives a short ready acknowledgment before settling back.
- Reworked the panel into translucent blue-gray glass with backdrop blur, fine highlights, restrained bubbles and quieter controls. Added green EXPERIMENTAL labels beside the panel name and resting launcher.
- Set the subtitle to “Your moral support, whenever you need it.” on one line. Removed Quiet motion and Minimize, including their old persisted behavior. Device reduced-motion preferences remain supported.
- The centered question mark reveals information on hover/focus, dismisses with Escape, and can receive touch focus. It is a focusable information icon, not a disclosure button. Updated the standalone preview, prompt provenance and browser regression checks.

## How to run / verify it

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run dev
# In another terminal, pointing at the Vite server:
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5173 npm run test:scout -w frontend
python3 -m json.tool docs/design/advisor-companion/prompts.json >/dev/null
git diff --check
```

The browser test mocks API responses. It supports `PLAYWRIGHT_CHANNEL` and
`PLAYWRIGHT_CHROMIUM_EXECUTABLE`; this environment used Windows Chrome and local
port 5176 through the Windows Node toolchain in WSL.

Lint, TypeScript, 82 frontend tests and production build passed. The build retains
its existing large-chunk advisory. Browser coverage includes intermediate body
rise and pupil positions, all companion routes, shared draft/thread, retries,
experimental labels, removed controls, tooltip hover/focus/Escape, reduced motion,
320px panel geometry, the complete single-line subtitle and simulated mobile
keyboard geometry. Screenshots were reviewed for all four enlarged poses and the
desktop/mobile panel. No live AI/backend call was used for these checks.

## Decisions & why

- The body moves; the outer launcher stays fixed. This keeps the resting edge and hit target stable while visibly revealing more torso.
- Registered pose layers dissolve while continuous pupils/eyelids animate over them. This supplies the requested wing gestures without claiming full skeletal animation.
- Head alignment uses per-pose registration offsets because the generated grid has uneven gutters. The live atlas is 1254×1254; offsets are recorded in `Scout.tsx`.
- Ready lasts approximately 2.2 seconds after a new reply, not indefinitely because old history exists. Pointer hover and keyboard-visible focus are tracked separately so closing with the mouse does not permanently raise Scout.
- The exact full subtitle gets a dedicated full-width header row. It remains on one line at 320px.
- The user explicitly removed local motion/minimize controls. Do not reintroduce them based on older handoffs. The glass treatment includes an opaque fallback and respects contrast/transparency preferences where supported.
- Do not commit/push or update the remote draft without the user's instruction.

## Gotchas

- Image asset: `frontend/public/images/scout/scout-body-poses.png`; exact prompt: `docs/design/advisor-companion/prompts.json`; interactive preview: `docs/design/advisor-companion/scout-preview.html`.
- Pose transitions use crossfades and a real rising transform; continuous wing deformation would still require a skeletal/layered wing rig. Old PNGs remain as reference, not live UI assets.
- Hover information also supports keyboard focus and touch focus. The first Escape dismisses information; another Escape can close the panel.
- Backend connectivity, automatic screen context, economic/news grounding and model improvements are unchanged. Existing browser checks use fixtures, not live model responses.
- Physical mobile keyboard/transparency behavior still needs device review; automated coverage simulates visual-viewport changes.

## Next steps

1. Review peek → listen body reveal, actual think/ready gestures, glass styling and information hover in the local app.
2. Continue the planned validated page-context contract, evidence sourcing and model evaluation.
3. If richer continuous wing motion is requested, prepare independent wing layers without sacrificing the approved character proportions.
4. Push/update draft #42 only on explicit user instruction; require green `ci-ok` before merge.

## Open questions / blockers

No blocker for the pose/UI refinement. All changes are local; live service
availability and the broader AI intelligence work remain separate.
