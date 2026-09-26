# Beginner-friendly Learn tab: starter path, quizzes, FAQ, flashcards, growth illustration

- **Date:** 2026-09-26
- **Author:** @MaxCadet
- **Team:** frontend
- **Status:** done
- **PR / issue:** (this PR)
- **Branch:** feat/learn-beginner-path
- **Follows:** 2026-09-26-frontend-inclusive-investing-experience.md

## What changed

- `/learn` is now built for people who have never invested (feedback from the Blackstone workshop:
  "make beginners feel welcome"). It keeps the hero and `h1` and adds progress (lessons done, daily streak,
  a progress meter) and a primary "Start your first lesson" / "Continue: …" action.
- **Starter path:** 4 units × 3 lessons (`src/lib/lessons.ts`): before you invest, what you can buy,
  where your money lives (brokerage, 401(k)/TSP/match, Roth vs traditional), habits that help (DCA,
  market drops, scams). No lesson is locked; the next unfinished one is marked "Up next".
- **Lesson player** at `/learn/:lessonId` (`src/features/learn/LessonPage.tsx`): three short idea cards
  with examples, then a two-question quick check with instant right/wrong feedback and an explanation,
  then a completion screen with score, streak, "Next lesson" and "Ask the advisor about this" (prefill only).
- **Questions beginners ask:** 10 FAQs (`src/lib/faq.ts`), each with an "Ask a follow-up" advisor link.
- **See what time can do:** a compound-growth illustration (`GrowthCalculator.tsx`), sliders for monthly
  amount and years, and 4/6/8% hypothetical rate. Always labeled as an illustration, not a projection.
- **Glossary:** 8 → 25 terms, plus a Flashcards mode (Quizlet-style: reveal, "I knew it" / "Still learning",
  shuffle, start over). Browse mode and its search are unchanged.

## How to run / verify it

```bash
npm ci
npm run mock          # terminal 1, Prism on :4010
npm run dev           # terminal 2, open http://localhost:5173/learn
npm run lint && npm run typecheck && npm test && npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:browser -w frontend   # with Vite running
```

New unit tests in `src/lib/learn.test.ts`: lesson ids unique and quiz answers valid, next-lesson logic,
streak across days/months/years and lapse after a missed day, growth formula, whole-dollar formatting.
`browser-smoke.cjs` now also completes lesson 1 (both answers), checks "1 of 12 lessons done", and uses
flashcards. It no longer hard-codes the glossary size.

## Decisions & why

- **Progress is device-only** (`localStorage` key `cv-learn-progress`, through `storage.ts`), like the
  other per-device preferences. No backend changes, no account needed, and "Reset progress" clears it.
- **Completion is recorded in the click handler, not an effect** (the `react-hooks/set-state-in-effect`
  lint rule rejects the effect version).
- **Nothing is locked** so people can jump to what they are curious about (DESIGN.md §6.2 says no
  assumptions about expertise). "Up next" gives the Duolingo-style guidance without gating.
- **Retirement numbers** match `src/advisor/advisor/data/retirement_accounts.json` (2026: $24,500 401(k)/TSP
  + $8,000 catch-up; $7,500 IRA + $1,100 catch-up). If one changes, change both.
- **Growth illustration uses `currencyWhole`**, a new `format.ts` helper, because cents on a
  30-year hypothetical imply false precision. Account balances still use `currency`.
- Content is educational and hedged ("many people", "often"), never a recommendation, and every page
  keeps the not-financial-advice line.

## Gotchas

- Quiz answer styles use `.option.optionRight` (two classes) on purpose: a single class lost to the
  base `.option` rules for disabled buttons.
- `filterTerms(' etf ')` must return only ETF (unit and browser tests). Don't write the literal "ETF"
  inside other glossary meanings; say "exchange-traded fund".
- The streak uses the device's local calendar day and lapses after one full missed day.

## Next steps

1. Optional: an "Explain this term" voice button on flashcards, using the existing `/voice/speak`.
2. Optional: link the relevant lesson from Portfolio/Advisor (e.g. risk card → "Don't put all your
   eggs in one basket").
3. Rehearse the demo path: Learn → Start first lesson → quick check → Ask the advisor.

## Open questions / blockers

- None. Content review welcome from anyone. Wording lives in `src/lib/lessons.ts`, `faq.ts` and
  `learning.ts`, so edits don't touch components.
