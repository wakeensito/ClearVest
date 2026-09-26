# One beginner journey: Home, Learn, research and advisor

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5; Learn starter path by @MaxCadet
- **Team:** frontend (with market data and advisor teaching changes)
- **Status:** done
- **PR / issue:** [#39](https://github.com/wakeensito/ClearVest/pull/39)
- **Branch:** `feat/learn-beginner-path` (local integration branch: `feat/beginner-learn-integration`)
- **Follows:** [Max's Learn path](2026-09-26-frontend-beginner-learn-tab.md), [Beginner journey and financials](2026-09-26-frontend-beginner-journey-financials.md), [Research workspace and news](2026-09-26-frontend-research-focus-news.md), [Advisor voice](2026-09-26-frontend-voice-button.md), [Advisor replies](2026-09-26-frontend-reply-markdown-tables.md)

## What changed

- Combined Max's 12-lesson starter path and the beginner Home/Markets work in PR #39, preserving
  Max's commit and the latest main features: advisor voice, rich replies, sample account linking and
  deployment setup. The earlier handoffs describing uncommitted local work are historical snapshots;
  this handoff records their integration into the shared PR.
- Reduced first-visit Learn density: only the next unit starts expanded; additional FAQs, the growth
  illustration and the full glossary open on request. All lessons remain accessible. Removed visible
  streak pressure while retaining compatible saved metadata. Long lesson actions wrap on narrow phones.
- Home resumes the next unfinished lesson. Completing Stocks and bonds offers guided company research;
  researching a fund links directly to its lesson. General advisor questions still require no profile.
  Page changes start at the top; flashcards preserve keyboard focus without jumping the scroll position.
- Hardened lesson persistence against duplicate, obsolete, malformed and blocked storage. A session
  fallback supports both blocked reads and blocked writes. Confirmed resets clear only course progress.
  Clarified losses, diversification, bond repayment, IRA eligibility and SIPC coverage; added source links
  and a zero-growth calculator scenario, with fees/taxes/inflation exclusions stated.
- Added an integration browser suite covering every lesson, the Learn → research/advisor journey,
  Home resume, mobile layouts, reset/cancel, all-complete/missing-lesson states, flashcards, calculator,
  corrupted storage and blocked storage. Existing market/research/download browser coverage remains.

## How to run / verify it

```bash
npm ci
npm run mock
# Separate terminal:
npm run dev -w frontend -- --host 127.0.0.1 --port 5175 --strictPort
# With Vite running, another terminal:
export CLEARVEST_PREVIEW_URL=http://127.0.0.1:5175
npm run test:browser -w frontend
node frontend/scripts/learn-integration-smoke.cjs
node frontend/scripts/beginner-journey-smoke.cjs
node frontend/scripts/company-comparison-smoke.cjs
npm run lint
npm run typecheck
npm test
npm run build
ruff check .
pytest -q
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if using an existing browser installation; otherwise install
Playwright Chromium. On this WSL workspace, Node and Chromium are Windows executables, so assign
these environment variables inside `node.exe` as described in the preceding handoff.

Axe checks are enabled when its bundle exists in the ignored local cache:

```bash
npm install --prefix frontend/node_modules/.cache/clearvest-a11y --no-audit --no-fund --package-lock=false axe-core@4.10.3
```

Local verification: frontend lint, regenerated OpenAPI types/typecheck, **79 frontend tests**,
production build, Ruff and **219 Python tests**; all four browser suites pass. Browser coverage uses
320/390/768/1440px layouts, with every lesson/card/quiz/completion checked at 320px. Axe reports no
A/AA violations in the audited Home, Learn, answered lesson, flashcards, guided statements,
comparison, profile and mobile advisor states. This is automated coverage, not exhaustive usability
or screen-reader testing. Screenshots are in the ignored `frontend/node_modules/.cache/clearvest-review/`.

## Decisions & why

- Use existing PR #39 as the combined review surface; do not open a competing PR or merge protected
  main. The integration merge keeps Max's original commit. Required `ci-ok` must be green before merge.
- Keep the course key `cv-learn-progress` so existing completions survive. Research milestones retain
  their separate per-demo-user key. Home reads course progress rather than duplicating it. Course
  progress is browser-local and is not an investment-readiness score.
- Keep the SamsungOne, white/navy/cobalt design. Progressive disclosure limits simultaneous choices
  without gating the lessons. Learning achievements remain separate from returns or trading activity.
- Reuse main's validated `useCompareCompanies` hook for the comparison UI. Preserve voice and rich
  advisor replies while retaining the beginner prompt, reduced-motion scrolling and public entry.
- Educational review references: [Investor.gov investing basics](https://www.investor.gov/introduction-investing),
  [diversification](https://www.investor.gov/introduction-investing/investing-basics/save-and-invest/diversify-your-investments),
  [IRS 2026 limits](https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500),
  and [SIPC coverage](https://www.sipc.org/for-investors/introduction). Keep these explanations qualified;
  a market loss matters before sale, recovery is not assured, and a narrow fund may concentrate risk.

## Gotchas

- Live FMP entitlement, deployment and Bedrock answer quality are not verified by browser fixtures.
  Market APIs are contract-tested with partial/stale/error/currency/fund states. Check actual provider
  responses after deployment, especially annual statements and historical P/E availability.
- Vite reports a main JavaScript chunk over 500 kB. Production builds pass; route splitting is a
  follow-up opportunity. The price-chart library is already loaded separately.
- The fund lesson has four teaching cards; most others have three. Browser tests advance until the
  quiz appears instead of assuming every lesson has three cards.
- Axe target-size checks must put glossary controls fully in view: an arbitrary scroll position can
  leave a few pixels visible beneath the fixed header. Controls retain 44px targets; the integration
  audit scrolls the glossary control group into view before measuring it.
- WSL checkout line endings differ from the index. Use `git -c core.autocrlf=true status --short`
  to see substantive changes without CRLF noise. No repository-wide line-ending conversion was made.
- Earlier handoffs remain unchanged to preserve each contributor's history. Retirement facts now live
  in `src/layer/clearvest/data/retirement_accounts.json`; Max's older handoff names the previous path.

## Next steps

1. Review and merge the combined PR #39 only after required `ci-ok` passes; keep the frontend/data/ai
   team labels. This milestone publishes the PR, not a deployment or protected-main merge.
2. Have a beginner try Home → first lesson → Stocks and bonds → guided company research → advisor.
   Ask them to explain ownership, sales versus profit and why one P/E does not identify a best stock.
3. Verify deployed FMP responses for stocks/funds and foreign currencies, plus live voice and text
   advisor answers. Retain the provider-source dates and the separate annual/TTM labels.
4. Consider lazy loading the advisor and longer learning content if real mobile performance metrics
   justify it. Preserve Home's resume behavior and the browser-only storage fallback.

## Open questions / blockers

- No local integration blocker. Live provider/model verification and novice-user evaluation remain
  follow-ups, not claims established by mock-based testing.
- Lesson progress remains device-wide; resetting the demo user leaves those lessons intact. Research
  milestones remain scoped to the demo user. Deliberate account-based sync would need a separate design.
