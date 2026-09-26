# Beginner journey, guided company financials and public advisor

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend (also market data and shared advisor instructions)
- **Status:** done (local implementation; not committed or deployed)
- **PR / issue:** No PR opened. Include with `team:frontend`, `team:data` and `team:ai` in the shared frontend PR.
- **Branch:** `feat/frontend`
- **Follows:** [Research workspace and news](2026-09-26-frontend-research-focus-news.md), [Inclusive investing experience](2026-09-26-frontend-inclusive-investing-experience.md), [Product proposal](../beginner-investing-experience.md)

## What changed

- Added a public Home route with an interactive share-ownership example, an optional knowledge check,
  three local research milestones, and paths into Learn, research and portfolio context. Home is now
  the default route and wordmark destination. Mobile navigation includes Home as its fifth item.
- Added guided company research with business, sales/profit and valuation steps. It explains revenue,
  net income, diluted EPS and P/E beside actual provider fields, with up to five annual statements,
  a revenue/profit chart, historical P/E context, and optional statement tables. Company-name search
  is available in research and comparison; both full-screen comparison sides have their own guide.
- Added independently cached `/market/company-research` sections and `/market/search`, API contracts,
  generated types, FMP adapter methods, backend edge-case tests and frontend calculation tests.
  Missing, partial, stale, fund, currency-change and loss states have explicit explanations.
- Removed forced profile setup for general advisor questions and portfolio introductions. Added
  contextual explanations to charts, news, comparison and portfolio. Advisor instructions teach one
  concept at a time for new readers; optional profile editing preserves a linked advisor question.
  Improved invalid-form focus, responsive composer sizing, safe-area spacing, and corrupted chat-cache
  recovery. Comparison no longer labels unconfirmed per-share currencies as USD.
- Added an end-to-end beginner browser suite, optional Axe checks and screenshots. **Max owns Learn**:
  this milestone did not edit `LearnPage.tsx`, `LearnPage.module.css` or `lib/learning.ts`. Existing
  uncommitted changes in those files predate this work.

## How to run / verify it

```bash
npm run mock
npm run dev -w frontend -- --host 127.0.0.1 --port 5175 --strictPort
# Separate terminal, with Vite running:
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5175 node frontend/scripts/beginner-journey-smoke.cjs
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5175 node frontend/scripts/company-comparison-smoke.cjs
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5175 npm run test:browser -w frontend
npm run lint
npm run typecheck
npm test
npm run build
ruff check .
pytest -q
```

For Axe checks inside the beginner suite, install the checker in the ignored cache directory:

```bash
npm install --prefix frontend/node_modules/.cache/clearvest-a11y --no-audit --no-fund --package-lock=false axe-core@4.10.3
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE` optionally selects an existing Chromium installation. In this WSL
workspace, Node/Chromium are Windows executables; environment variables must be assigned inside the
`node.exe` process as documented in the preceding handoffs. Linux Python checks used the temporary
`/tmp/clearvest-markets-venv` environment. No production dependencies were added for this milestone.

Verification completed: frontend lint, generated types/typecheck, 33 unit tests and production build;
repository-wide Ruff and 176 Python tests, followed by 29 focused company/research tests after adding
four more edge cases and the final currency/valuation guards. All three browser suites passed.
Axe reported no WCAG A/AA violations in the tested home, guided statements, full-screen comparison,
profile form and mobile advisor states. This is automated coverage, not a claim of an exhaustive
accessibility or usability audit.

Browser coverage includes 320/390/768/1440px layouts, keyboard focus, reduced motion, first activity,
progress persistence, explicit company-name search, empty/error/retry/partial/stale data, missing
currency, currency changes, loss-making companies, funds, zero/missing values, independent comparison,
optional profile return, and blocked/malformed browser storage. The earlier suites retain download,
market-widget, chart, portfolio, profile and news regression coverage.

Screenshots live in the ignored `frontend/node_modules/.cache/clearvest-review/` directory:
`beginner-home-desktop.png`, `beginner-home-mobile.png`, `beginner-financials-desktop.png` and
`beginner-financials-mobile.png`. Screenshot figures are fixtures. The local Prism endpoint was also
verified to return the new illustrative company-research example.

## Decisions & why

- Preserve the SamsungOne/white/navy/cobalt visual system. Make the one interactive ownership example
  the main element on Home. Details open on demand; there are no return leaderboards, trading rewards
  or required streaks.
- `/markets?symbol=AAPL&guided=1` hides movers and makes the business guide primary; the chart opens
  on request. Normal Markets retains the previously requested compact widgets. Apple is an example
  for exploring the flow, not a recommendation. `/markets?view=companies` keeps the subtle downloads.
- The provider calls are the documented FMP stable `profile`, `income-statement` (annual, limit 5),
  `ratios-ttm`, `ratios` (annual, limit 5), `search-symbol` and `search-name`. Research uses four
  concurrent, independently cached sections, a one-day TTL, per-section retrieval dates and stale
  fallback. Source: [FMP documentation](https://site.financialmodelingprep.com/developer/docs).
- Sort/deduplicate fiscal periods, reject mismatched symbols and malformed annual rows, normalize
  nonfinite/boolean numbers to null, and never truncate an unknown currency into a familiar code.
  Annual EPS stays separate from the provider's trailing P/E. Growth requires consecutive fiscal
  years and matching known currencies with a positive prior revenue base.
- Historical P/E context is a median of at least three available positive annual observations. It is
  explicitly not an industry average, a target price or a buy/sell score. Zero/negative observations
  are excluded with a visible explanation. Educational references are the
  [SEC statement guide](https://www.sec.gov/about/reports-publications/investorpubsbegfinstmtguide) and
  [FINRA stock evaluation guide](https://www.finra.org/investors/investing/investment-products/stocks/evaluating-stocks).
- Backend advisor context already supported missing profiles. Public questions now reach it. The
  prompt retains its no-invented-figures and no-buy/sell instructions while reducing information
  overload. It does not automatically receive the researched company's financial payload.

## Gotchas

- Live FMP key entitlement, rate limits and production deployment are **not verified**. All new APIs
  reuse `FMP_KEY_PARAM`. Browser fixtures and a working Prism mock do not prove live data coverage.
  Four provider sections may be requested for a new symbol; name lookup uses two endpoints.
- Reporting currency and price currency can differ. The original comparison contract omits currency;
  exports now state that uncertainty. Income statements label their own reported currency.
- `cv-research-progress-v1:<user-id>` stores only `share`, `profit`, `pe`. It is browser-local, separate
  from Max's course/lesson progress, and falls back to memory when storage is blocked. No cross-device
  sync, suitability scoring or investment recommendation is implied by a completed check.
- Advisor model output quality was not evaluated against a live Bedrock model. Tests verify wiring,
  context, fallback and browser behavior. The rewritten teaching instructions still need human review
  with actual beginners.
- The browser overflow helper waits two animation frames after a viewport change. An immediate DOM
  measurement briefly combined the new `innerWidth` with the old desktop layout; screenshots and
  settled measurements confirmed no overflow. Do not replace this with a blanket overflow-hiding rule.
- A shared branch already contained many uncommitted changes. No earlier handoff was rewritten, no
  changes were committed/pushed, and no production resources were altered.

## Next steps

1. **Max / Learn:** keep implementing `LearnPage.*` and `lib/learning.ts`. Link a company-analysis
   activity to `/markets?symbol=AAPL&guided=1`; the current `/learn` links remain valid. Remove any
   Learn copy claiming that advisor conversations require a saved profile. Integrate lesson progress
   deliberately with the research milestones; do not overwrite the research storage key.
2. Review the mobile first visit, company guide and advisor with novice users. Test whether they can
   explain ownership, revenue versus profit and why one P/E ratio does not identify the best stock.
3. Validate FMP entitlement and representative stocks/funds in the deployed environment, including
   foreign reporting currencies, unavailable symbols and partial outages. Deploy market and shared
   layer changes through the protected-main PR process; verify live advisor responses afterward.
4. Include this handoff and the relevant team labels in the shared PR; require green `ci-ok` before
   merge. Rerun the beginner browser suite after Max's Learn integration.

## Open questions / blockers

- No local implementation blocker remains. Live-provider verification and deployment remain external
  integration steps for the team; they are not represented as completed by mock-based checks.
- Max's new Learn content is in separate ownership and was not present for integration testing in
  this milestone. Its eventual navigation and lesson-progress flow need one final combined review.
