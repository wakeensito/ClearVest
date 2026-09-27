# ClearVest

[![CI](https://github.com/wakeensito/ClearVest/actions/workflows/ci.yml/badge.svg)](https://github.com/wakeensito/ClearVest/actions/workflows/ci.yml)

An AI-powered investment companion that turns scattered financial data into clear, personalized guidance — through natural conversation, not spreadsheets.

**Sprint board:** https://github.com/users/wakeensito/projects/11

## House rules

- `main` is protected: PRs only, `ci-ok` must pass. No direct pushes — admins included.
- Drop your stack in — CI auto-detects Node (`package.json`) or Python (`pyproject.toml` / `requirements.txt`) and starts running lint / typecheck / tests / build automatically. Secret + vulnerability scans run on every PR from commit one.
- Label every issue and PR with a `team:*` label: `team:devops`, `team:ai`, `team:data`, `team:cybersecurity`, `team:frontend`, `team:backend`.
- Deploys use OIDC role assumption only — never static AWS keys. The pipeline stub is in `.github/workflows/deploy.yml`; wiring steps live in the seeded issue **"Wire up deploy pipeline"** and the CloudFormation template for the CD role is in `infra/cicd-role.yaml`.

## Local setup (Python)

```bash
python -m venv .venv && . .venv/Scripts/activate   # or: source .venv/bin/activate
pip install -r requirements.txt
python scripts/yf_smoke.py            # prints VOO + NVDA last close; no key needed
```

Market data comes from Yahoo Finance via `yfinance`. No API key. ETF holdings for look-through: `yf.Ticker("VOO").funds_data.top_holdings`.

Filings and fundamentals come from SEC EDGAR. No API key, but every request needs a `User-Agent` that names you or EDGAR returns 403. Copy `.env.example` to `.env`, set `SEC_USER_AGENT`, then `python scripts/sec_smoke.py NVDA`. Endpoints in use: `company_tickers.json` (ticker to CIK), `xbrl/companyfacts` (structured financials), `submissions` (filing list), `efts.sec.gov/LATEST/search-index` (full-text search). Stay under 10 requests/second.

## Backend

One HTTP API (API Gateway v2) in front of four Python 3.12 domain Lambdas, plus an SQS-backed
market-history refresh Lambda, sharing one Lambda Layer for provider clients, SSM config, DynamoDB, cache and error handling. IaC is AWS SAM — one stack,
`us-east-1`. Full design: `docs/superpowers/specs/2026-09-26-backend-architecture-design.md`.

| Function | Routes | Can access |
|---|---|---|
| `PortfolioFn` | `/health`, `/profile`, `/plaid/*`, `/portfolio/*` | DynamoDB table; Plaid keys |
| `MarketFn` | `/market/*` | DynamoDB table (cache rows); FMP, Alpha Vantage keys; SEC User-Agent param; FRED and yfinance (keyless) |
| `MarketRefreshFn` | SQS price-history jobs | History cache/reservation keys only; FMP and Alpha Vantage keys |
| `AdvisorFn` | `/advisor/*` | DynamoDB table; Bedrock (Nova model only) |
| `VoiceFn` | `/voice/*` | S3 audio bucket; ElevenLabs key; DynamoDB table; Bedrock (Nova) |

Operational limits worth knowing:

- **Timeouts:** `MarketFn`, `AdvisorFn` and `VoiceFn` run up to 29s (API Gateway stops at 30s); `MarketFn`
  still handles synchronous company research/comparisons. Price history reads snapshots and queues refreshes;
  `MarketRefreshFn` has a separate 60s deadline and a maximum of two concurrent executions.
- **Throttles:** 20 req/s (burst 50) by default; `/voice/*` and `/advisor/*` are capped at 2 req/s (burst 5)
  because they spend Bedrock/ElevenLabs money.
- **`/voice/speak`** takes up to 5000 chars and speaks the first ~2000, cut at a sentence end.
- **Linking an account** (`/plaid/exchange`, `/plaid/sandbox-link`) refreshes the holdings snapshot right
  away, so the advisor sees it on the next question.
- **Retries:** provider GETs retry once on 429/5xx (ignoring `Retry-After`); POSTs (Plaid, ElevenLabs) never
  retry — Plaid public tokens are single-use and ElevenLabs bills per call.
- **Plaid tokens are isolated in code, not IAM:** every function has table-wide DynamoDB access; only
  `PortfolioFn`'s code reads `PLAID#` rows. Fine for the sandbox; scope it before real accounts.
- `src/market/requirements.txt` shadows the layer's packages inside `MarketFn` (yfinance pulls in its own
  `requests`). If you pin `requests` there, keep it in lockstep with `src/layer/requirements.txt`.

### Background market-history refresh

`/market/history` returns cached charts immediately while SQS refreshes expired data. First requests
without a snapshot return `202`; the frontend polls for up to two minutes and then offers a manual
check. Jobs are deduplicated with DynamoDB leases, published atomically, and retried into a dead-letter
queue after repeated failures. Other market routes keep their existing behavior.

**Deployment prerequisite:** update `infra/cicd-role.yaml` before deploying the new queue, worker,
and alarms. See [the refresh runbook](docs/market-background-refresh.md) for timing, permissions,
provider-limit caveats, failure recovery, and verification.

### Local setup

```bash
uv venv --python 3.12 .venv && uv pip install -e ".[dev]"
source .venv/bin/activate
pytest -q
```

Tests run offline (`moto` for DynamoDB/S3/SSM, saved fixtures for every provider) — no keys, no network, no AWS
account needed to develop.

### Deploy

Deploys run in CI on merge to `main` so there's one source of truth for what's live (`.github/workflows/deploy.yml`).
One-time bootstrap, from a laptop with the default AWS profile:

```bash
aws cloudformation deploy --template-file infra/cicd-role.yaml \
  --stack-name ClearVest-cicd --capabilities CAPABILITY_NAMED_IAM
gh variable set AWS_DEPLOY_ROLE_ARN --body "<DeployRoleArn output>"
gh variable set DEPLOY_ENABLED --body true
```

After that, a merge to `main` runs `sam build && sam deploy`, then builds and publishes the frontend (see Frontend hosting). **Deploys run only from `main`**: the CD role's
OIDC trust is pinned to `refs/heads/main`, so PR and feature branches can't assume it. To redeploy without a
new merge: `gh workflow run deploy.yml --ref main`. The role stack must be redeployed once for this
restriction to take effect (existing stacks still trust every branch until then):
`aws cloudformation deploy --template-file infra/cicd-role.yaml --stack-name ClearVest-cicd --capabilities CAPABILITY_NAMED_IAM`. Local `sam build && sam deploy` still works for emergencies
(`samconfig.toml` uses `resolve_s3 = true`, no account IDs committed). The CD role deliberately can't delete
the stack — teardown is manual, with owner credentials. After editing `infra/cicd-role.yaml` (e.g. adding a
read action CloudFormation turned out to need), re-run the bootstrap `cloudformation deploy` to apply it.

### Frontend hosting

The frontend is hosted on a private S3 bucket behind CloudFront (same stack) at the stack's `FrontendUrl`
output. CD builds it on every push to `main`, right after `sam deploy`, with the stack's `ApiUrl` baked in as
`VITE_API_BASE_URL` (build time only, so an API URL change needs a rebuild), then syncs it to the bucket and
invalidates `/index.html` and `/`. Client-side routes work on refresh: CloudFront serves `index.html` for 403/404.

```bash
aws cloudformation describe-stacks --stack-name ClearVest --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" --output text
```

The CD role needs new CloudFront and bucket permissions for this. **Redeploy the role stack once before the
first frontend deploy:** `aws cloudformation deploy --template-file infra/cicd-role.yaml --stack-name ClearVest-cicd --capabilities CAPABILITY_NAMED_IAM`.
The first deploy creates the CloudFront distribution, which takes about 5–15 minutes.

### Plugging in keys

Every provider key lives in SSM Parameter Store (SecureString) and is read at request time, cached per warm
container. `clearvest-fmp` already exists; the other five still need values. FRED needs no key: macro data comes
from FRED's public `fredgraph.csv` download, so there is no `clearvest-fred` parameter.

```bash
aws ssm put-parameter --name clearvest-fmp --type SecureString --value '<fmp-key>' --region us-east-1 --overwrite
aws ssm put-parameter --name clearvest-alphavantage --type SecureString --value '<alphavantage-key>' --region us-east-1
aws ssm put-parameter --name clearvest-plaid-client-id --type SecureString --value '<plaid-client-id>' --region us-east-1
aws ssm put-parameter --name clearvest-plaid-secret --type SecureString --value '<plaid-secret>' --region us-east-1
aws ssm put-parameter --name clearvest-elevenlabs --type SecureString --value '<elevenlabs-key>' --region us-east-1
aws ssm put-parameter --name clearvest-sec-user-agent --type String --value 'ClearVest you@example.com' --region us-east-1
```

After rotating a key, redeploy (or wait for containers to recycle) — a warm container keeps the old value cached.

Renaming a parameter (e.g. to a hierarchical name) needs no code change, only a `sam deploy` parameter
override. Hierarchical names are given **without** the leading slash — the loader and the IAM policy both add it:

```bash
sam deploy --parameter-overrides FmpKeyParam=clearvest/fmp
```

### Verify a deploy

```bash
scripts/smoke.sh <ApiUrl>                    # every step must pass
scripts/smoke.sh <ApiUrl> --allow-upstream   # 502s are warnings (keys not in SSM yet)
```

`<ApiUrl>` is the stack's `ApiUrl` output. Run smoke after every deploy and again at freeze.

## Frontend

React + TypeScript + Vite in [`frontend/`](frontend/), wired into CI through the root npm workspace
(`package.json`). The look, tokens and UI rules are in [`DESIGN.md`](DESIGN.md); read it before building a screen.
The API contract, mock server and error envelope are in [`docs/api/README.md`](docs/api/README.md).

```bash
npm ci                 # Node 22; installs the workspace from the root lockfile
npm run mock           # terminal 1: Prism mock of docs/api/openapi.yaml on :4010
npm run dev            # terminal 2: http://localhost:5173
npm run lint && npm run typecheck && npm test && npm run build   # what CI runs
```

`npm run typecheck` regenerates `frontend/src/api/schema.d.ts` from the contract first, so a contract change that
breaks the UI fails CI. To use the real backend, copy `frontend/.env.example` to `frontend/.env.local` and set
`VITE_API_BASE_URL` to the deployed `ApiUrl`.

Phone-first Playwright checks against a dev server, with every API call intercepted (no backend or Prism needed):

```bash
cd frontend
npx vite --port 5174 --strictPort --host 127.0.0.1 &   # a preview server just for these checks
npm run test:browser           # full-app desktop + phone regression
npm run test:fund-explainer    # "What is this?" security research explainer (DESIGN.md §4.13)
npm run test:markets-advisor   # markets discovery: watchlist, search, company financials
npm run test:portfolio-xray    # what you really own, plan vs. today, ticker what-if (§4.14–§4.15)
npm run test:history-refresh   # background market-history refresh polling
```

## Handoffs

Everyone works on a different slice, so context lives in [`docs/handoffs/`](docs/handoffs/). **Before you start:** read the newest handoff for your area. **After every merged PR or milestone:** add a new one (copy `docs/handoffs/_TEMPLATE.md`) in the same PR. Agents pick this up automatically via `AGENTS.md` / `CLAUDE.md`.

## Workflow

```bash
git clone https://github.com/wakeensito/ClearVest.git
cd ClearVest
git checkout -b <your-branch>
# ...work...
git push -u origin <your-branch>
gh pr create --fill
```

Pick issues off the sprint board, keep them moving across Status, and flag anything stuck with the `blocked` label so it surfaces at standup.
