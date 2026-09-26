# CORS preflight: answer OPTIONS with 204 before routing

- **Date:** 2026-09-26
- **Author:** @Mario-Recondo
- **Team:** backend
- **Status:** done
- **PR / issue:** #6 (frontend flow against the real API), #13 (smoke before judging)
- **Branch:** fix/cors-preflight
- **Follows:** 2026-09-26-backend-sam-stack.md, 2026-09-26-frontend-scaffold-design-system.md

## What changed

- `make_handler` in the shared layer returns `204` with an empty body for any `OPTIONS` request
  before the Powertools resolver runs. Every function gets it, no per-route change.
- Test in `tests/layer/test_api.py` covers it.
- Nothing in `template.yaml` changed. API Gateway still adds the CORS headers from `CorsConfiguration`.

## How to run / verify it

```bash
uv venv --python 3.12 .venv
uv run --extra dev pytest -q tests/layer/test_api.py

# Against the deployed stack (after CD runs on main). Must be 204, not 404:
curl -s -i -X OPTIONS "$API_URL/market/macro" \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: x-user-id" | head -1
```

Then in `frontend/.env.local` set `VITE_API_BASE_URL` to the stack's `ApiUrl`, `npm run dev`, open
`/markets`. The Security research chart and the Economy card must load real data, not
"Can't reach ClearVest".

## Decisions & why

- **Short-circuit in the handler, not `CORSConfig` in Powertools.** API Gateway already emits the
  CORS headers (the routed 404 carried them). A second CORS layer means two places to keep in sync
  and possible duplicate headers. All the Lambda has to do is not fail the preflight.
- **Handler level, not a route.** The routes are `ANY /x/{proxy+}`, so the fix has to sit before
  routing. A per-function `OPTIONS` route would be five copies of the same thing.
- **Kept `ANY` routes.** Splitting them into explicit `GET`/`POST` routes would let API Gateway
  auto-answer preflights, but touches every function's events for the same outcome.

## Gotchas

- **Curl never preflights.** Every GET and POST worked from the shell while every browser call
  failed. Test cross-origin behavior with a real browser or an explicit `OPTIONS` request with
  `Origin` and `Access-Control-Request-Method` headers.
- **Why the browser preflights at all:** the `X-User-Id` header is custom, so every request is
  "non-simple" and gets a preflight. There is no request the frontend makes that skips this.
- **API Gateway auto-answers preflights only when no route matches `OPTIONS`.** `ANY` matches it.
  This is documented but easy to miss; the 404 in the preflight response body came from our own
  `not_found` handler, which is the tell.
- `.env.local` is gitignored. The deployed `ApiUrl` is a stack output
  (`aws cloudformation describe-stacks --stack-name ClearVest`), not a secret, but don't commit it
  either: it changes if the stack is recreated.

## Next steps

1. Merge; CD deploys on push to `main`. Re-run the `OPTIONS` check above against the live API.
2. Frontend: walk the P0 flow against the real API (welcome, sandbox link, dashboard, chat) and
   file whatever breaks next.
3. `scripts/smoke.sh` should send one `OPTIONS` request so the freeze check (#13) catches a CORS
   regression.

## Open questions / blockers

- None for this slice.
