# Frontend scaffold, design system and P0 screens

- **Date:** 2026-09-26
- **Author:** @AK1F5
- **Team:** frontend
- **Status:** in-progress
- **PR / issue:** # (not opened yet)
- **Branch:** `feat/frontend`
- **Follows:** [2026-09-26-backend-portfolio.md](2026-09-26-backend-portfolio.md), [2026-09-26-ai-advisor-voice.md](2026-09-26-ai-advisor-voice.md)

## What changed

- **`DESIGN.md` (repo root)** is the design system: an "institutional editorial" look (Blackstone's
  serif headlines and square geometry, Robinhood's single hero number, Fidelity's tables), the Clear Cobalt
  accent, tokens, component specs, API-state copy, formatting units and an agent brief. Every text color
  pairing was contrast-checked.
- **`frontend/`**: React 19 + TypeScript + Vite app with a typed API client generated from
  `docs/api/openapi.yaml`, TanStack Query for data, and CSS Modules that use only `var(--cv-*)` tokens.
- **Screens:** onboarding (`/welcome`: profile, then Plaid link), portfolio dashboard (total value, key figures,
  allocation, holdings, risk, economy), advisor chat (`/advisor`, with a "What the advisor sees" rail).
  Markets and Learn have placeholder pages.
- **CI:** a root `package.json` makes `frontend` an npm workspace, so the existing Node job in `ci.yml` runs
  lint, typecheck, test and build with no workflow change. Dependabot now covers npm.

## How to run / verify it

```bash
npm ci                    # Node 22, from the repo root
npm run mock              # terminal 1: Prism mock on :4010 (serves the openapi.yaml examples)
npm run dev               # terminal 2: http://localhost:5173
npm run lint && npm run typecheck && npm test && npm run build
```

Env var (name only): `VITE_API_BASE_URL`, the deployed `ApiUrl`. Unset means the Prism mock. Put it in
`frontend/.env.local` (gitignored); see `frontend/.env.example`.

## Decisions & why

- **DESIGN.md wins over code.** `frontend/src/styles/tokens.css` is a copy of DESIGN.md §13, and
  `tokens.test.ts` fails if they drift. Change both in one PR.
- **Square corners everywhere** (`--cv-radius: 0`), set globally in `global.css`. Don't add `border-radius` in components.
- **Newsreader, not Chronicle.** Blackstone's brand face (Chronicle, Hoefler & Co.) is paid and licensed.
  Newsreader's optical-size axis gives the closest free match; `main.tsx` imports `opsz.css` on purpose.
  Use the serif only for headlines and the hero number.
- **Green and red mean gain and loss only.** The risk score uses neutral bands, not a red scale (DESIGN.md §2.4, §4.9).
- **No invented numbers.** Holdings have no daily change or cost basis, so there's no "+$X today"; hero
  key figures are sums of API fields only.
- **Types come from the contract.** `npm run typecheck` regenerates `src/api/schema.d.ts` first, so a
  contract change that breaks the UI fails CI. Commit the regenerated file.
- **TypeScript is pinned to 5.9 and react-router to 7.** typescript-eslint and openapi-typescript don't support
  TS 6+ yet, and react-router 8 needs Node ≥ 22.22. Dependabot ignores both majors.
- **No jsdom yet.** jsdom 30 needs Node ≥ 22.22. Current tests are pure logic (formatting, error mapping,
  markdown parsing, token drift) and run in Node.
- **Chat history lives in localStorage** (`cv-chat:<userId>`, last 50 messages): the API has no "get
  history" route. `DELETE /advisor/history` clears both.

## Gotchas

- **Units:** macro values are already percentages (`4.33`), while weights and returns are fractions (`0.5`).
  Always go through `src/lib/format.ts`; the units table is DESIGN.md §10.
- **Date-only strings** (`"2026-08-01"`) must go through `parseDate`, or US time zones show the previous day.
- **`npm run dev -- --port X` doesn't work from the root**: npm consumes the flags. Run `npm run dev -w frontend -- --port X`.
- **The Prism mock always returns the happy path**, so a new user never sees `/welcome` automatically.
  Open `/welcome` directly to test onboarding. "Use a sample account" (dev builds only) calls `/plaid/sandbox-link`.
- **Plaid Link won't open against the mock**, because its link token is fake. Test real Link against the deployed backend.
- **Any static host needs an SPA fallback** (serve `index.html` for unknown paths), or deep links like `/advisor` return 404.
- The API only allows the `content-type` and `x-user-id` headers (CORS). Don't add custom headers to the client.

## Next steps

1. Open the PR (`team:frontend`), with CI green.
2. Switch `VITE_API_BASE_URL` to the deployed `ApiUrl` and walk the P0 flow: onboarding → sandbox link →
   dashboard → chat.
3. P1 voice: record → `/voice/upload-url` → PUT → `/voice/turn` → `/voice/speak` (DESIGN.md §4.10,
   `docs/api/README.md`). Strip codec suffixes from `MediaRecorder` mime types (`audio/webm;codecs=opus` → `audio/webm`).
4. P2 screens: Markets (`/market/history` chart with Recharts per §4.7, `/market/compare-companies`) and Learn
   (`/advisor/retirement-accounts`, `/market/templates`).
5. Pick a host (S3 + CloudFront in the SAM stack, Amplify, or Vercel) with an SPA fallback.

## Open questions / blockers

- **Hosting:** nothing in `template.yaml` serves the frontend yet. DevOps needs to decide.
- **Brand mark:** the favicon is a placeholder cobalt square with a "C" (DESIGN.md §14).
