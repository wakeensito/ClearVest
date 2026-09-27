# Tap-to-explain on Markets: fund explainer and Compare companies

- **Date:** 2026-09-27
- **Author:** @MaxCadet
- **Team:** frontend
- **Status:** done
- **PR / issue:** (this PR)
- **Branch:** feat/markets-tap-to-explain
- **Follows:** 2026-09-27-frontend-tap-to-explain.md

## What changed

Next step 1 from the tap-to-explain handoff: the same dotted-underline explanations now appear on Markets.

- **Fund explainer** (`FundExplainer.tsx`): the "What is it?" sentence and each "Keep learning" answer. For example,
  "VOO is an **index fund**…" → tap → meaning + "Lesson: Funds: index funds and ETFs".
- **Compare companies** (`CompanyComparison.tsx`): the focus description, each metric description and the
  "How do I compare companies fairly?" help text (P/E, earnings per share → guided research).
- `explain-terms-smoke.cjs` now also covers the fund explainer (390px, popover inside the viewport, lesson link)
  and the compare help text (P/E → guided research), with no page overflow.

## How to run / verify it

```bash
npm ci
npm run mock          # terminal 1
npm run dev           # terminal 2 → /markets?symbol=VOO → "What is this?"; /markets?view=companies
npm run lint && npm run typecheck && npm test && npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:explain -w frontend   # with Vite + mock
```

All 181 unit tests pass (including `FundExplainer.test.ts`, whose text checks are unchanged because the
visible words are identical). All seven browser suites pass, including `fund-explainer-smoke` and
`company-comparison-smoke`.

## Decisions & why

- Only text a beginner reads to understand the fund or ratio is wrapped. Numbers, the dollar strip, the fee line
  (which already teaches "expense ratio" inline) and company descriptions are left alone.
- Uses the existing `ExplainText` component, so meanings stay in sync with the Learn glossary.

## Gotchas

- `ExplainText` marks each term once *per text block*. Two separate metric descriptions can both underline P/E;
  that's intended, since each card is read on its own.
- `fund-explainer-smoke.cjs` defaults to port 5174 and its own Playwright browser; see the previous handoff's Gotchas.

## Next steps

1. Optional: "Unit complete ✓" badge on Learn (Mario's area).

## Open questions / blockers

- None.
