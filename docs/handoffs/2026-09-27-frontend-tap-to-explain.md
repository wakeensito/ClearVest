# Tap-to-explain jargon in advisor replies and the risk card, plus "Related lesson" links

- **Date:** 2026-09-27
- **Author:** @MaxCadet
- **Team:** frontend
- **Status:** done
- **PR / issue:** (this PR)
- **Branch:** feat/tap-to-explain
- **Follows:** 2026-09-26-frontend-home-sturdy-companies-hook.md

## What changed

Items 6 and 7 from the Home + Learn review ("learning as you go").

- **Tap-to-explain jargon:** investing terms in advisor replies (ETF, index fund, expense ratio,
  diversification, volatility, 401(k), Roth IRA, P/E, revenue, net income and ~20 more) get a dotted underline.
  Tapping opens a small explanation with the plain-language meaning and a link to the lesson that teaches it,
  or to guided research on Apple for company terms. Each term is marked once per reply.
- **Related lesson:** every advisor reply that mentions a lesson term ends with "Related lesson: <title>".
- **Portfolio risk card:** the risk explanation and "What shapes this score" factors use the same tap-to-explain,
  and the card links to the diversification lesson.
- New files: `lib/explainTerms.ts` (term list, matching, lesson links), `components/education/Term.tsx`
  (`Term`, `ExplainText`), `components/education/RelatedLesson.tsx`, `scripts/explain-terms-smoke.cjs`
  (`npm run test:explain -w frontend`). DESIGN.md §4.14 documents the pattern.

## How to run / verify it

```bash
npm ci
npm run mock          # terminal 1
npm run dev           # terminal 2 → /advisor, ask anything; /portfolio for the risk card
npm run lint && npm run typecheck && npm test && npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:explain -w frontend   # with Vite + mock
```

Unit tests: `src/lib/explainTerms.test.ts` (text preserved, once per reply, longest phrase wins, word boundaries,
acronyms only in capitals, lesson/research links, related lesson). All 181 unit tests pass, including the existing
Markdown rendering tests unchanged. All seven browser suites pass (browser, learn-integration, beginner-journey,
company-comparison, fund-explainer, history-refresh, and the new explain suite).

## Decisions & why

- **Opt-in on `Markdown`** (`<Markdown text explain />`). Without `explain` the renderer outputs exactly the same
  HTML as before, so `parseMarkdown.test.ts` is untouched and other callers are unaffected.
- **One render pass per reply.** `inline()`/`table()` in `Markdown.tsx` are plain functions, not components, so
  the shared "already explained" set is spent once. As child components, React's development double render
  used the set up on the first pass and no terms appeared.
- **Meanings come from the glossary** (`lib/learning.ts`), so Learn and the advisor never disagree. Only research
  terms the glossary lacks (P/E, revenue, net income, EPS, S&P 500, TSP, concentration) are defined in
  `explainTerms.ts`.
- **"Stock" and "portfolio" are deliberately not marked.** They appear in almost every reply and would add noise.
- The popover is positioned in the click handler (not an effect) to satisfy the `set-state-in-effect` lint rule.

## Gotchas

- `fund-explainer-smoke.cjs` ignores `PLAYWRIGHT_CHROMIUM_EXECUTABLE` and defaults to port 5174. To run it
  against the usual dev server: `CLEARVEST_PREVIEW_URL=http://127.0.0.1:5173` and a Chromium Playwright can find.
- Term buttons are named "<term>: what does this mean?" for screen readers. Tests should use that name.
- Advisor replies render the same text; only the wrapping changes. A reply with no known terms looks exactly as before.

## Next steps

1. Optional: add tap-to-explain to Markets text (fund explainer answers, comparison metric descriptions).
2. Optional: "Unit complete ✓" badge on Learn (review item 8, Mario's area).

## Open questions / blockers

- None.
