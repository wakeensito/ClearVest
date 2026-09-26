# CD wiring: OIDC deploy role, deploy.yml, smoke script

- **Date:** 2026-09-26
- **Author:** @wakeensito
- **Team:** devops
- **Status:** done
- **PR / issue:** #1, #13
- **Branch:** feat/backend-iac
- **Follows:** 2026-09-26-backend-sam-stack.md

## What changed

- `infra/cicd-role.yaml`: a one-time-bootstrap CloudFormation stack for a GitHub Actions OIDC deploy role
  (`ClearVest-gha-deploy`), scoped to exactly what `sam deploy` needs for this stack (CloudFormation on
  `ClearVest/*` and SAM's own managed artifact bucket stack, the SAM transform, Lambda/DynamoDB/S3/IAM/HTTP
  API resources prefixed `ClearVest-`/`clearvest-`). Includes the read-side calls CloudFormation's
  resource handlers make during create/update (`dynamodb:DescribeContributorInsights`,
  `DescribeKinesisStreamingDestination`, `GetResourcePolicy` on the table; `s3:ListBucket`, `GetBucketAcl`
  on the app bucket). No account ID or ARN committed — every resource is
  built from `${AWS::Region}`/`${AWS::AccountId}` pseudo-parameters.
- `.github/workflows/deploy.yml`: replaced the launch-repo TODO stub with a real `sam build && sam deploy`
  step, gated by the `DEPLOY_ENABLED` repo variable (merges to `main` no-op until it's set to `true`;
  `workflow_dispatch` always runs, so wiring can be tested on purpose without flipping the gate).
- `scripts/smoke.sh`: end-to-end check against a deployed stack — health → profile → sandbox-link →
  (holdings, risk) → chat → macro → templates → retirement-accounts → upload-url. Exits non-zero on the
  first real failure; a `--allow-upstream` flag turns `502`s into warnings for a fresh deploy where keys
  aren't in SSM yet.

## How to run / verify it

```bash
# One-time bootstrap (owner's AWS credentials, default profile):
aws cloudformation deploy --template-file infra/cicd-role.yaml \
  --stack-name ClearVest-cicd --capabilities CAPABILITY_NAMED_IAM
gh variable set AWS_DEPLOY_ROLE_ARN --body "<DeployRoleArn output>"
gh variable set DEPLOY_ENABLED --body true

# Every merge to main now deploys. To deploy a branch without merging:
gh workflow run deploy.yml --ref <branch>

# Local emergency deploy still works:
sam build && sam deploy

# After any deploy:
scripts/smoke.sh <ApiUrl>
```

## Decisions & why

- **Deploy runs in CI, not from laptops, once wired** (owner's call): "deploy in CD so everything has a
  source of truth" — one place to see what's live and why, rather than whoever's laptop last ran `sam
  deploy`. Local `sam deploy` remains available for emergencies (a broken pipeline shouldn't block a demo
  fix), but the intended path after bootstrap is merge-to-`main`.
- **OIDC role assumption only, never static AWS keys** — GitHub's federated identity assumes
  `ClearVest-gha-deploy` per run; no long-lived credentials live in repo secrets.
- **The trust policy matches both GitHub subject shapes** (`repo:owner/name:*` and the newer ID-stamped
  `repo:owner@id/name@id:*`) — accounts provisioned under the newer format never match the classic pattern
  alone, and the failure mode is an opaque "not authorized" at `AssumeRoleWithWebIdentity` time with no
  useful CloudTrail hint. Both `StringLike` conditions are present so this never has to be debugged live.
- **The CD role deliberately cannot delete the stack.** Its CloudFormation permissions don't include
  `DeleteStack`/`Update*` beyond what a changeset execute needs, and it has no broad `iam:*`/`s3:*`. Teardown
  is a manual, owner-run action — CI should never be able to destroy the demo.
- **`AWS_DEPLOY_ROLE_ARN` and `DEPLOY_ENABLED` are repo *variables*, not secrets** — an ARN and a boolean
  aren't sensitive, and variables are visible/diffable in the Actions UI, unlike secrets.
- **`deploy.yml`'s gate defaults to a silent no-op**, so an unwired repo (or one where the bootstrap hasn't
  run yet) never shows a red X on `main` from a deploy job that has nothing to deploy with.

## Gotchas

- `infra/cicd-role.yaml` assumes the account already has the GitHub OIDC provider
  (`token.actions.githubusercontent.com`) registered. If it doesn't:
  `aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com --client-id-list sts.amazonaws.com`
  — one-time per AWS account, not per repo.
- `sam build` needs `python3.12` on `PATH` (CI installs it via `actions/setup-python@v5`; locally, `export
  PATH="$(dirname "$(uv python find 3.12)"):$PATH"` if `sam build` can't find it).
- `AppResources`'s `lambda:*`/`scheduler:*` and `AppRoles`' IAM actions are scoped by the `${AppStackName}-*`
  naming prefix, not by exact ARNs — extending the app template with a new resource type needs a matching
  new statement in `cicd-role.yaml`, scoped the same way, never a bare `*` Resource.
- If a deploy fails with `AccessDenied` on a `Describe*`/`Get*` call, it's a handler read-back the role
  doesn't have yet — add that one action to the matching statement (same scope) and re-run the bootstrap
  deploy; don't widen the Resource. `apigateway:TagResource`/`UntagResource` ARE real, required IAM
  actions — the ApiGatewayV2 Stage handler calls them directly; cfn-lint's action database is just stale
  (flags them as W3037), suppressed per-resource in `cicd-role.yaml`.
- `scripts/smoke.sh` needs `python3` on `PATH` only to generate a UUID for `X-User-Id`; it has no other
  dependency beyond `curl`.
- Re-running `cloudformation deploy` on `infra/cicd-role.yaml` after editing its policies is safe and
  idempotent — it's a normal stack update, not a bootstrap-only script.

## Next steps

1. Owner runs the one-time bootstrap (above) and sets the two repo variables.
2. Plug provider keys into SSM (see README **Plugging in keys**).
3. `gh workflow run deploy.yml --ref feat/backend-iac` (or merge to `main`) for the first real deploy, then
   `scripts/smoke.sh <ApiUrl>`.
4. Frontend switches its base URL to the deployed `ApiUrl` (`docs/api/README.md`).

## Open questions / blockers

- None for this slice — bootstrap and the first deploy are the owner's to run (they touch the owner's AWS
  account).
