# Inclusive welcome, learning and bundled SamsungOne

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done (local implementation; not committed or deployed)
- **PR / issue:** Not opened. Include this handoff in the frontend PR, labelled `team:frontend`.
- **Branch:** `feat/frontend`
- **Follows:** [Light brokerage workspace](2026-09-26-frontend-light-brokerage-workspace.md)

## What changed

- Bundled SamsungOne regular, semibold and bold from Samsung Internet’s public web-code repository at a pinned revision. Removed installed-font dependence and the IBM Plex Sans package. Fonts are preloaded from the app origin; canvas chart text redraws when its font loads.
- Added a split welcome panel with a coastal landscape, time-aware rotating greetings, pause/resume and reduced-motion support. Labelled icons lead to holdings explanations, research and learning. Generated a matching valley landscape for Learn; optimized WebP assets total about 600 KB.
- Added persistent portfolio-value privacy: account totals, position values/quantities, allocation amounts and account-specific risk prose are replaced when hidden. Symbols, weights and public security prices remain visible.
- Replaced the Learn placeholder with three learning paths and an eight-term searchable glossary with source links. Markets and Learn work before a profile is created; onboarding now offers “Explore first”.
- Deferred the Plaid SDK until a link token is requested, fixing a script-load/unmount race exposed by moving from onboarding into public Learn.
- Removed the in-chart TradingView logo via `attributionLogo: false`, retaining the footer NOTICE credit and link. Updated DESIGN.md, the design-direction brainstorm, asset provenance and regression coverage.

## How to run / verify it

```bash
npm ci
npm run mock                      # API examples, port 4010
npm run dev                       # Vite, port 5173
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser -w frontend   # with Vite running, default API URL
```

Optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE` selects an existing Chromium binary. The browser script
uses contract fixtures and writes review screenshots to `frontend/node_modules/.cache/clearvest-review/`.
Unit checks cover greeting boundaries, glossary search and the existing finance-format/history logic
(21 tests total). Browser checks cover actual font loads, image loading, absent chart logo and present
footer attribution, greeting pause and reduced motion, privacy persistence, glossary search/empty
results, no-profile research/learning, existing chart behavior, mobile overflow at 320/390/768px, no eager Plaid requests, and an explicit mocked Plaid link/token-exchange flow. Live Plaid was not exercised.

## Decisions & why

- Font source: https://github.com/SamsungInternet/web-code/tree/caf2401227497d00cf728d5ee3edcbd9972c0771/static/fonts/SamsungOne
  The repository’s MIT license and per-file hashes are retained in `public/fonts/samsungone/`. This
  resolves the preceding handoff’s font-asset blocker. Missing glyphs still use a system fallback.
- The chart logo is optional when attribution is supplied elsewhere. The footer retains TradingView’s
  required notice/link: https://tradingview.github.io/lightweight-charts/docs/5.1/api/interfaces/LayoutOptions
- Greeting phrases do not assume a name, financial status, family structure or particular goal. They
  change every seven seconds, stop for reduced motion or hidden tabs, and have a persistent pause
  control. The accessible heading stays “Your portfolio”, without repeated live announcements.
- Decorative images sit beside text, not behind it. Assets are generated scenery, not identified
  real locations. The built-in image_gen tool’s exact prompts are in `public/images/README.md`.
  WebP encoding preserves original dimensions; generated source PNGs remain in the tool output folder.
- Inclusion includes a route that requires no account, understandable definitions and readable data.
  Existing portfolio/advisor setup requirements remain in place. Learning links prefill advisor
  questions; they do not send messages automatically.

## Gotchas

- Portfolio privacy is a presentation preference, not access control. It does not erase API data or
  redact existing advisor conversations. When hidden, values are removed from rendered DOM text,
  rather than blurred; percentages and public market prices intentionally remain visible.
- Local preferences (`cv-visited`, `cv-greeting-paused`, `cv-hide-balances`) are device/browser specific.
  They gracefully fall back to in-memory state if localStorage is unavailable.
- Glossary content is general education, with Investor.gov references; it is not a suitability test or
  personalized recommendation. Advisor conversations still need profile setup.
- Webfonts are WOFF for broad browser support. Do not reintroduce local-only font faces or external
  font hotlinks. Font attribution/provenance files should ship with the assets.
- Earlier uncommitted README, Dependabot and frontend scaffold work belongs to the shared branch.
  This change has not committed, pushed or overwritten another author’s handoff.

## Next steps

1. Review Portfolio and Learn in the local preview, including a mobile viewport and reduced motion.
2. Open the frontend PR with this handoff and `team:frontend`; require green `ci-ok` before merge.
3. Add a company/fund metadata endpoint (names, currencies, source and adjustment metadata) to make
   research easier for people who do not know ticker symbols.
4. Add benchmark comparison and a user-scoped saved-research list using explicit source timestamps.
5. Preserve intended advisor questions across first-time onboarding once the product flow is defined.

## Open questions / blockers

- No font or image asset blocker remains. Hosting and deployed-provider integration remain separate.
- Frontend/product: decide the next research feature after validating the inclusive entry flow.
- Backend/data: fuller metadata and actual portfolio returns remain prerequisites for richer comparisons.
