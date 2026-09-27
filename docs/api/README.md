# ClearVest API

`openapi.yaml` is the contract between backend and frontend. If code and this file disagree, the file wins; fix the code.

## Build the UI before the backend is live

    npx @stoplight/prism-cli mock docs/api/openapi.yaml
    # -> http://127.0.0.1:4010, serving the examples in the spec

Send `X-User-Id: <uuid>` on every call except `/health` (generate one with `crypto.randomUUID()` and keep it in localStorage).

## Switch to the real backend

Change one base URL to the `ApiUrl` stack output:

    aws cloudformation describe-stacks --stack-name ClearVest \
      --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text

## Voice flow

1. `POST /voice/upload-url {contentType}` → `PUT` the recording to `uploadUrl` with the same `Content-Type` header.
2. `POST /voice/turn {key}` → show `reply` immediately.
3. `POST /voice/speak {text: reply}` → play `audioUrl`.

## Market history refresh

`GET /market/history` returns `200` with cached series or `202` with the available subset while
uncached symbols refresh. Both use the `History` schema. Render existing charts while `refreshing`
is true; poll every five seconds for at most two minutes from the pending entry's `requestedAt`.
After that, offer a manual check. `refresh[]` gives each symbol's `ready`/`pending`/`failed` status,
snapshot retrieval timestamp (`fetchedAt`), and refresh request timestamp (`requestedAt`).
A failed refresh keeps an available stale snapshot; no usable snapshot and no pending work is `502`.
See [the refresh runbook](../market-background-refresh.md). Macro, news, research, and comparison
responses retain their existing contracts.

## Errors

Every error is `{"error": {"code", "message", "requestId"}}`. `NOT_LINKED` (409) means "send the user to Plaid Link". `UPSTREAM_UNAVAILABLE` (502) means a data provider is down; retry or show a soft message. `stale: true` on a 200 means the data is cached from an earlier call.
