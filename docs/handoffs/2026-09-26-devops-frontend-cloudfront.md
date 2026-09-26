# Frontend hosted on S3 + CloudFront, published by CD

- **Date:** 2026-09-26
- **Author:** @wakeensito
- **Team:** devops
- **Status:** in-progress (implemented and verified locally; not yet deployed)
- **PR / issue:** PR from `feat/frontend-cloudfront` to `main`
- **Branch:** `feat/frontend-cloudfront`
- **Follows:** [Frontend publication](2026-09-26-frontend-publication.md)

## What changed

- `template.yaml` (same `ClearVest` stack) now hosts the frontend: a fully private `FrontendBucket`, an Origin Access Control, and a CloudFront distribution (https redirect, HTTP/2+3, IPv6, `PriceClass_100`, managed CachingOptimized + SecurityHeaders policies). New outputs: `FrontendUrl`, `FrontendBucketName`, `FrontendDistributionId`.
- SPA fallback: CloudFront answers 403 and 404 with `/index.html` and status 200, so deep links like `/markets` work on refresh.
- `.github/workflows/deploy.yml` builds the frontend after `sam deploy` with the stack's `ApiUrl` baked in, syncs `frontend/dist` to the bucket with a cache split, invalidates `/index.html` and `/`, and prints the `FrontendUrl`.
- `infra/cicd-role.yaml` gives the CD role least-privilege CloudFront (distribution, OAC, managed-policy reads), bucket policy/ownership-control actions on `clearvest-*`, and object read/write/list on `clearvest-frontendbucket-*` only.
- Tests in `tests/test_template.py` guard the private bucket, OAC + https, SPA fallback, the distribution-scoped bucket policy and the outputs.

## How to run / verify it

```bash
# Local checks
.venv/bin/python -m pytest -q
uvx ruff@0.16.5 check .
sam validate --lint
uvx cfn-lint infra/cicd-role.yaml
npm ci && npm run lint && npm run typecheck && npm test
VITE_API_BASE_URL=https://example.invalid npm run build   # output: frontend/dist

# Before the first frontend deploy: apply the new CD role permissions (owner credentials)
aws cloudformation deploy --template-file infra/cicd-role.yaml \
  --stack-name ClearVest-cicd --capabilities CAPABILITY_NAMED_IAM

# After merge (or gh workflow run deploy.yml --ref main), find the site:
aws cloudformation describe-stacks --stack-name ClearVest --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" --output text
```

No env vars or secrets beyond the existing `AWS_DEPLOY_ROLE_ARN` / `DEPLOY_ENABLED` repo variables.

## Decisions & why

- **Same stack as the API.** CD reads `ApiUrl` and the bucket/distribution IDs from one `describe-stacks`; no cross-stack exports.
- **OAC, not OAI, and no public bucket.** The bucket policy allows `s3:GetObject` only to `cloudfront.amazonaws.com` with `AWS:SourceArn` pinned to this distribution.
- **No `BucketName`.** CloudFormation generates `clearvest-frontendbucket-*`, which the CD role's existing `${AppBucketPrefix}-*` scope covers.
- **CloudFront permissions are account-scoped, not name-scoped.** Distribution and OAC IDs are random, so they can't be prefixed like the Lambdas or table. The create actions (and two read-only handler lookups) need `Resource: '*'` because they support no resource-level permissions.
- **Managed policy UUIDs are hard-coded** (`658327ea-…` CachingOptimized, `67f7725c-…` SecurityHeadersPolicy). They are AWS-global IDs, not account data.
- **Deploy job timeout raised from 15 to 40 minutes**, because the first distribution create runs inside `sam deploy`.

## Gotchas

- The first CloudFront create takes about 5–15 minutes; `sam deploy` sits on `CREATE_IN_PROGRESS` for the distribution. That's normal.
- `VITE_API_BASE_URL` is read at build time only. If the `ApiUrl` changes, the frontend must be rebuilt and republished (rerun the deploy workflow).
- SPA fallback relies on the 403/404 → `/index.html` mapping. A private bucket returns 403 (not 404) for missing keys, so both are needed. A genuinely missing asset also returns `index.html` with a 200.
- Cache split, in three passes: `frontend/dist/assets` (the only content-hashed files) with `public, max-age=31536000, immutable` and `--delete`; everything else except `index.html` (files copied from `frontend/public/`: `fonts/`, `images/`, `favicon.svg`) with `public, max-age=0, must-revalidate` and `--delete`; then `index.html` with `no-cache, no-store, must-revalidate`. Finally `/index.html` and `/` are invalidated (`/` is a separate CloudFront cache key). Don't widen the immutable pass beyond `assets/`, or an in-place change to a public file sticks for a year.
- A tab left open across a deploy may request an old hashed chunk that `--delete` removed. The SPA fallback answers with `index.html` (200), so the lazy import fails; a reload fixes it. Known trade-off of deleting old assets.
- The CD role stack must be redeployed before the first deploy of this change, or `sam deploy` fails on `cloudfront:CreateDistribution`.

## Next steps

1. Redeploy `infra/cicd-role.yaml` (owner credentials), then merge and watch the deploy run.
2. Open the `FrontendUrl`, refresh on a deep route, and confirm API calls reach the `ApiUrl`.
3. Consider narrowing the API's CORS `AllowOrigins: ['*']` to the `FrontendUrl` once it's stable.
4. Optional: custom domain (ACM cert in us-east-1 + Route 53 alias) if the team wants a friendly URL.

## Open questions / blockers

- None. CloudFront create actions (`CreateDistribution`, `CreateOriginAccessControl`, ...) support no resource-level permissions, so they use `Resource: '*'`; everything else stays account-scoped. The managed cache/response-headers policy reads are validly scoped and aren't in the distribution handler's permission list anyway.
