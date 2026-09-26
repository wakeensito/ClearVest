# ClearVest backend — architecture design

- **Date:** 2026-09-26
- **Status:** approved in brainstorming, pending written-spec review
- **Scope:** backend only. The frontend is built separately and connects through the API contract below.
- **Deadline:** hackathon ends **Sunday 2026-09-27, 11:00**. Feature freeze at 09:00.

## 1. Goal and constraints

ClearVest is an AI investment companion: users link accounts (Plaid sandbox), describe their situation
(text or voice), and get guidance tuned to their holdings, age, horizon and goals.

Constraints:

- **IaC is AWS SAM.** One stack, `us-east-1`, deployed with the default AWS profile.
- **Plaid is sandbox-only.** No real accounts, no production access.
- **Guidance is educational, not financial advice.** Every advisor reply carries a disclaimer.
- **API keys live in SSM Parameter Store** (SecureString), added by teammates. The first one exists as
  `clearvest-fmp`. The code never assumes a naming pattern (see §6).
- **CoinGecko is out of scope.** Crypto price history, if it's needed, comes from FMP (`BTCUSD`-style symbols).
- **No auth.** The frontend generates a UUID once, stores it in localStorage and sends it as `X-User-Id`.
- **Never commit account IDs, ARNs or secrets** (see `AGENTS.md`).

## 2. Priority

Everything below is scaffolded, but the work goes top-down. Nothing in a lower tier starts until the tier
above works end to end on the deployed stack.

| Tier | Features |
|---|---|
| **P0** | SAM stack, `/health`, SSM key loader, error handling, OpenAPI contract, profile, Plaid link → holdings, text advisor on Nova |
| **P1** | Risk score, FRED macro context, voice (ElevenLabs speech-to-text and text-to-speech), OIDC deploy from GitHub |
| **P2** | Historical/ETF comparison, normalized company comparison (FMP + EDGAR), retirement account breakdown, famous portfolio templates |

Goal-based time horizons aren't a separate feature. They're profile fields read by the risk score and the advisor.

## 3. Architecture: four domain Lambdas

One HTTP API (API Gateway v2) in front of four Python 3.12 Lambdas, one per domain. Shared code
(provider clients, SSM loader, cache, error handler, models) lives in one Lambda Layer. Within a domain,
each feature is its own route module, using the AWS Lambda Powertools `APIGatewayHttpResolver`. Adding a
feature adds a file, not template changes.

| Function | Routes | Can access |
|---|---|---|
| `PortfolioFn` | `/health`, `/profile`, `/plaid/*`, `/portfolio/*` | DynamoDB table; Plaid keys |
| `MarketFn` | `/market/*` | DynamoDB table (cache rows); FMP, Alpha Vantage, FRED keys; EDGAR (keyless, needs a `User-Agent`) |
| `AdvisorFn` | `/advisor/*` | DynamoDB table; Bedrock `InvokeModel` / `Converse` on the Nova model only |
| `VoiceFn` | `/voice/*` | S3 audio bucket; ElevenLabs key; DynamoDB table; Bedrock (Nova) |

Why four and not one or ten (decided in brainstorming):

- **Containment.** A bad import or crash breaks one domain, and the rest of the demo keeps working.
- **Least privilege where it matters.** Only `PortfolioFn` reads Plaid tokens. Only Advisor and Voice can call Bedrock.
- **Voice alone gets the longer timeout.**
- **Ownership.** One folder per domain means parallel work without router merge conflicts.
- **Cost of this choice:** about 30 minutes more setup than one function, and up to 4 cold starts. Warm each function before judging.

The advisor reasoning (building the prompt, calling Nova) is a Layer module (`clearvest/advisor.py`) used by
both `AdvisorFn` and `VoiceFn`, so voice doesn't call another Lambda.

### Repository layout

```
template.yaml                 SAM: HttpApi, 4 functions, Layer, table, bucket
samconfig.toml                resolve_s3 = true; no account IDs
src/
  layer/python/clearvest/     shared: config.py (SSM), cache.py, errors.py, models.py,
                              advisor.py, providers/{plaid,fmp,alphavantage,fred,edgar,elevenlabs,bedrock}.py
  portfolio/app.py + routes/  profile.py, plaid.py, holdings.py, risk.py, health.py
  market/app.py + routes/     history.py, companies.py, macro.py, templates.py (+ data/templates.json)
  advisor/app.py + routes/    chat.py, retirement.py
  voice/app.py + routes/      upload.py, turn.py, speak.py
tests/                        pytest, mirrors src/
docs/api/openapi.yaml         the contract (§5)
scripts/smoke.sh              deployed end-to-end check
```

## 4. Data and storage

### DynamoDB: one table (`clearvest`), on-demand billing, TTL attribute `ttl`

| PK | SK | Holds | TTL |
|---|---|---|---|
| `USER#<id>` | `PROFILE` | age, horizon, goals, riskTolerance | none |
| `USER#<id>` | `PLAID#<itemId>` | Plaid `access_token`. **Never returned to any client.** | none |
| `USER#<id>` | `HOLDINGS` | latest normalized holdings snapshot | 1h |
| `USER#<id>` | `CHAT#<iso-ts>` | advisor turns (role, text) | 7d |
| `CACHE#<provider>` | `<normalized query>` | provider response + `fetchedAt` | 1h–24h per provider |

The cache is required, not an optimization. **Alpha Vantage's free tier allows 25 calls per day, and FMP's about 250.** Every
provider call goes through `cache.get_or_fetch()`. Expired rows are kept (TTL deletion is lazy) and used as
a `stale: true` fallback when the provider fails.

### S3: one bucket, audio only

`audio/in/<userId>/<uuid>` (uploads) and `audio/out/<userId>/<uuid>.mp3` (TTS output). A lifecycle rule deletes
objects after 1 day. The bucket is private, and all access goes through presigned URLs (15-minute expiry). Portfolio
templates are bundled JSON, not S3.

## 5. API contract

The contract is committed as `docs/api/openapi.yaml` in the first PR. **That file is the source of truth.**
If it differs from this section, the file wins.

**How the frontend gets it:** the first PR commits `docs/api/openapi.yaml`. The frontend teammate runs a mock
server from it (`npx @stoplight/prism-cli mock docs/api/openapi.yaml`) and builds the UI against realistic
responses before the backend is deployed. At go-live they change one base URL.

### Conventions

- Base URL: the `ApiUrl` stack output. CORS allows all origins.
- `X-User-Id: <uuid>` is required on every route except `/health`. Missing or invalid returns `400 VALIDATION`.
- JSON in and out. Error envelope: `{"error": {"code": "<CODE>", "message": "<human text>", "requestId": "<id>"}}`
- Codes: `VALIDATION` (400), `NOT_LINKED` (409), `UPSTREAM_UNAVAILABLE` (502), `INTERNAL` (500).
- Responses served from an expired cache after a provider failure include `"stale": true`.

### Routes

| Fn | Method | Path | Request → Response |
|---|---|---|---|
| Portfolio | GET | `/health` | → `{status, version}` |
| Portfolio | GET, PUT | `/profile` | `{age, horizon: short\|medium\|long, goals: [str], riskTolerance: low\|medium\|high}` |
| Portfolio | POST | `/plaid/link-token` | → `{linkToken}` |
| Portfolio | POST | `/plaid/exchange` | `{publicToken}` → `{itemId}` |
| Portfolio | POST | `/plaid/sandbox-link` | → `{itemId}`. **Dev only**: creates a sandbox item with no Link UI. |
| Portfolio | GET | `/portfolio/holdings` | → `{asOf, totalValue, holdings: [{symbol, name, type, quantity, price, value, weight}]}` |
| Portfolio | GET | `/portfolio/risk` | → `{score: 0–100, label, factors: [{name, detail}], summary}` |
| Market | GET | `/market/history?symbols=A,B&range=1y\|5y\|10y` | → `{series: [{symbol, points: [{date, close}], returnPct, volatility}]}` |
| Market | GET | `/market/compare-companies?symbols=AMD,NVDA` | → `{companies: [{symbol, pe, ps, grossMargin, revenueGrowth, epsTTM, fcfPerShare, debtToEquity}], notes}` |
| Market | GET | `/market/macro` | → `{fedFunds, cpiYoY, unemployment, wageGrowth, tenYear, asOf, summary}` |
| Market | GET | `/market/templates` | → `[{id, name, description, allocations: [{asset, weight}], source}]` |
| Advisor | POST | `/advisor/chat` | `{message}` → `{reply, disclaimer}` |
| Advisor | GET | `/advisor/retirement-accounts` | → `{accounts: [{id, name, taxTreatment, contributionLimit, bestFor}], personalized}` |
| Advisor | DELETE | `/advisor/history` | → `204` |
| Voice | POST | `/voice/upload-url` | `{contentType}` → `{uploadUrl, key}` |
| Voice | POST | `/voice/turn` | `{key}` → `{transcript, reply}` |
| Voice | POST | `/voice/speak` | `{text}` → `{audioUrl, expiresIn}` |

`/portfolio/holdings` and `/portfolio/risk` return `409 NOT_LINKED` until the user has a Plaid item.

## 6. Key flows

### SSM keys

Each key's **parameter name** is a SAM template parameter (e.g. `FmpKeyParam`, default `clearvest-fmp`) and is
passed to its function as an environment variable. `clearvest.config.get_secret(env_name)` reads it once per container
with decryption and caches it in memory. Each function's IAM policy allows `ssm:GetParameter` on **its own
parameters only**, built with `${AWS::Region}`/`${AWS::AccountId}` pseudo-parameters, so no ARNs are committed.
Whatever naming the team settles on (`clearvest-fred` or `/clearvest/fred`), only `samconfig.toml` parameter
overrides change.

Expected parameters: `fmp`, `alphavantage`, `fred`, `plaid-client-id`, `plaid-secret`, `elevenlabs`.
A missing parameter fails only the routes that need it (`502 UPSTREAM_UNAVAILABLE`, logged by name), never cold start.

### Plaid (sandbox)

`/plaid/link-token` → frontend opens Plaid Link → `/plaid/exchange` stores `access_token` →
`/portfolio/holdings` calls `investments/holdings/get`, normalizes the response and caches it for 1h. `/plaid/sandbox-link`
calls `sandbox/public_token/create` + exchange server-side, so the backend is testable with no frontend.

### Advisor

`advisor.answer(user_id, message)`:

1. Loads the profile, holdings summary, risk score, FRED macro snapshot (all cached) and the last 10 chat turns.
2. Builds a system prompt with that context, the "educational, not financial advice" guardrail, and an
   instruction to use only the numbers provided.
3. Calls Nova through Bedrock `Converse`. The model ID is an env var, defaulting to the cheapest Nova text model available in
   `us-east-1`; the exact ID is checked against `aws bedrock list-foundation-models` during implementation.
4. Stores both turns and returns `{reply, disclaimer}`.

**Numbers come from code, never the model.** Risk score, returns, volatility, ratios and macro figures are computed in
Python. Nova only explains them.

### Voice

Two short calls instead of one long one, so each stays well under API Gateway's 30-second integration limit:

1. `/voice/upload-url` → presigned S3 PUT; the frontend uploads the recording.
2. `/voice/turn {key}` → ElevenLabs speech-to-text → `advisor.answer()` → `{transcript, reply}` (target under 10s).
3. `/voice/speak {text}` → ElevenLabs text-to-speech → mp3 to `audio/out/` → presigned GET `{audioUrl}` (target under 5s).

The frontend shows `reply` as soon as step 2 returns and plays audio when step 3 returns. `VoiceFn` timeout is 29s,
the other functions 15s.

### Risk score (deterministic)

The 0–100 score is built from concentration (largest position weight, HHI), asset-type mix (equity / fixed income / cash / crypto),
and a horizon/age adjustment from the profile. Label bands: 0–33 Conservative, 34–66 Moderate, 67–100 Aggressive.
Each factor returns a plain-language `detail` string.

## 7. Error handling

- **One error handler** in the Layer, shared by all four functions. Routes raise `AppError` subclasses (`ValidationError`,
  `NotLinkedError`, `UpstreamError`). Anything else becomes `INTERNAL` with the Lambda `requestId`, logged with a stack trace.
- **Validation:** Pydantic models on every body and query. Bad input fails before any provider call.
- **Providers:** 5s timeout, one retry, then a stale cache row (`stale: true`), then `502 UPSTREAM_UNAVAILABLE`.
- **Bedrock:** boto3 `adaptive` retry mode. If it still fails, the reply is a friendly retry message, not a 500.
- **Voice:** an empty transcript returns `400 VALIDATION` ("didn't catch that"). A text-to-speech failure doesn't affect the text reply already returned.
- **Logging:** Powertools `Logger` with structured JSON, correlation ID = request ID, and `userId` in every line.

## 8. Testing

- **Unit (pytest):** risk score and ratio normalization are pure functions with thorough tests. Route handlers are tested with
  `moto` (DynamoDB, S3, SSM) and saved JSON fixtures for every provider. **CI makes no network calls and needs no keys.**
- **Contract:** P0 route responses are validated against `docs/api/openapi.yaml` in tests.
- **Smoke (deployed):** `scripts/smoke.sh <ApiUrl>` runs health → sandbox-link → holdings → risk → chat → macro, and exits non-zero
  on the first failure. It's run after every deploy and at freeze.
- CI (existing `ci.yml`, Python job) runs ruff and pytest.

## 9. Deploy

- **Tonight:** `sam build && sam deploy` from a laptop, default profile, `us-east-1`. `samconfig.toml` uses `resolve_s3 = true`.
- **P1:** wire the existing OIDC `deploy.yml` (issue #1) to run `sam deploy` on merge to `main`.

## 10. Build order

Each step is one issue and one PR, and each PR ships its handoff doc (`docs/handoffs/2026-09-2x-backend-<slug>.md`).

1. **P0 contract:** `docs/api/openapi.yaml` (unblocks the frontend immediately)
2. **P0 skeleton:** template, Layer, 4 functions, `/health`, SSM loader, cache, error handler, CI green, first deploy
3. **P0:** profile + Plaid (link-token, exchange, sandbox-link) + holdings
4. **P0:** advisor chat with context
5. **P1:** risk score · FRED macro
6. **P1:** voice turn + speak
7. **P2:** history comparison · company comparison · retirement accounts · templates
8. **Freeze 09:00 Sunday:** smoke test, warm functions, no new features

## 11. Out of scope

Auth/Cognito, production Plaid, CoinGecko, WebSocket streaming, per-feature Lambdas, multi-region.
