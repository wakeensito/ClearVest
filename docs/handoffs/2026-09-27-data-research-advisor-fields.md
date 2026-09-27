# Company research: dividend yield, market cap, beta, next earnings date, P/E vs its own history

- **Date:** 2026-09-27
- **Author:** @wakeensito
- **Team:** data
- **Status:** done
- **PR / issue:** (not yet opened)
- **Branch:** worktree-agent-ab303abc663d65d7a
- **Follows:** 2026-09-27-data-fund-explainer.md, 2026-09-26-frontend-beginner-journey-financials.md

## What changed

- `GET /market/company-research`: `valuation.dividendYield` (fraction, from FMP ratios-ttm
  `dividendYieldTTM`), `profile.beta`, `profile.marketCap`, `profile.nextEarningsDate` (ISO date).
  All nullable and required in `docs/api/openapi.yaml`.
- Next earnings date comes from FMP `/stable/earnings?limit=4` (free tier returns the next scheduled
  report as a future-dated row). It is folded into the profile snapshot, not a fifth section: skipped
  for funds, and a failure leaves it null without marking the profile unavailable.
- Cache keys moved from `research:v1:*` to `research:v2:*` so cached snapshots without the new fields
  are never served against the new contract.
- `CompanyFinancials`: a fourth step, "Payouts" ("Does it pay you to wait?"), with the yield and one
  beginner sentence, "No dividend" for a reported 0, or "isn't available" for null; one neutral P/E-versus-usual sentence in the Price & value step
  (`peVersusUsual`, ±15% band); "Worth about USD 3.4T on the market" under the header (not for funds).
  "Next earnings report: Oct 29, 2026" as a quiet tertiary line when known (not for funds). Beta has no UI.

## How to run / verify it

```bash
source .venv/bin/activate
pytest -q tests/market/test_research.py tests/test_contract_doc.py
npm run typecheck && npx vitest run frontend/src/lib/researchEducation.test.ts frontend/src/components/market/CompanyFinancials.test.ts
```

## Decisions & why

- **`dividendYieldTTM` is already a fraction.** A live call on 2026-09-26 returned AAPL `0.00310787`
  (1.06 dividend / 341 price) and KO `0.0239`. It is stored as-is. A reported `0` stays `0` ("No dividend");
  `null` means unknown (missing, negative, or over 0.25 = 25%, a unit bug or garbage) and the UI says the
  information isn't available, never "No dividend". Over-25% values are nulled, never divided by 100 (0.3 could be 0.3% or 30%, so guessing
  would be wrong half the time). `test_dividend_yield_percent_vs_fraction_units` pins this.
- `marketCap` ≤ 0 is null (a zero market value is missing data, not a real value).
- `peVersusUsual` takes the number of observations and says "across N recent years", never claiming more.
- `nextEarningsDate` is re-checked on every response: a cached snapshot whose date has passed returns null.
- The step label is "Payouts", not "Dividends": at 320px four step buttons get about 53px of text
  width, and "Dividends" at 12px does not fit on one line.
- `CompanyFinancials` accepts `initialStep` (clamped) so render tests and deep links can open a step.

## Gotchas

- `financialAmount(..., compact)` puts a non-breaking space between the currency code and the number
  (`USD 3.4T`); string tests must use ` `.
- Only CI's pinned ruff (0.16.5, `uvx ruff@0.16.5 check .`) is authoritative; the system ruff 0.15.x
  flags an old E731 in `tests/layer/test_db_cache.py`.

## Next steps

1. None required; beta is data only if someone wants to teach volatility later.

## Open questions / blockers

- None.
