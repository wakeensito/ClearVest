# Portfolio X-ray, plan vs. today, ticker what-if, one search box, watchlist, and stock research fields

- **Date:** 2026-09-27
- **Author:** @wakeensito
- **Team:** frontend
- **Status:** done
- **PR / issue:** not opened yet
- **Branch:** `task/7b` (worktree `/Users/wakeensito/ClearVest-t7b`, integration branch for tasks 1–7a; unmerged)
- **Follows:** [Fund explainer: "What is this?" in security research](2026-09-27-frontend-fund-explainer.md), [Company research: dividend yield, market cap, beta, next earnings date, P/E vs its own history](2026-09-27-data-research-advisor-fields.md)

## What changed

This is the consolidated handoff for everything merged into this integration branch across tasks
1–7a (no per-task handoff was written along the way). Someone picking this up should be able to
demo the whole thing without reading the commit history.

- **What you really own** (`components/portfolio/OwnershipXray.tsx`, `section#xray`, DESIGN.md
  §4.14): opens the Portfolio main column, above Security research. Opens each ETF/mutual fund's
  top 10 holdings (`lib/useFundMap.ts`, capped at 8 funds/account) and folds them into the
  account's direct stock positions (`lib/portfolioXray.ts`) to say who the money is really in —
  "Apple is about 20% of your money: 14% directly, 6% inside VOO, QQQ and VGT." — plus a "What it
  costs" fee panel (blended expense ratio, dollars/year, 10-year projection, a cheapest-fund
  comparison, and a Fund/Expense ratio/Per year table). Every degraded state (no funds looked
  through, a fund still loading, an empty account) has its own honest sentence instead of a wrong
  number.
- **Your plan vs. today** (`components/portfolio/PlanVsActual.tsx`, `[data-plan-vs-actual]`, in the
  "Your plan vs. today" rail card, DESIGN.md §4.14): compares the account's stocks/bonds/cash/other
  mix (`lib/targetMix.ts`) against one of five bundled model portfolios (`GET /market/templates`,
  mirrored from `src/market/market/data/templates.json`) picked automatically from the user's
  profile (`suggestTemplate`), with a "Suggested for you" badge, a one-sentence gap description
  (`drift()`), and a prefilled (never auto-sent) link into the advisor.
- **What would this do to my portfolio?** (`components/market/WhatIfCard.tsx`,
  `[data-what-if="SYMBOL"]`, under the ticker page's identity row, DESIGN.md §4.15): before adding
  money to a security, shows how the account's exposure to it and its risk score
  (`lib/risk.ts`, a TS port of the backend `risk.py`) would move, for $500 / $1,000 / $5,000 or a
  typed amount. Nothing is sold; every weight renormalizes. Renders nothing at all while anything
  needed is loading, for an unlinked/empty account or an index — the Portfolio page already invites
  linking, so this card doesn't repeat that invitation (see **Gotchas** for a related smoke-test
  finding).
- **One search box with type-ahead** (`components/market/SymbolSearch.tsx`): a single ticker/company
  text box replaces the old separate search affordances, listing up to eight `/market/search`
  results after a 300ms debounce; Enter follows `resolveSubmit` (exact ticker match wins over a
  race with an in-flight request).
- **Watchlist and a demoted market board** (`components/market/Watchlist.tsx`,
  `lib/watchlist.ts`): a star toggle ("Watch" / "Watching") next to a security's identity line adds
  it to a per-user, `localStorage`-backed watchlist card showing 1-year price return; "Market
  activity: most active, gainers and losers" is now a closed-by-default `<details>` section instead
  of the page's headline content, so the board's JS/queries don't mount until it's opened.
- **Stock research fields** (backend, from the data team — see the linked data handoff): `GET
  /market/company-research` gained `valuation.dividendYield`, `profile.beta`,
  `profile.marketCap`, and `profile.nextEarningsDate`. The frontend's `CompanyFinancials` gained a
  fourth "Payouts" step ("Does it pay you to wait?"), a P/E-versus-its-own-history sentence, a
  compact "Worth about USD 3.4T on the market" line, and a quiet "Next earnings report: …" line.
  Backend cache keys moved `research:v1:*` → `research:v2:*` so a cached snapshot from before these
  fields existed is never served against the new contract — **if you deploy this, expect a cold
  cache for company research the first time each symbol is requested again.**

## How to run / verify it

```bash
npm ci                                                  # from the repo root; installs the workspace
npm run lint && npm run typecheck && npm test && npm run build

# Against a live deployed backend:
cp frontend/.env.example frontend/.env.local            # set VITE_API_BASE_URL to the stack's ApiUrl
npm run dev                                             # from the repo root; http://localhost:5173
# Portfolio -> "Use a sample account" exercises every card in this handoff with real data.

# Phone checks (API calls intercepted with fixtures; no backend or Prism needed):
cd frontend
npx vite --port 5174 --strictPort --host 127.0.0.1 &
npm run test:browser            # full-app desktop + phone regression (theme, onboarding, holdings, ...)
npm run test:fund-explainer     # "What is this?" security research explainer (DESIGN.md §4.13)
npm run test:markets-advisor    # markets discovery: watchlist, search, company financials
npm run test:portfolio-xray     # NEW: what you really own, plan vs. today, ticker what-if (§4.14–§4.15)
npm run test:history-refresh    # background market-history refresh polling
kill %1                         # stop the dev server
```

Measured with `frontend/scripts/portfolio-xray-smoke.cjs` at 320/375/393px: no horizontal overflow
in any state (base card, hidden values, plan switch, degraded/pending fund states, ticker what-if,
unlinked). Screenshots land in `frontend/node_modules/.cache/clearvest-review/` (git-ignored).
`npm test` is 369/369 passing at the time of writing; `npm run build` succeeds (pre-existing
`>500kB` chunk-size warning, unrelated to this work).

## Decisions & why

- **Look-through only counts each fund's top 10 holdings, and says so.** `lookThrough()` has no way
  to see what's below a fund's disclosed top 10, so every exposure number in the X-ray and what-if
  cards is a **lower bound**, and the copy says "counting your funds' top 10 holdings" rather than
  implying completeness. A company can jump in value when it newly appears in a top 10 on the
  "after" side of a what-if — that's real, not a bug.
- **Fees never name a fund as "the cheapest" beyond the comparison sentence.** No fund is ever
  recommended (`feeCopy` in `lib/xrayCopy.ts`); the "if every fund cost what your cheapest one
  does" sentence only fires when it would save at least $1, so it never nags over noise.
- **Unchecked funds count as stocks in the plan comparison.** `targetMix.classify()` defaults an
  ETF/mutual fund with no loaded `category` yet to `'stocks'`, and the caption says "assumes
  unchecked funds hold stocks" — an honest default that also happens to be right most of the time,
  rather than blocking the whole card on every fund resolving first.
- **`lib/risk.ts` is a hand-maintained TypeScript port of `src/layer/clearvest/risk.py`**, not a
  network call — the what-if card needs a synchronous "before vs. after" score, and calling the
  backend twice per keystroke wasn't worth it. The two implementations are tested against the same
  fixtures (`risk.test.ts` mirrors the backend's own risk tests); **if `risk.py`'s formula changes,
  `risk.ts` must be updated by hand and its tests re-verified.**
- **The drift sentence leads with the biggest over-gap, then falls back to the biggest under-gap,**
  except when the single biggest gap is bonds or cash the account holds *none* of while the plan
  keeps 10%+ there — then "Nothing in bonds, where the … plan keeps 40%" leads instead, because an
  empty asset class is the more actionable story than "you're 6 points overweight in cash."
- **Unlinked accounts still let their fetches run and fail naturally** (a 409 `NOT_LINKED`) rather
  than gating on a separate "is linked" flag — `hasCode(error, 'NOT_LINKED')` is checked at each
  call site, so a card degrades independently instead of a whole-page linked/unlinked branch.

## Gotchas

- **`docs/api/openapi.yaml`'s `/market/templates` example has only one template** (`three-fund`),
  not the five real ones in `src/market/market/data/templates.json`. Any test or mock that relies on
  the generic Prism/contract-example fallback for this path will only ever see one plan, and if the
  profile's suggested plan isn't in that one-item list, `PlanVsActual`'s picker silently doesn't
  render (no crash, just a missing card). `frontend/scripts/portfolio-xray-smoke.cjs` and the
  `/market/fund` + `/market/templates` routes added to `frontend/scripts/browser-smoke.cjs` in this
  same change both route the real five-template array explicitly — copy that pattern rather than
  the generic fallback wherever `PlanVsActual` needs to render in a test.
- **`browser-smoke.cjs`'s "hide portfolio values removes every $" check had to be scoped to exclude
  `[data-what-if]`.** The what-if card's $500/$1,000/$5,000 amount presets are hypothetical
  add-amount labels, not the account's own figures, and DESIGN.md §4.15 never couples them to the
  "Hide portfolio values" toggle — `WhatIfCard.test.ts` doesn't test that interaction either. This
  is existing, intentional behavior; the smoke script's assertion was simply out of date once the
  what-if card started rendering on `/portfolio` by default (its `SecurityResearch` panel defaults
  to symbol `VOO`).
- **`task-7b-brief.md`'s smoke-script spec has three small inaccuracies against the code actually
  merged here** (documented in `task-7b-report.md` for the controller, and reflected honestly in
  `portfolio-xray-smoke.cjs` rather than asserted falsely):
  1. There is **no separate "invite line" linking to `/portfolio`** anywhere on `/markets` for an
     unlinked account. `WhatIfCard.test.ts` ("an unlinked account sees the research card exactly as
     before") and DESIGN.md §4.15 ("the portfolio page already invites linking") both confirm the
     what-if card is meant to render nothing there, full stop. The smoke script asserts that instead.
  2. The X-ray fee panel's copy never says **"every $10,000"** — that phrase belongs to the fund
     explainer's own fee sentence (§4.13, `feeSentence()` in `lib/fundExplainer.ts`), a different
     card. The X-ray panel's real copy is "Your funds cost about $13 a year (0.08% of the money in
     them)." (`lib/xrayCopy.ts`); the smoke script checks for `$` and `a year` instead.
  3. The what-if sentence never contains the literal phrase **"of your money"** — that phrase
     belongs to the X-ray headline (a different card, on `/portfolio`, not `/markets`). The
     what-if sentence does always mention "risk score"; the smoke script checks for that instead.
- The sample account numbers in `frontend/scripts/portfolio-xray-smoke.cjs` (VOO 15×$710.79, QQQ
  6×$744.50, VGT 8×$126.17, NVDA 12×$225.07, AAPL 10×$341.07, $1,500 cash) reproduce DESIGN.md
  §4.14's own worked fee example ($13/year, 0.08% blended) almost to the dollar — that's
  intentional, not a coincidence, and makes the smoke output easy to sanity-check by eye.
- `research:v2:*` cache keys mean the very first company-research request per symbol after a deploy
  is a cold cache (a few seconds), not a bug.

## Next steps

1. Open the PR for this integration branch with `team:frontend` (and `team:data` for the research
   field additions); require green `ci-ok` before merge per `AGENTS.md`.
2. Decide whether the three brief/DESIGN mismatches above (invite line, "$10,000" fee copy, "of your
   money" what-if copy) are worth reconciling — either update `task-7b-brief.md`/DESIGN.md wording,
   or, if an unlinked-account invite on `/markets` is actually wanted, scope that as new work (it
   does not exist today).
3. Run `npm run test:portfolio-xray` again against the real deployed backend (not just fixtures)
   once it's live, the same way the fund-explainer handoff asked for `test:fund-explainer` — fund
   category/sector strings from the real provider can still miss `targetMix.classify()`'s regexes.
4. Cost basis + performance vs. S&P (via Plaid `cost_basis`), ARKK in the sample account, "$3.4
   trillion" long-form formatting, and the what-if card's height on phones remain open from the
   fund-explainer handoff and haven't been revisited here.

## Open questions / blockers

- Owner: should `/markets` show something for an unlinked account near the what-if card's spot
  (e.g. "Link your account to see what this would do to your portfolio"), or is "the portfolio page
  already invites linking" (DESIGN.md §4.15) the final word? See **Gotchas** #1 above — right now
  there is nothing there by design, but `task-7b-brief.md` reads as if there should be.
