#!/usr/bin/env bash
# End-to-end check against a deployed stack. Run after every deploy and at freeze.
#   scripts/smoke.sh <ApiUrl>                    # every step must pass
#   scripts/smoke.sh <ApiUrl> --allow-upstream   # 502s are warnings (keys not in SSM yet)
set -euo pipefail

API="${1:?usage: smoke.sh <ApiUrl> [--allow-upstream]}"
API="${API%/}"
ALLOW_UPSTREAM="${2:-}"
USER_ID="$(python3 -c 'import uuid; print(uuid.uuid4())')"
OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT
fail=0
last_ok=0

step() {  # step <name> <method> <path> [json-body]
  local name="$1" method="$2" path="$3" body="${4:-}" code
  if [[ -n "$body" ]]; then
    code=$(curl -s -o "$OUT" -w '%{http_code}' -X "$method" "$API$path" \
      -H "x-user-id: $USER_ID" -H 'content-type: application/json' -d "$body")
  else
    code=$(curl -s -o "$OUT" -w '%{http_code}' -X "$method" "$API$path" -H "x-user-id: $USER_ID")
  fi
  last_ok=0
  if [[ "$code" =~ ^2 ]]; then
    echo "PASS  $name ($code)"
    last_ok=1
  elif [[ "$code" == "502" && "$ALLOW_UPSTREAM" == "--allow-upstream" ]]; then
    echo "WARN  $name (502: provider key missing or provider down)"
  else
    echo "FAIL  $name ($code): $(head -c 300 "$OUT")"
    fail=1
  fi
}

step health         GET  /health
step profile        PUT  /profile '{"age":24,"horizon":"long","goals":["retire early"],"riskTolerance":"medium"}'
step sandbox-link   POST /plaid/sandbox-link
if [[ "$last_ok" == 1 ]]; then
  step holdings     GET  /portfolio/holdings
  step risk         GET  /portfolio/risk
else
  echo "SKIP  holdings, risk (no linked account)"
fi
step chat           POST /advisor/chat '{"message":"I am 24 with a 401k match. Where should I start?"}'
step macro          GET  /market/macro
step templates      GET  /market/templates
step retirement     GET  /advisor/retirement-accounts
step upload-url     POST /voice/upload-url '{"contentType":"audio/webm"}'
exit "$fail"
