# Source-backed fund overlap and a simpler Advisor

- **Date:** 2026-09-27
- **Author:** Codex, working with @AK1F5
- **Team:** frontend (with shared/backend data changes)
- **Status:** done locally; live provider/deployment verification pending
- **PR / issue:** Related draft #42; no remote update
- **Branch:** `feat/advisor-companion`
- **Follows:** [Shared Scout voice](2026-09-27-frontend-scout-shared-voice.md), [Investor workspace](2026-09-26-frontend-scout-investor-workspace.md)

## What changed

- Added What do I really own: direct plus through-fund exposure, an overlap filter, expandable ownership paths, visible unmapped value and dated source coverage. Missing holdings never become invented constituents or zero exposure.
- Added `GET /market/fund-holdings?symbol=` and `GET /portfolio/exposure`, reusing FMP, shared DynamoDB caches and existing Lambda routes/permissions. Shared Decimal calculations also build Scout's ownership evidence independently of the browser.
- Reworked Advisor around three tools: What I own, Risk check and Research. Chat opens on demand, context and source details are expandable, and the navy/yellow visual language remains. On phones the open conversation gets the available space.
- Kept shared voice/draft/history behavior. Tool changes clear a previous pinned context, and typed/voice questions from Risk check carry the actual selected holding and hypothetical drop. Multiple source receipts collapse under one disclosure.
- Added [scope and implementation notes](../design/advisor-companion/scout-ownership-and-advisor.md), API contracts and ownership backend/browser coverage. Existing browser checks now use the new navigation labels and scope floating launchers explicitly during route transitions.

## How to run / verify it

```bash
npm run lint -w frontend
npm run typecheck -w frontend
npm test -w frontend
npm run build -w frontend
python -m pytest -q
ruff check src tests
sam validate --lint
sam build --no-cached --build-dir /tmp/clearvest-ownership-build
# Run Vite separately against the local API base used by these fixtures.
PLAYWRIGHT_CHANNEL=chrome CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:scout-ownership -w frontend
PLAYWRIGHT_CHANNEL=chrome CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:scout-workspace -w frontend
PLAYWRIGHT_CHANNEL=chrome CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:scout -w frontend
PLAYWRIGHT_CHANNEL=chrome CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:scout-safety -w frontend
PLAYWRIGHT_CHANNEL=chrome CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:scout-voice -w frontend
# Full-app browser suite uses PLAYWRIGHT_CHROMIUM_EXECUTABLE when its browser is not installed.
CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:browser -w frontend
```

Frontend lint/typecheck/build and all 88 frontend tests passed. All 305 backend tests passed, including 22 ownership cases. Ruff and SAM validation/build passed. Ownership, workspace, companion, safety, voice and full-app browser suites passed, including 320px layouts. Desktop/mobile screenshots were reviewed; screenshots and synthetic API data are not evidence of live provider accuracy. Existing >500 kB frontend bundle warning remains.

## Decisions & why

- Actual weights come only from normalized FMP fund holdings; portfolio values come only from the caller's saved server snapshot. Formula: direct value plus each fund's value times that security's reported percentage. Repeated account positions aggregate before overlap detection.
- The browser loads at most eight distinct owned funds, largest aggregated value first, then requests the private calculation. No balances go to FMP. No new secrets, IAM grants, queues or AWS resources are needed for this addition.
- Use a 24-hour cache and exclude provider updates older than 35 days, absent/future dates, expired caches, conflicting available ISINs and known nested funds. Partial lists are never normalized to 100%. Keep cash separate and unknown assets unmapped.
- Matching is by security ticker, not consolidated corporate issuer. Provider update dates are not filing dates. This is validated provider-reported data, not independent issuer verification. Full limitations and synthetic example math are in the implementation notes.
- Retain at most 1,000 source rows and a 300 kB escaped-JSON row budget to protect the DynamoDB item limit; omitted tails reduce coverage. Exposure uses strongly consistent reads immediately after fund ingestion. `db.get` has a backward-compatible optional `consistent` argument; existing callers retain eventual reads.
- Explicit ownership actions request standalone grounded answers. Ordinary conversational and voice turns keep their existing safety/context semantics. Missing ownership evidence fails explicitly, with no unrelated fallback reference.
- Preserve the user's standing instruction: no push, commit or deployment. Earlier local Scout/guardrail work remains intact.

## Gotchas

- `What I own` is the default Advisor tool. `/advisor?symbol=...` opens Research; `chat=1` explicitly opens the conversation for Scout handoff. On small screens selecting a tool closes the conversation view without discarding the shared thread.
- Fund `updatedAt` and saved portfolio `asOf` can differ. This is a look-through estimate, not simultaneous live holdings/valuation. Share classes stay separate. Missing ISINs do not establish a global security identity. No recursive fund expansion or mixed-currency normalization was added.
- FMP access/coverage is account-dependent and remains unverified live. Unknown/fixed-income Plaid classifications are not guessed into funds from their ticker. If a source returns a stale fallback, it is still excluded from the fresh ownership calculation.
- The public API cache can return stale data after provider failure, but the private calculation requires both fresh cache expiry and acceptable source age. Do not bypass that exclusion to make a demo look fuller.
- Demo identity remains `X-User-Id`, not production authentication. Tests use Moto, mocked provider responses, synthetic audio and browser fixtures, never actual ElevenLabs/Nova calls.
- WSL sandbox mount failures required local-command escalation. Node/Chrome ran via Windows; Python tooling is in `/tmp/clearvest-venv`. Existing Vite port 5176 was reused. SAM built under Linux `/tmp`. Use the installed Chrome executable for the full browser suite instead of downloading another browser.

## Next steps

1. Review `/advisor` locally: Overlaps → expand a security → inspect Sources & limits → Ask Scout; then Risk check/Research, mobile and voice.
2. When deployment is authorized, verify FMP fund-holdings entitlement and real response shapes/dates, compare at least one overlap with issuer-published holdings and verify a missing-fund case. Do not substitute invented weights when coverage is unavailable.
3. Deploy the frontend/backend changes together with the pending guardrails milestone, then validate the sourced answer with actual Nova/guardrails and the shared ElevenLabs path. Deployment remains separately pending.
4. Push/update draft #42 only when explicitly requested; use the relevant `team:*` labels and require green `ci-ok` before merge.

## Open questions / blockers

No local implementation blocker. Live FMP entitlement, issuer comparison, actual source completeness and provider/model behavior remain unverified. Broader company-level consolidation across share classes and recursive funds would need a reliable security master and a separately tested expansion policy.
