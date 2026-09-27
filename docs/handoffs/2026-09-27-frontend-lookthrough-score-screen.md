# Look-through on the "Be the fund" score screen: "at least 39% of your money is Apple and NVIDIA"

- **Date:** 2026-09-27
- **Author:** @Mario-Recondo
- **Team:** frontend
- **Status:** done
- **PR / issue:** (this PR); closes the "holdings overlap" and "what you actually own" bullets of #44
- **Branch:** feat/lookthrough-score-screen
- **Follows:** [2026-09-26-frontend-be-the-fund-lesson.md](2026-09-26-frontend-be-the-fund-lesson.md), [2026-09-27-frontend-fund-explainer.md](2026-09-27-frontend-fund-explainer.md)

## What changed

- **The lesson's score screen opens up every fund the user holds**, not just VOO. For each fund it
  multiplies the dollars held by the fund's published top-ten weights, then adds the same companies
  held directly. Headline: "At least 39% of your money is two companies: Apple and NVIDIA. You picked
  them once and got them again inside your funds." Under it, one row per company with the split:
  "$3,411 held directly · $746 in VOO · $331 in QQQ · $159 in VGT."
- **Live weights from `GET /market/fund` (#47), bundled snapshot as the stand-in.** One call per fund
  the user holds, biggest first, capped at five. The snapshot for VOO, QQQ and VGT renders on first
  paint; a fund's live weights replace it when its call lands. A failed call keeps the snapshot. A fund
  with neither (SPY) is left out with no footnote: the numbers are floors and the copy says "at least".
- **Which companies show:** the top two by dollars, only when the biggest is above 10% of the whole
  portfolio. Otherwise: "No company we can see is more than 10% of your money, counting what sits inside
  your funds." ("we can see" because a fund we could not open may hide more.) Share classes fold into
  one company (GOOG into GOOGL) before ranking. No holdings, no account, error: the old generic VOO
  line stays.
- New pure module `frontend/src/lib/lookthrough.ts` (`lookthrough`, `heldFunds`, `fromLiveFund`,
  `spotlight`, `floorShare`, `FUND_SNAPSHOTS`) with tests pinned to the sample account's numbers.
  `lib/fundPlay.ts` (VOO-only) is gone; nothing else used it.

## How to run / verify it

```bash
cd frontend
npm run lint && npm run typecheck && npm test && npm run build     # 174 unit tests
VITE_API_BASE_URL=http://127.0.0.1:4010 npx vite --host 127.0.0.1  # terminal 1
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome node scripts/learn-integration-smoke.cjs
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome node scripts/browser-smoke.cjs
```

All green on 2026-09-27 with Google Chrome as the Playwright binary. The integration smoke now asserts
the headline on the `be-the-fund` score screen (the OpenAPI fixtures give "At least 27% … Apple and
NVIDIA"). A throwaway Playwright run with the sample account mocked showed the snapshot on first paint
(Apple $4,647), live numbers 300ms later (Apple $4,651), the snapshot kept on a 502, and no horizontal
overflow at 375 or 1200.

On the deployed site: fresh browser profile, "Use a sample account" on Portfolio, play the lesson to
the end. Expect Apple about $4,650 and NVIDIA about $4,120 out of about $22,250.

## Decisions & why

- **Live first, snapshot behind it, never a spinner.** The market Lambda's first call was 6s cold on
  2026-09-27; the score screen must not sit blank on a demo laptop. Live and snapshot differ by a few
  dollars, so the swap is invisible in practice. Live data is also what makes non-sample funds work.
- **Top two, 10% floor.** Two rows fit a 320px phone. Under 10% the biggest company is not worth a
  headline, and saying so is a good line on its own.
- **Floors everywhere.** Top-ten weights only, so per-company totals are lower bounds. The headline
  percent is rounded down, never to nearest, so "at least" is never false. Funds we cannot open still
  count in the denominator.
- **Direct shares only for Plaid type `equity`.** A fund with no weights must not show up as a "company"
  row. Bonds, cash and `other` add to the total and nothing else.
- **Company names are the shortest spelling seen** ("Apple" over "Apple Inc" over "Apple Inc."), with
  Inc/Corp/Ltd suffixes stripped. The lesson's own short names win whenever a snapshot is in play.
- **Score screen only.** A "What you really own" card on the Portfolio tab was considered and cut for
  time; the math is ready for it (see Next steps).

## Gotchas

- `npm run typecheck` regenerates `src/api/schema.d.ts` with LF endings, which shows as a whole-file
  diff on Windows. Revert it unless the contract changed.
- `frontend/.env.local` points at the deployed API; the smokes mock `127.0.0.1:4010`. Start Vite with
  the env var above or the browser smoke fails on Portfolio (carried from the previous handoff).
- The integration smoke's fund fixture is VOO's example for every symbol, so any fund the fixture
  portfolio holds "contains" NVDA, AAPL and MSFT. Fine for the assertion, wrong for anything numeric.
- Old Plaid items stack per user (previous handoff). A device that linked before the custom sandbox
  user keeps junk holdings; their `type` values are mostly not `equity`/`etf`, so they add to the total
  and dilute the shares. Reset the user for the demo.

## Next steps

1. Portfolio tab card "What you really own": same `lookthrough()` + `useFunds(heldFunds(...))`,
   a small table sorted by total. The pitch surface judges see first. Half of #44's portfolio bullet.
2. Tell the group: `/market/news` is 502 on the live API (FMP 402 on the free tier). Still not told.
3. Optional: pull `FUND_SNAPSHOTS` from a script instead of by hand when weights are refreshed.

## Open questions / blockers

- None.
