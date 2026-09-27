# SQS-backed market history refresh

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** backend
- **Status:** done (implementation and local verification; not deployed)
- **PR / issue:** Feature PR from `feat/market-background-refresh` to `main`; `team:backend`.
- **Branch:** `feat/market-background-refresh`
- **Follows:** [Market data](2026-09-26-data-market.md), [SAM stack](2026-09-26-backend-sam-stack.md), [Frontend deployment](2026-09-26-devops-frontend-cloudfront.md), [Research integration](2026-09-26-frontend-learn-research-integration.md)

## What changed

- Price history now reads shared snapshots immediately and queues missing/expired symbol-range pairs for a separate refresh Lambda. Other market endpoints retain their existing behavior.
- Added conditional DynamoDB reservations, expiring execution leases, atomic snapshot publication, retry handling, an encrypted SQS queue and DLQ, restricted worker IAM, and queue-age/DLQ alarms.
- Documented 202/partial history responses and refresh metadata in OpenAPI. The frontend retains stale charts, displays retrieval times, polls for at most two minutes, and offers manual checks for delayed/failed work.
- Extended the deployment role for the new resources and added [the operational runbook](../market-background-refresh.md), offline integration tests, infrastructure guards, and a dedicated browser smoke script.

## How to run / verify it

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]' 'ruff==0.16.5'
pytest -q
ruff check .
sam validate --lint
sam build
npm run typecheck
npm run lint
npm test
npm run build
VITE_API_BASE_URL=http://127.0.0.1:4010 npm run dev -w frontend
# In another terminal (Playwright Chromium, or PLAYWRIGHT_CHROMIUM_EXECUTABLE):
npm run test:history-refresh -w frontend
```

Local verification: 238 backend tests, 82 frontend tests, Ruff, ESLint, TypeScript,
frontend production build, SAM validation/build, and cfn-lint passed. Chrome browser
checks passed for pending-to-ready, stale charts, bounded polling, failed refresh,
and manual recovery. Provider calls and AWS services were mocked for tests; live
latency, IAM enforcement, quotas, and real provider availability are not verified.

New runtime environment variable: `MARKET_REFRESH_QUEUE_URL` on MarketFn, wired by
SAM. Worker uses existing `TABLE_NAME`, `FMP_KEY_PARAM`, and `ALPHAVANTAGE_KEY_PARAM`.
Local validation used isolated tools under `/tmp` because this WSL shell lacked a
Python development environment; no global package/configuration changes were made.

## Decisions & why

- First scope is `/market/history`: a high-value dashboard path with an existing reusable snapshot/provider chain. This avoids changing every market response contract at once.
- Reuse `src/market` for the worker package and provider fallbacks. Share code and dependencies without making a Lambda-to-Lambda HTTP call.
- A 30-second dispatch reservation recovers a producer crash before SQS send. After submission, reservations cover queue retention; 90-second execution leases exceed the 60-second worker deadline. Conditional transaction publication fences older workers.
- Two concurrent workers, batch size one, 360-second visibility, five receives before DLQ. These bound parallel work and retries; they do not implement hard per-provider request/daily budgets.
- The source queue retains one hour of regenerable refresh work; the DLQ retains 14 days. Explicit timestamp checks enforce cache retention independently of DynamoDB TTL cleanup.
- Worker access is restricted to history/reservation keys and its two provider parameters. It cannot access Plaid tokens or other user rows.

## Gotchas

- **Apply `infra/cicd-role.yaml` before deploying this app change.** Existing CD permissions lack SQS, event-source mapping, and CloudWatch alarm management. Use the owner's normal bootstrap command from README; no deployment was performed here.
- Ship frontend and backend together: a cold history request can now be `202` with no series. Clients must render the pending state and poll; 202 is not an empty chart result.
- Alarms have no notification actions. Wire them to the team's alert channel before expecting notifications. The runbook covers DLQ inspection and recovery; old completed/superseded messages are intentionally ignored on redrive.
- Handled terminal failures enforce a five-minute cooldown. Hard timeouts can leave a pending reservation until expiration, but the browser stops polling after two minutes. Global provider budgets and scheduled prewarming are follow-ups.
- The production frontend build retains its existing over-500 kB main-chunk warning; this task does not change route splitting.
- The environment's filesystem sandbox could not start because of its WSL mount configuration; repository commands used the approved fallback execution path.

## Next steps

1. Review the feature PR with `team:backend` (and data/frontend/devops as appropriate); require green `ci-ok` before merging.
2. Update the deploy-role stack, then use normal main-only CD to deploy the app. Never merge or deploy from this handoff alone.
3. Verify a cold symbol/range moves from 202 to 200 and stale history remains visible while a job runs. Inspect `MarketRefreshQueueUrl` and `MarketRefreshDeadLetterQueueUrl` outputs and worker logs.
4. Connect alarm notifications and measure stale-read p95, provider calls per refresh, queue age, and snapshot age under concurrent traffic.
5. Confirm provider entitlements before raising worker concurrency. Extend refreshes to other endpoints or add shared provider budgets only with their own freshness/contract decisions.

## Open questions / blockers

- No implementation blocker. AWS deployment and live-provider verification remain follow-up work.
- DevOps needs to select an alarm notification destination. The data team needs to confirm provider budgets for any higher-concurrency rollout.
