# SAM stack skeleton: HTTP API, 4 domain Lambdas, shared layer

- **Date:** 2026-09-26
- **Author:** @wakeensito
- **Team:** backend
- **Status:** done
- **PR / issue:** #3
- **Branch:** feat/backend-iac
- **Follows:** 2026-09-26-backend-architecture-spec.md

## What changed

- `template.yaml`: one `AWS::Serverless::HttpApi`, four Python 3.12 functions (`PortfolioFn`, `MarketFn`,
  `AdvisorFn`, `VoiceFn`), one shared `SharedLayer`, one on-demand DynamoDB table (`pk`/`sk`, TTL on `ttl`),
  one private `AudioBucket` (SSE, 1-day lifecycle, presigned-URL-only access). Default throttling
  (20 req/s, burst 50) on the HTTP API, plus tighter per-route throttles on `ANY /voice/{proxy+}` and
  `ANY /advisor/{proxy+}` (2 req/s, burst 5) to cap Bedrock/ElevenLabs spend, since the API is
  unauthenticated. Timeouts: 15s global, 29s on `MarketFn`, `AdvisorFn` and `VoiceFn` (API Gateway gives up
  at 30s).
- `src/layer/clearvest/`: shared runtime used by all four functions — `api.py` (Powertools resolver +
  error-to-response mapping), `aws.py` (boto3 clients, Bedrock client with configurable timeout/retries),
  `config.py` (SSM secret loader, cached per warm container), `db.py` (DynamoDB helpers), `cache.py`
  (`get_or_fetch` with stale-on-failure fallback), `errors.py` (`AppError` subclasses), `http.py` (shared
  `requests` session, typed `UpstreamError`; one retry for GETs only, `Retry-After` ignored — see Decisions).
- `/health` on `PortfolioFn` returns `{status, version}` with no `X-User-Id` required — the only route that
  doesn't need it.
- Each function's IAM policy scopes `ssm:GetParameter` to its own parameter names only (built from
  `${AWS::Region}`/`${AWS::AccountId}` pseudo-parameters — no ARNs committed).
- CI (`ci.yml`, existing Python job) now covers this code; `pyproject.toml` added for dev tooling
  (`pytest`, `moto`) — runtime deps for each function still live next to their code
  (`src/layer/requirements.txt`, `src/market/requirements.txt`). `ruff` runs via `uvx ruff@0.16.5` (the
  CI pin), not a `pyproject.toml` dev dependency, so its version is controlled in one place (CI and
  local runs both use the same pin).

## How to run / verify it

```bash
uv venv --python 3.12 .venv && uv pip install -e ".[dev]"
source .venv/bin/activate
pytest -q                 # offline: moto for DynamoDB/S3/SSM, no network
uvx ruff@0.16.5 check .
sam validate --lint
sam build                 # needs python3.12 on PATH; see Gotchas
```

## Decisions & why

- **Four domain Lambdas, not one or ten** (spec §3): containment (one bad import or crash breaks one
  domain, not the demo), least privilege (only `PortfolioFn` touches Plaid tokens; only `AdvisorFn`/`VoiceFn`
  can call Bedrock), voice alone gets the longer timeout, and one folder per domain avoids router merge
  conflicts. Costs ~30 minutes more setup and up to 4 cold starts — warm each function before judging a demo.
- **One shared layer, not per-function copies:** provider clients, the SSM loader, cache and error handling
  are identical across functions; a layer means one place to fix a shared bug.
- **SSM parameter names are template parameters**, not hardcoded strings: whatever naming the team settles
  on, only `samconfig.toml`/`--parameter-overrides` change, never code. `clearvest.config.get_secret()`
  reads and decrypts once per container and caches in memory — a missing parameter fails only the routes
  that need it (`502 UPSTREAM_UNAVAILABLE`), never cold start.
- **Provider errors never leak query strings.** `clearvest/http.py` builds `UpstreamError` detail from
  `urlsplit(url)` (scheme/host/path only) instead of `str(err)`, because `requests` embeds the full URL —
  including `api_key=...` query params — in its exception messages, and that detail gets logged
  (review fix, see `1cecaf7`).
- **`clearvest/http.py` never retries POSTs** (urllib3's default `allowed_methods`, idempotent verbs only):
  Plaid public tokens are single-use and ElevenLabs bills per call, so a replayed POST could double-bill or
  fail on a spent token. `respect_retry_after_header=False`, so a `429 Retry-After: 60` can't park a Lambda
  for its whole timeout. GETs to market providers still get one retry on 429/5xx.
- **Plaid-token isolation is enforced in code, not IAM.** Every function gets `DynamoDBCrudPolicy` on the
  whole table, so `MarketFn`/`AdvisorFn`/`VoiceFn` *could* read `USER#<id>/PLAID#*` rows; only
  `PortfolioFn`'s code does. Acceptable for a Plaid sandbox; before real accounts, scope each function with
  `dynamodb:LeadingKeys` conditions or move tokens to their own table.
- **DynamoDB single-table, on-demand billing:** the cache is required, not an optimization — Alpha Vantage's
  free tier is 25 calls/day.

## Gotchas

- `sam build` needs `python3.12` on `PATH`. If it can't find it: `export PATH="$(dirname "$(uv python find 3.12)"):$PATH"`.
- Provider API keys are never logged, anywhere — including in `UpstreamError` details that bubble up through
  `cache.py` and `api.py`. If you add a new provider call, route it through `clearvest.http.request()` rather
  than raw `requests`, or you'll reintroduce the leak this layer was built to avoid.
- The shared layer is Python-only (`Metadata: BuildMethod: python3.12`); `pandas`/`yfinance` are too heavy
  for it and live only in `MarketFn`'s own `requirements.txt`.
- `src/market/requirements.txt` is installed into `MarketFn`'s package, which sits ahead of the layer on
  `sys.path` — anything it installs (notably `requests`, pulled in by yfinance) shadows the layer's copy. If
  `requests` gets pinned there, keep it in lockstep with `src/layer/requirements.txt`.

## Next steps

1. Domain teams build routes on top of this skeleton (#17–#26).
2. Plug keys into SSM, `sam build && sam deploy`, run `scripts/smoke.sh <ApiUrl>` (#1, #13).
3. Wire CD (`.github/workflows/deploy.yml`) once the first manual deploy is verified.

## Open questions / blockers

- None for this slice.
