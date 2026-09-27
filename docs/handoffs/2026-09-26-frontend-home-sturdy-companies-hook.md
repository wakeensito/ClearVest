# Home: "How do investors spot sturdier companies?" hook after the share check

- **Date:** 2026-09-26
- **Author:** @MaxCadet
- **Team:** frontend
- **Status:** done
- **PR / issue:** (this PR)
- **Branch:** feat/home-sturdy-companies-hook
- **Follows:** 2026-09-26-frontend-home-beginner-flow.md

## What changed

Requested by @wakeensito: right after someone answers "No, its value can fall", hook them into learning how
to judge companies.

- New `CompanyClues` panel (`src/components/education/CompanyClues.tsx`, content in `src/lib/companyClues.ts`)
  replaces the plain "Next: <lesson>" card on Home. It appears once the share check is answered correctly.
- **Four clues** from the financial statements, each as a plain question: Is it selling more? (revenue),
  Is it actually making money? (net income), Can it handle its debts? (debt), Is the price sensible? (P/E).
- **Caution line:** clues lower the odds of surprises but never guarantee a price won't drop, which is why
  investors diversify.
- **Actions:** primary "Check these clues on Apple" → guided company research (`/markets?symbol=AAPL&guided=1`,
  which walks through the business, sales & profit / income statement, and price & value). Secondary "Ask the
  professor to explain" → advisor with a prefilled prompt asking it to teach like a patient finance professor,
  one idea at a time (revenue, net income and the income statement, debt, P/E), with no guarantees, and to suggest
  the next ClearVest lesson. Below: "Next: <first unfinished lesson>" into Learn.

## How to run / verify it

```bash
npm ci
npm run mock          # terminal 1
npm run dev           # terminal 2 → http://localhost:5173/ and answer "No, its value can fall"
npm run lint && npm run typecheck && npm test && npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node frontend/scripts/beginner-journey-smoke.cjs   # with Vite + mock
```

New `src/lib/companyClues.test.ts` checks the four clues and that the professor prompt keeps the
no-guarantee wording and round-trips through the link. `beginner-journey-smoke.cjs` now checks the hook heading,
the guided research link and the prefilled professor link. All three browser suites pass.

## Decisions & why

- **"Sturdier", not "won't fall":** the request was "companies least likely to fall". The copy frames these as
  clues about financial health and says plainly that nothing guarantees a price won't drop, in line with the
  app's educational-only stance.
- **The professor is a prefilled question, not a new advisor mode.** It works with today's advisor and doesn't
  touch the system prompt or Akif's advisor-character work. Nothing is sent until the person presses send.
- Debt has no guided step yet, so it is explained here and in the professor answer only.

## Gotchas

- The "Next" lesson link keeps its accessible name pattern (`/Next: What investing actually is/`) that the beginner
  journey suite relies on.
- Constants live in `src/lib/companyClues.ts` because the react-refresh lint rule rejects non-component exports
  from `.tsx` files.

## Next steps

1. Optional: add a "Can it handle its debts?" step to guided research (balance sheet: debt vs. cash), so all four
   clues have a hands-on place.
2. Optional: if the advisor character lands, give it a "professor" voice for prompts that start "Teach me like…".

## Open questions / blockers

- None.
