# API contract + PortfolioFn: profile, Plaid sandbox, normalized holdings

- **Date:** 2026-09-26
- **Author:** @wakeensito
- **Team:** backend
- **Status:** done
- **PR / issue:** #17, #18
- **Branch:** feat/backend-iac
- **Follows:** 2026-09-26-backend-sam-stack.md

## What changed

- `docs/api/openapi.yaml`: the OpenAPI 3.1 contract for all four functions, committed so the frontend can
  build against a mock (`docs/api/README.md`) before the backend deploys.
- `GET /health` → `{status, version}`.
- `GET/PUT /profile` → `{age, horizon, goals, riskTolerance}`, stored at `USER#<id>/PROFILE`.
- `POST /plaid/link-token`, `POST /plaid/exchange`, `POST /plaid/sandbox-link` (dev-only: creates a Plaid
  sandbox item and exchanges it server-side, so the backend is testable with no Link UI).
- `GET /portfolio/holdings` → normalized `{asOf, totalValue, holdings: [...]}`, cached at
  `USER#<id>/HOLDINGS` and refetched when the snapshot is over an hour old. Returns `409 NOT_LINKED` until
  the user has a Plaid item.
- Linking (`/plaid/exchange` or `/plaid/sandbox-link`) marks the existing `HOLDINGS` snapshot stale
  (`fetchedAt: 0`) and refetches it immediately, so the advisor — which reads only that row — sees the new
  account on the very next question. The old snapshot is kept, not deleted, so it stays available as the
  fallback if the refetch fails. A Plaid failure during that refetch is swallowed: the link still returns
  `200 {itemId}` and `GET /portfolio/holdings` returns the old snapshot (with `stale: true`) until a later
  refetch succeeds.
- `GET /portfolio/risk` → the deterministic 0–100 risk score (see the market/risk handoff for the scoring
  logic itself).

## How to run / verify it

```bash
source .venv/bin/activate
pytest -q tests/portfolio tests/layer/test_db_cache.py
npx @stoplight/prism-cli mock docs/api/openapi.yaml   # build the frontend against this before deploy
```

Env vars needed (names only): `PLAID_ENV` (`sandbox`), `PLAID_CLIENT_ID_PARAM`, `PLAID_SECRET_PARAM` (SSM
parameter names, not values).

## Decisions & why

- **Plaid `access_token` never leaves `PortfolioFn` and is never returned to any client.** It's written to
  `USER#<id>/PLAID#<itemId>` and read back only inside `load_holdings()`; the public holdings response is
  built with `_public()`, which strips everything except the normalized snapshot. No other function has
  the Plaid keys — but every function has table-wide DynamoDB CRUD, so keeping other functions away from
  the `PLAID#` rows is enforced in code, not IAM. Fine for the sandbox; tighten with `dynamodb:LeadingKeys`
  or a separate table before real accounts.
- **Holdings are cached for an hour, no TTL on the row itself** (spec §4): the advisor always needs a
  snapshot to reason over, even a stale one, so the row isn't allowed to expire — only refetched.
- **`/plaid/sandbox-link` exists so the whole backend is demoable and testable without ever opening Plaid
  Link.** It calls `sandbox/public_token/create` then the normal exchange path — same code path as a real
  Link flow.
- **The contract file wins over this doc or the spec if they ever disagree** — fix the code, not the docs.

## Gotchas

- `/portfolio/holdings` and `/portfolio/risk` both 409 (`NOT_LINKED`) until `/plaid/sandbox-link` or a real
  Link flow has run for that `X-User-Id`. The smoke script accounts for this (skips holdings/risk if
  sandbox-link didn't return 2xx).
- Every route except `/health` requires `X-User-Id`; a missing/invalid header is `400 VALIDATION`, checked
  in `clearvest.api.user_id()` before any handler code runs.
- Plaid's sandbox is rate-limited like the real API; `sandbox/public_token/create` + `exchange` are two
  calls, not one — don't try to collapse them.

## Next steps

1. Plug `clearvest-plaid-client-id` / `clearvest-plaid-secret` into SSM, deploy, run `scripts/smoke.sh`.
2. Frontend switches its base URL from the Prism mock to the deployed `ApiUrl` (`docs/api/README.md`).
3. **Before any production Plaid use (`PlaidEnv=production`):** envelope-encrypt `accessToken` with a KMS key before `db.put` and decrypt only in PortfolioFn. Today it is stored as plaintext JSON (sandbox tokens, with DynamoDB encryption at rest), and every function has table-wide CRUD. That needs a KMS key, `kms:Encrypt`/`kms:Decrypt` on PortfolioFn only, and KMS permissions on the CD role. Deferred from CodeRabbit's PR #29 review.

## Open questions / blockers

- None for this slice.
