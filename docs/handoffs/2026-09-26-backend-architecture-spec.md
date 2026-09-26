# Backend architecture spec agreed (4 domain Lambdas on SAM)

- **Date:** 2026-09-26
- **Author:** @wakeensito
- **Team:** backend
- **Status:** done
- **PR / issue:** #5 (backend epic)
- **Branch:** docs/backend-architecture-spec
- **Follows:** (first handoff)

## What changed

- Agreed the backend architecture: SAM stack, one HTTP API, four Python 3.12 Lambdas (Portfolio, Market, Advisor, Voice) sharing one Layer.
- Fixed the API contract the frontend builds against (spec §5; `docs/api/openapi.yaml` lands in the next PR).
- Ranked the features P0/P1/P2 and split the build order into issues on the board, labeled `priority:P0/P1/P2`.

## How to run / verify it

```bash
# Nothing runs yet; read the spec:
docs/superpowers/specs/2026-09-26-backend-architecture-design.md
# Frontend: once docs/api/openapi.yaml merges, mock the API with
npx @stoplight/prism-cli mock docs/api/openapi.yaml
```

## Decisions & why

- **4 domain Lambdas, not 1 or 10:** containment (one bad import doesn't take the demo down), Plaid tokens and Bedrock access scoped to the functions that need them, voice gets its own timeout. Ten was too much IaC and IAM for a one-day hackathon.
- **Voice is two calls (`/voice/turn`, then `/voice/speak`):** API Gateway HTTP APIs stop waiting after 30s; splitting keeps each call short and shows text before audio.
- **DynamoDB cache for every provider:** Alpha Vantage free tier is 25 calls/day. Without the cache we burn it in testing.
- **Numbers come from code, never Nova:** the model explains figures we computed; it never produces them.
- **SSM parameter names are template parameters:** teammates' naming (`clearvest-fmp` today) can change without code changes.
- **No auth:** frontend sends a localStorage UUID as `X-User-Id`.

## Gotchas

- The first key in Parameter Store is `clearvest-fmp` (flat, lowercase, us-east-1, default profile). Names are case-sensitive.
- CoinGecko was dropped; crypto history, if needed, comes from FMP.

## Next steps

1. P0 contract: `docs/api/openapi.yaml` (see board, `priority:P0`).
2. P0 skeleton: template, Layer, 4 functions, `/health`, first deploy.
3. Follow the build order in spec §10.

## Open questions / blockers

- Team to confirm the SSM naming pattern for the remaining keys (fred, alphavantage, plaid client id/secret, elevenlabs).
