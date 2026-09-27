# "Be the fund for 60 seconds": play VOO in the Learn tab, plus a real sample portfolio

- **Date:** 2026-09-26
- **Author:** @Mario-Recondo
- **Team:** frontend (plus one backend change in the Plaid provider)
- **Status:** done
- **PR / issue:** (this PR)
- **Branch:** feat/be-the-fund-lesson
- **Follows:** 2026-09-26-frontend-beginner-learn-tab.md, 2026-09-26-backend-portfolio.md

## What changed

- **New lesson `be-the-fund`** in unit 2 ("What you can buy"), between `funds` and `diversification`.
  13 lessons now, not 12. You play VOO: one intro card, then three decisions with the fund's real top-10
  holdings above each one. Each decision teaches one rule: cap weighting, winners float without a trade,
  the fund has no opinions. A wrong pick shows "The fund's call is different" plus the rule and a payoff
  line, then you move on. It completes either way, so progress and streak work unchanged.
- **Score screen** says "You made n of 3 fund calls", offers Play again, and ties it back to the user:
  "You hold $10,662 of VOO. About $746 of that is Apple, whether you chose it or not." The generic line
  ("If you own VOO, about 7.0%…") shows at once and is replaced only when `/portfolio/holdings` resolves
  and includes VOO. No account, no VOO, error, loading: the generic line stays. The holdings query is
  mounted only on the score screen, so the lesson itself never calls the API.
- **Play card on `/learn`** under the hero, above the units, marked "Played" once done. Same lesson,
  second door. It also shows as lesson 6 of 13 in the unit list.
- **"Use a sample account" now holds real tickers.** `POST /plaid/sandbox-link` sends Plaid a custom
  sandbox user (`user_custom`, holdings JSON as the password): VOO 15, QQQ 6, VGT 8, NVDA 12, AAPL 10,
  about $22k, plus $1,500 cash as the account balance. Overlap is deliberate (Nvidia and Apple sit inside
  all three funds and are held directly) so look-through has something to show. Verified live against
  sandbox.plaid.com: the five tickers come back with those quantities.

## How to run / verify it

```bash
# backend
.venv/Scripts/python.exe -m pytest -q          # 239 passed
uvx ruff@0.16.5 check .

# frontend
cd frontend
npm run lint && npm run typecheck && npm test && npm run build     # 84 unit tests
VITE_API_BASE_URL=http://127.0.0.1:4010 npx vite --host 127.0.0.1  # terminal 1 (see Gotchas)
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome node scripts/learn-integration-smoke.cjs
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome node scripts/browser-smoke.cjs
```

All of the above ran green on 2026-09-26 with Google Chrome as the Playwright binary.

To see the personal line on the deployed site: open a fresh browser profile (or reset the user in the
app), click "Use a sample account" on Portfolio, then play the lesson.

New unit tests in `src/lib/learn.test.ts`: the play block's decisions point at symbols in the strip,
weights are sorted and sum to `topShare`, `heldFund` returns null without VOO and the right dollars with
it. New backend test in `tests/portfolio/test_plaid.py`: the sandbox call carries the custom user and the
five tickers. Both smoke scripts now derive the lesson count instead of hard-coding 12, and the
integration smoke plays the three decisions (it walks every lesson id, so the new lesson is covered).

## Decisions & why

- **A lesson with a `play` block, not a separate simulator.** `Lesson.play` holds the fund, the top-10
  snapshot, and `decisions[]` (a quiz question plus `situation`, `focus` and `payoff`). `LessonPage`
  swaps `quiz` for `decisions` and adds `FundStrip`; cards, progress, streak, "Up next" and Home's
  "n of 13" are untouched. A standalone component would have needed its own progress model.
- **Snapshot, not live data.** Weights are inline in `lessons.ts` with `asOf: '2026-09-26'`, shown on
  screen. Pulled once with yfinance (`Ticker('VOO').funds_data.top_holdings`), rounded to one decimal.
  The lesson teaches a rule, not a number, and a Lambda call mid-demo is a 502 waiting to happen.
- **Weights are fractions** (0.07), like every other weight in the app (DESIGN.md §10), and go through
  `percentFromFraction`. Dollar lines use `currencyWhole`: cents on "about $746" would be false precision.
- **Jargon after the idea.** Questions and options use no terms. "Cap weighting" and "index rebalancing"
  appear only in the feedback, once you have already seen the thing. No tooltip needed.
- **VOO only on the score screen.** Full look-through (VOO + QQQ + VGT + direct shares) is the next PR.
- **Old Plaid items stack.** Linking again adds a second `PLAID#` row; nothing deletes the old one. A
  device that linked before tonight keeps the junk holdings on top of the new ones until the user is reset.
  Not adding a delete to a shared route tonight.

## Gotchas

- **`frontend/.env.local` points `VITE_API_BASE_URL` at the deployed API.** Both smoke scripts mock
  `http://127.0.0.1:4010/**`, so with that file present they hit the real API and `browser-smoke.cjs`
  fails on the Portfolio hide-values step (no holdings for a random user). Start Vite with
  `VITE_API_BASE_URL=http://127.0.0.1:4010` and both pass. Not caused by this PR.
- Vite binds to `localhost`, which can resolve to `::1`; the smokes use `127.0.0.1`. Pass `--host 127.0.0.1`.
- The integration smoke reads lesson ids from `lessons.ts` with a regex on 8-space `id:` lines. Keep new
  lessons at that indentation, and keep the `Answer choices` group label and the `Finish lesson` button
  text: the smoke walks every lesson with them.
- Plaid returns its own long security names ("Vanguard Index Funds - Vanguard S&P 500 ETF") and ignores
  the `name` in the custom-user config. `institution_price` is kept as given, so prices go stale.
- `FundStrip` hides company names under 768px to keep ten rows on a phone; symbol and bar stay.

## Next steps

1. **Tonight:** full look-through on the score screen and the Markets card: VOO + QQQ + VGT top-10
   snapshots plus direct NVDA/AAPL, summed: "at least $X of your money is Apple." Reuse the `FundPlay`
   holdings shape; the yfinance pull is the same call per fund. Copy must say "at least" (top 10 only).
2. Tell the group: `/market/news` is 502 on the live API (FMP 402 on the free tier).
3. Optional: make the strip react to a wrong pick (equal split flattens the bars, then snaps back).
4. Optional: `/plaid/sandbox-link` drops the user's older Plaid items so re-linking replaces instead of stacks.

## Open questions / blockers

- None. Copy lives in `src/lib/lessons.ts` (the `be-the-fund` entry); edits don't touch components.
