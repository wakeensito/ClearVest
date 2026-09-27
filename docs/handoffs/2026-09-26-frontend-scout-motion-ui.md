# Scout continuous motion and navy companion UI

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done (positioning, motion and companion UI refinement)
- **PR / issue:** Related draft #42; this work remains local and uncommitted. No remote updates.
- **Branch:** `feat/advisor-companion`
- **Follows:** [Scout companion refinement](2026-09-26-frontend-scout-companion-refinement.md)

## What changed

- Fixed the resting height: visible wings meet the desktop viewport bottom and mobile navigation top. The old atlas's transparent padding and extra bottom offset caused Scout to float above the edge.
- Replaced live pose swapping with a shaded raster rig base plus independently clipped SVG pupils and eyelids. Pupils glide, blink and respond locally to mouse movement over Scout. Hover lifts the launcher; thinking eases into an upward gaze/tilt; a separate reaction layer gives a ready nod without interrupting the body transition.
- Redesigned the panel with scoped ink/deep navy, warm yellow controls, pale text, rounded conversation shapes and an asymmetric panel corner. The surrounding website retains its existing palette.
- Added beginner starters, simpler/example follow-up prompts, a calmer failed-question area with Retry and Edit question, and an About Scout disclosure. Shared messages/draft, minimization, quiet mode, responsive sizing and existing chat transport remain intact.
- Updated the standalone animation preview, exact image prompt provenance and browser checks.

## How to run / verify it

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run dev
# In another terminal, against the local Vite URL:
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5173 npm run test:scout -w frontend
python3 -m json.tool docs/design/advisor-companion/prompts.json >/dev/null
git diff --check
```

The browser test uses mocked API replies and accepts `PLAYWRIGHT_CHANNEL` or
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` for an installed browser. Windows Chrome and
local port 5176 were used here via the Windows npm toolchain in WSL.

Passed: 82 frontend tests and Scout browser checks, including actual intermediate
pupil-transform positions, hover lift, desktop edge alignment, all target routes,
shared conversation/draft, retry/edit recovery, reduced motion, mobile geometry
and a simulated keyboard visual viewport. No browser page errors. Lint,
TypeScript and build are checked before completion; the existing large-chunk
build advisory remains. Visual review covered enlarged pupil placement and
navy panel screenshots at desktop and 320px mobile width.

The artwork was generated with built-in `image_gen`; its prompt is stored in
`docs/design/advisor-companion/prompts.json`. `scout-rig-base.png` is 1254×1254
with measured visible alpha bounds x31–1223, y134–1147. The SVG viewBox removes
the external padding without modifying the preserved PNG.

## Decisions & why

- Preserve the reference face; remove pupils from the raster base so independent eye movement does not leave duplicate pupils behind. Hide the rig until its image loads to avoid briefly showing floating eyes.
- Use smooth transforms rather than animated background positions. Separate body tilt and reply reaction groups so overlapping animations do not snap between states.
- Limit pointer response to Scout's own artwork. There is no document-wide cursor tracking, gaze tracking, screenshot collection or new API call for animation.
- Keep the navy/yellow tokens inside the companion panel, including shared Markdown tables, so this distinct help UI does not recolor the website.
- Keep motion finite/quiet by default, pause in hidden tabs, and respect reduced motion. The panel remains explicitly nonmodal and keyboard-accessible.
- Do not push or update remote PR #42 without explicit user instruction.

## Gotchas

- This is a 2.5D eye/body rig, not a full 3D model or separately articulated wing system. Old pose assets remain as reference but are no longer used by the live character.
- The screenshots' network failures were not resolved by this UI work. Mocked browser tests verify recovery controls, not live service availability.
- Automatic page context, sourced news and model improvements remain separate work; the existing backend receives typed text only.
- Physical iOS/Android keyboard behavior still needs device review; tests simulate the visual viewport.
- A retained edited draft makes Scout attentive after a retry succeeds. Tests clear their edit draft before expecting the ready state; the app correctly preserves a user's draft.

## Next steps

1. Review the revised Scout in the local app and standalone motion preview, especially hover, thinking transitions and resting position.
2. Implement the previously planned validated page-context contract and dated evidence/model evaluation.
3. If richer wing gestures are needed, prepare separate matching raster layers; do not reintroduce whole-frame swapping.
4. Push and update the draft PR only when the user instructs it; require green `ci-ok` before merge.

## Open questions / blockers

No blocker for this UI/motion milestone. Live backend connectivity and the broader
AI context/intelligence work were not changed. All edits remain local.
