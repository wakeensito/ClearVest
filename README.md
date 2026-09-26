# ClearVest

[![CI](https://github.com/wakeensito/ClearVest/actions/workflows/ci.yml/badge.svg)](https://github.com/wakeensito/ClearVest/actions/workflows/ci.yml)

Bootstrapped with launch-repo. Replace this line with what the project actually is.

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
