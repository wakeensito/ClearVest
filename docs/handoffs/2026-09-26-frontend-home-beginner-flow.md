# Home: clear first step, share check → lesson 1, one progress panel

- **Date:** 2026-09-26
- **Author:** @MaxCadet
- **Team:** frontend
- **Status:** done
- **PR / issue:** (this PR)
- **Branch:** feat/home-beginner-flow
- **Follows:** 2026-09-26-frontend-beginner-journey-financials.md, 2026-09-26-frontend-learn-research-integration.md

## What changed

From the Home + Learn review posted in the team chat (items 2–5). Only Home was touched; Learn files are Mario's.

- **Clear first step above the fold:** a primary "Start your first lesson" button under the headline
  (becomes "Resume: <lesson>" or "Review your lessons"), plus "Or try a 1-minute idea first" jumping to the share example.
- **Share check flows into lesson 1:** after a correct answer to "Does owning a share guarantee a profit?",
  a "Next: What investing actually is →" card links to the first unfinished lesson.
- **Path links look clickable:** each "Take your next small step" link ends with a blue action label and arrow
  ("Start learning" / "Continue", "Explore", "Open portfolio"), which nudges on hover.
- **Less jargon:** the milestone "Explain a P/E ratio" is now "Understand how a stock is priced". The milestone id
  (`pe`) and the P/E quick check on Markets are unchanged.
- **One progress panel:** "Your research milestones" is replaced by "Your progress": starter lessons
  (count, meter, link to Learn) beside research skills (the three milestones).

## How to run / verify it

```bash
npm ci
npm run mock          # terminal 1
npm run dev           # terminal 2 → http://localhost:5173/
npm run lint && npm run typecheck && npm test && npm run build
# With Vite + mock running:
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node frontend/scripts/browser-smoke.cjs
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node frontend/scripts/learn-integration-smoke.cjs
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node frontend/scripts/beginner-journey-smoke.cjs
```

All three browser suites pass. `beginner-journey-smoke.cjs` now also checks that the headline button
and the post-check "Next" card both link to `/learn/what-is-investing`, and that "Your progress" shows lesson progress.

## Decisions & why

- **Lessons and research milestones stay two separate stores**, shown in one panel. Merging the data would
  change Learn's storage (Mario's area) and the reset rules (reset lessons leaves research milestones alone).
- The "Next" card only appears after a *correct* answer, so the wrong answer's "Try again" stays the focus.
- Existing texts the browser suites rely on are kept: "N of 3 ideas explored.", "Continue learning",
  "N of 12 lessons complete", "Explore a real company".

## Gotchas

- The action labels inside the path links are `aria-hidden`, so link names stay "Build the basics …",
  "Explore a real company …" and tests using those names still match.
- The "Next" card's accessible name starts with its small label ("Next idea · 3 minutes Next: …"). Match it
  with `/Next: What investing actually is/`, not `^Next:`.

## Next steps

1. Learn (Mario): collapsed Unit 2 card stretches to Unit 1's height and leaves an empty box. `align-items: start`
   on `.units` in `LearnPage.module.css` fixes it.
2. Review items 6–9 (tap-to-explain jargon, lesson suggestions in context, unit-complete badge, advisor
   character as guide) are still open.

## Open questions / blockers

- None.
